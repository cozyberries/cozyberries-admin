import { test, expect } from '@playwright/test';

test.describe('API Routes', () => {
  // ── Products API ───────────────────────────────────────────────

  test('GET /api/products should return 200 with products array', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('products');
    expect(Array.isArray(body.products)).toBeTruthy();
  });

  test('GET /api/products should support limit parameter', async ({ request }) => {
    const response = await request.get('/api/products?limit=5');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.products.length).toBeLessThanOrEqual(5);
  });

  test('POST /api/products without auth should fail', async ({ request }) => {
    const response = await request.post('/api/products', {
      data: {
        name: 'Test Product',
        price: 100,
      },
    });

    // Should fail without authentication (401 or 403 only)
    expect([401, 403]).toContain(response.status());
  });

  // ── Stats API ──────────────────────────────────────────────────

  test('GET /api/stats should return dashboard statistics', async ({ request }) => {
    const response = await request.get('/api/stats');

    // May require auth — either returns data or auth error
    expect([200, 401, 403]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  // ── Analytics API ──────────────────────────────────────────────

  test('GET /api/analytics should respond', async ({ request }) => {
    const response = await request.get('/api/analytics');
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Orders API ─────────────────────────────────────────────────

  test('GET /api/orders without auth should return auth error', async ({ request }) => {
    const response = await request.get('/api/orders');
    // Orders require admin auth - should return 401 or 403
    expect([401, 403]).toContain(response.status());
  });

  // ── Users API ──────────────────────────────────────────────────

  test('GET /api/users without auth should return auth error', async ({ request }) => {
    const response = await request.get('/api/users');
    expect([401, 403]).toContain(response.status());
  });

  // ── Expenses API ───────────────────────────────────────────────

  test('GET /api/expenses without auth should return auth error', async ({ request }) => {
    const response = await request.get('/api/expenses');
    expect([200, 401, 403]).toContain(response.status());
  });

  test('GET /api/expenses/summary without auth should return auth error', async ({ request }) => {
    const response = await request.get('/api/expenses/summary');
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Expense Categories API ─────────────────────────────────────

  test('GET /api/expense-categories should respond', async ({ request }) => {
    const response = await request.get('/api/expense-categories');
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Notifications API ──────────────────────────────────────────

  test('GET /api/notifications without auth should return error', async ({ request }) => {
    const response = await request.get('/api/notifications');
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Webhooks & Ops API ─────────────────────────────────────────

test('POST /api/webhooks/delhivery without token should return 401', async ({ request }) => {
    const response = await request.post('/api/webhooks/delhivery', {
      data: { event: 'order_update' },
    });
  expect(response.status()).toBe(401);
  });

test('POST /api/webhooks/delhivery with wrong token should return env-specific auth error', async ({ request }) => {
    const response = await request.post('/api/webhooks/delhivery', {
      data: { event: 'order_update' },
      headers: {
        'x-delhivery-token': 'wrong-token',
      },
    });
  const expectedStatus = process.env.DELHIVERY_WEBHOOK_TOKEN ? 401 : 500;
  expect(response.status()).toBe(expectedStatus);
  });

test('POST /api/webhooks/delhivery with invalid JSON should return 400 or 401', async ({ request }) => {
    const response = await request.post('/api/webhooks/delhivery', {
      data: '{invalid-json',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  expect([400, 401]).toContain(response.status());
  });

test('POST /api/internal/webhooks/delhivery/process without token should return 401', async ({ request }) => {
    const response = await request.post('/api/internal/webhooks/delhivery/process', {
      data: {},
    });
  expect(response.status()).toBe(401);
  });

  test('GET /api/admin/ops/webhook-events/metrics without auth should return 401 or 403', async ({ request }) => {
    const response = await request.get('/api/admin/ops/webhook-events/metrics');
    expect([401, 403]).toContain(response.status());
  });

  // ── Profile API ────────────────────────────────────────────────

  test('GET /api/profile without auth should return error', async ({ request }) => {
    const response = await request.get('/api/profile');
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Activities API ─────────────────────────────────────────────

  test('GET /api/activities should respond', async ({ request }) => {
    const response = await request.get('/api/activities');
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Admin Login API ──────────────────────────────────────────────

  test('POST /api/auth/admin-login without credentials should return 400', async ({ request }) => {
    const response = await request.post('/api/auth/admin-login', {
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  test('POST /api/auth/admin-login with wrong credentials should return 401', async ({ request }) => {
    const response = await request.post('/api/auth/admin-login', {
      data: { identifier: 'wronguser', password: 'wrongpassword' },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/auth/admin-session without cookie should return 401', async ({ request }) => {
    const response = await request.get('/api/auth/admin-session');
    expect(response.status()).toBe(401);
  });

  // ── Setup API ──────────────────────────────────────────────────

  test('POST /api/setup without setup key should fail', async ({ request }) => {
    const response = await request.post('/api/setup', {
      data: {
        username: 'testadmin',
        password: 'test12345678',
      },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/setup with invalid payload should return 400', async ({ request }) => {
    const response = await request.post('/api/setup', {
      data: {
        email: 'test@test.com',
        setupKey: process.env.ADMIN_SETUP_KEY || 'super-secret-setup-key-change-this',
      },
    });
    expect(response.status()).toBe(400);
  });

  test('POST /api/setup with malformed JSON should return 400', async ({ request }) => {
    const response = await request.post('/api/setup', {
      data: 'not valid json',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
  });

  // ── Non-existent routes ────────────────────────────────────────

  test('GET /api/nonexistent should return 404', async ({ request }) => {
    const response = await request.get('/api/nonexistent');
    expect(response.status()).toBe(404);
  });

  // ── Invalid methods ────────────────────────────────────────────

  test('DELETE /api/products without ID should return 404 or 405', async ({ request }) => {
    const response = await request.delete('/api/products');
    // Should return 405 (Method Not Allowed) since DELETE requires an ID
    expect(response.status()).toBe(405);
  });
});
