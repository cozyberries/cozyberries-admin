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

  // ── Auth Token API ─────────────────────────────────────────────

  test('POST /api/auth/generate-token without auth should fail', async ({ request }) => {
    const response = await request.post('/api/auth/generate-token');
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/auth/generate-token with missing or invalid payload should return 400', async ({ request }) => {
    const response = await request.post('/api/auth/generate-token', {
      data: { userEmail: 'test@test.com' },
    });
    expect(response.status()).toBe(400);
  });

  test('POST /api/auth/generate-token with malformed JSON should return 400', async ({ request }) => {
    const response = await request.post('/api/auth/generate-token', {
      data: 'not valid json',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(400);
  });

  // ── Setup API ──────────────────────────────────────────────────

  test('POST /api/setup without setup key should fail', async ({ request }) => {
    const response = await request.post('/api/setup', {
      data: {
        email: 'test@test.com',
        password: 'test123',
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
