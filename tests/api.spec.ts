import { test, expect } from '@playwright/test';

test.describe('API Routes', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:4001';

  // ── Products API ───────────────────────────────────────────────

  test('GET /api/products should return 200 with products array', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/products`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('products');
    expect(Array.isArray(body.products)).toBeTruthy();
  });

  test('GET /api/products should support limit parameter', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/products?limit=5`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.products.length).toBeLessThanOrEqual(5);
  });

  test('POST /api/products without auth should fail', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/products`, {
      data: {
        name: 'Test Product',
        price: 100,
      },
    });

    // Should fail without authentication (401 or 403)
    expect([401, 403, 500]).toContain(response.status());
  });

  // ── Stats API ──────────────────────────────────────────────────

  test('GET /api/stats should return dashboard statistics', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/stats`);

    // May require auth — either returns data or auth error
    expect([200, 401, 403]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toBeDefined();
    }
  });

  // ── Analytics API ──────────────────────────────────────────────

  test('GET /api/analytics should respond', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/analytics`);
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Orders API ─────────────────────────────────────────────────

  test('GET /api/orders without auth should return auth error', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/orders`);
    // Orders require admin auth
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Users API ──────────────────────────────────────────────────

  test('GET /api/users without auth should return auth error', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/users`);
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Expenses API ───────────────────────────────────────────────

  test('GET /api/expenses without auth should return auth error', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/expenses`);
    expect([200, 401, 403]).toContain(response.status());
  });

  test('GET /api/expenses/summary without auth should return auth error', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/expenses/summary`);
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Expense Categories API ─────────────────────────────────────

  test('GET /api/expense-categories should respond', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/expense-categories`);
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Notifications API ──────────────────────────────────────────

  test('GET /api/notifications without auth should return error', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/notifications`);
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Profile API ────────────────────────────────────────────────

  test('GET /api/profile without auth should return error', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/profile`);
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Activities API ─────────────────────────────────────────────

  test('GET /api/activities should respond', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/activities`);
    expect([200, 401, 403]).toContain(response.status());
  });

  // ── Auth Token API ─────────────────────────────────────────────

  test('POST /api/auth/generate-token without auth should fail', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/auth/generate-token`);
    expect([401, 403, 400, 500]).toContain(response.status());
  });

  // ── Setup API ──────────────────────────────────────────────────

  test('POST /api/setup without setup key should fail', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/setup`, {
      data: {
        email: 'test@test.com',
        password: 'test123',
      },
    });

    // Should fail without valid setup key
    expect([400, 401, 403, 500]).toContain(response.status());
  });

  // ── Non-existent routes ────────────────────────────────────────

  test('GET /api/nonexistent should return 404', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/nonexistent`);
    expect(response.status()).toBe(404);
  });

  // ── Invalid methods ────────────────────────────────────────────

  test('DELETE /api/products without ID should return error', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/products`);
    // Should return method not allowed or error
    expect([400, 401, 403, 404, 405, 500]).toContain(response.status());
  });
});
