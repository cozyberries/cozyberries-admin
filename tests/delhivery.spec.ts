import { test, expect, APIRequestContext } from '@playwright/test';

let authToken: string;
let apiContext: APIRequestContext;
let unauthContext: APIRequestContext;

async function getAdminToken(ctx: APIRequestContext): Promise<string> {
  const email = process.env.TEST_ADMIN_EMAIL ?? '';
  const password = process.env.TEST_ADMIN_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set for Delhivery tests');
  }
  const res = await ctx.post('/api/auth/admin-login', {
    data: { identifier: email, password },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.token).toBeTruthy();
  return body.token as string;
}

function authHeaders() {
  return { Authorization: `Bearer ${authToken}` };
}

const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

test.describe('Delhivery Shipment Integration', () => {
  test.beforeAll(async ({ playwright }) => {
    const baseURL = process.env.BASE_URL || 'http://localhost:4000';
    unauthContext = await playwright.request.newContext({ baseURL });
    apiContext = await playwright.request.newContext({ baseURL });
    authToken = await getAdminToken(apiContext);
  });

  test.afterAll(async () => {
    await apiContext.dispose();
    await unauthContext.dispose();
  });

  // ── Auth guard ─────────────────────────────────────────────────

  test('POST /shipment without auth returns 403', async () => {
    const res = await unauthContext.post(`/api/orders/${FAKE_UUID}/shipment`, { data: {} });
    expect(res.status()).toBe(403);
  });

  test('POST /shipment/cancel without auth returns 403', async () => {
    const res = await unauthContext.post(`/api/orders/${FAKE_UUID}/shipment/cancel`, { data: {} });
    expect(res.status()).toBe(403);
  });

  test('GET /shipment/label without auth returns 403', async () => {
    const res = await unauthContext.get(`/api/orders/${FAKE_UUID}/shipment/label`);
    expect(res.status()).toBe(403);
  });

  // ── Non-existent order ─────────────────────────────────────────

  test('POST /shipment with non-existent order returns 404', async () => {
    const res = await apiContext.post(`/api/orders/${FAKE_UUID}/shipment`, {
      headers: authHeaders(),
      data: {},
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  test('POST /shipment/cancel with non-existent order returns 404', async () => {
    const res = await apiContext.post(`/api/orders/${FAKE_UUID}/shipment/cancel`, {
      headers: authHeaders(),
      data: {},
    });
    expect(res.status()).toBe(404);
  });

  test('GET /shipment/label with non-existent order returns 404', async () => {
    const res = await apiContext.get(`/api/orders/${FAKE_UUID}/shipment/label`, {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(404);
  });

  // ── Non-Delhivery order edge cases ─────────────────────────────

  test.describe('Non-Delhivery order edge cases', () => {
    let nonDelhiveryOrderId: string | undefined;

    test.beforeAll(async () => {
      const res = await apiContext.get('/api/orders?limit=50', { headers: authHeaders() });
      if (res.status() !== 200) return;

      const { orders = [] } = await res.json();
      const order = orders.find(
        (o: { carrier_name?: string; tracking_number?: string }) =>
          o.carrier_name !== 'Delhivery'
      );
      nonDelhiveryOrderId = order?.id;
    });

    test('cancel returns 400 for non-Delhivery order', async () => {
      test.skip(!nonDelhiveryOrderId, 'No non-Delhivery order available');

      const res = await apiContext.post(`/api/orders/${nonDelhiveryOrderId}/shipment/cancel`, {
        headers: authHeaders(),
        data: {},
      });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('No Delhivery shipment');
    });

    test('label returns 400 for non-Delhivery order', async () => {
      test.skip(!nonDelhiveryOrderId, 'No non-Delhivery order available');

      const res = await apiContext.get(`/api/orders/${nonDelhiveryOrderId}/shipment/label`, {
        headers: authHeaders(),
      });

      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('No Delhivery shipment');
    });
  });

  // ── Shipment creation validation ───────────────────────────────

  test.describe('Shipment creation (staging)', () => {
    let eligibleOrderId: string | undefined;

    test.beforeAll(async () => {
      const res = await apiContext.get('/api/orders?limit=50', { headers: authHeaders() });
      if (res.status() !== 200) return;

      const { orders = [] } = await res.json();
      const order = orders.find(
        (o: { tracking_number?: string | null; carrier_name?: string | null; status: string; shipping_address?: unknown }) =>
          !o.tracking_number &&
          o.carrier_name !== 'Delhivery' &&
          o.shipping_address &&
          ['payment_confirmed', 'processing'].includes(o.status)
      );
      eligibleOrderId = order?.id;
    });

    test('should create a shipment via Delhivery staging API', async () => {
      test.skip(!eligibleOrderId, 'No eligible order for shipment creation');

      const res = await apiContext.post(`/api/orders/${eligibleOrderId}/shipment`, {
        headers: authHeaders(),
        data: { weight: 500 },
      });

      const body = await res.json();
      const status = res.status();

      if (status === 422) {
        console.log('Delhivery staging rejected shipment:', body.error);
        expect(body.error).toBeTruthy();
        return;
      }

      if (status === 400) {
        console.log('Validation error:', body.error);
        expect(body.error).toBeTruthy();
        return;
      }

      if (status === 401 || status === 502) {
        console.log('Delhivery API unavailable:', body.error);
        expect(body.error).toBeTruthy();
        return;
      }

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.waybill).toBeTruthy();
      console.log('Shipment created — waybill:', body.waybill);
    });
  });

  // ── E2E: operations on an existing Delhivery order ─────────────

  test.describe('E2E with existing Delhivery order', () => {
    let delhiveryOrderId: string | undefined;

    test.beforeAll(async () => {
      const res = await apiContext.get('/api/orders?limit=50', { headers: authHeaders() });
      if (res.status() !== 200) return;

      const { orders = [] } = await res.json();
      const order = orders.find(
        (o: { tracking_number?: string | null; carrier_name?: string | null; status: string }) =>
          !!o.tracking_number &&
          o.carrier_name === 'Delhivery' &&
          !['cancelled', 'delivered', 'refunded'].includes(o.status)
      );
      delhiveryOrderId = order?.id;
    });

    test('should reject duplicate shipment creation (409)', async () => {
      test.skip(!delhiveryOrderId, 'No existing Delhivery order');

      const res = await apiContext.post(`/api/orders/${delhiveryOrderId}/shipment`, {
        headers: authHeaders(),
        data: {},
      });

      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('already exists');
      expect(body.waybill).toBeTruthy();
    });

    test('should update Delhivery shipment', async () => {
      test.skip(!delhiveryOrderId, 'No existing Delhivery order');

      const res = await apiContext.patch(`/api/orders/${delhiveryOrderId}/shipment`, {
        headers: authHeaders(),
        data: { weight: 600 },
      });

      const body = await res.json();
      const status = res.status();

      if (status === 422 || status === 502) {
        console.log('Delhivery rejected edit:', body.error);
        expect(body.error).toBeTruthy();
        return;
      }

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    test('should generate a shipping label', async () => {
      test.skip(!delhiveryOrderId, 'No existing Delhivery order');

      const res = await apiContext.get(`/api/orders/${delhiveryOrderId}/shipment/label`, {
        headers: authHeaders(),
      });

      const body = await res.json();
      const status = res.status();

      if (status === 404 || status === 502) {
        console.log('Label not available:', body.error);
        return;
      }

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.waybill).toBeTruthy();
      if (body.pdf_download_link) {
        console.log('PDF link available');
        expect(body.pdf_download_link).toContain('http');
      }
    });

    test('should cancel Delhivery shipment', async () => {
      const useRealDelhivery = process.env.USE_REAL_DELHIVERY_TESTS === 'true';
      test.skip(!useRealDelhivery, 'Set USE_REAL_DELHIVERY_TESTS=true to run destructive cancel test');
      test.skip(!delhiveryOrderId, 'No existing Delhivery order');

      const res = await apiContext.post(`/api/orders/${delhiveryOrderId}/shipment/cancel`, {
        headers: authHeaders(),
        data: {},
      });

      const body = await res.json();
      const status = res.status();

      if (status === 422 || status === 502) {
        console.log('Delhivery rejected cancel:', body.error);
        expect(body.error).toBeTruthy();
        return;
      }

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      console.log('Cancelled shipment:', body.remark);
    });
  });
});
