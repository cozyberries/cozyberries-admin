# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## This Repo's Role

This is the **internal admin portal** for CozyBerries (admin.cozyberries.com, port 4000).
Admins manage products, orders, users, expenses, shipping (Delhivery), analytics, and webhook processing here.

The **public storefront** lives in a sibling repo: `../vercel-frontend/` (cozyberries.com, port 3000).
That app handles customer-facing browsing, cart, checkout, UPI payments, and order tracking.
Admin-only operations (shipment creation, bulk updates, user role assignment) must NOT be added to the storefront.

## Commands

```bash
# Development (port 4000 — avoids conflict with storefront on 3000)
npm run dev

# Build & Production
npm run build
npm run start

# Code Quality
npm run lint

# Testing (Playwright)
npm test
npm run test:ui
npm run test:headed
npm run test:debug

# Scripts
npm run seed:test-admin
npm run reset:admin-users
npm run qstash:schedule-delhivery
```

## Architecture

### Stack
- **Next.js 15** App Router with TypeScript
- **Supabase** — Auth (SSR) + PostgreSQL (same project as storefront)
- **TanStack Query v5** + Axios for data fetching
- **shadcn/ui** + Tailwind CSS for UI
- **Cloudinary** for image upload and management
- **Upstash Redis** + QStash for caching and background job scheduling
- **Recharts** for analytics dashboards
- **jsonwebtoken** for admin-specific JWT sessions

### Route Structure

```
app/
  /                  # Dashboard — analytics overview
  /login             # Admin login (separate from storefront auth)
  /setup             # First-time admin creation (protected by ADMIN_SETUP_KEY)
  /orders            # Order management
  /products          # Product CRUD
  /users             # User management
  /expenses          # Expense tracking and analytics
  /api/products/*
  /api/orders/*
  /api/expenses/*
  /api/expense-categories/*
  /api/analytics
  /api/payments/*
  /api/profile/*     # Uses SUPABASE_SERVICE_ROLE_KEY for privileged user writes
  /api/categories
  /api/notifications
  /api/activities
  /api/admin/shipping/delhivery/tracking
  /api/admin/ops/webhook-events/metrics
  /api/auth/admin-login
  /api/auth/admin-logout
  /api/create-admin
  /api/setup
```

### Auth Flow
- Separate JWT-based session (`JWT_SECRET`) — does NOT reuse the storefront Supabase SSR session.
- `lib/admin-auth.ts` — JWT verification middleware for admin API routes.
- `lib/jwt-auth.ts` — JWT signing/parsing utilities.
- Only `admin` and `super_admin` roles (from `auth.users.app_metadata.role`) may access.
- `SUPABASE_SERVICE_ROLE_KEY` used server-side for privileged operations (role assignment, cross-user lookup).

### Secrets (admin-only — must NOT appear in storefront)
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `ADMIN_SETUP_KEY`
- `CLOUDINARY_API_SECRET`
- `DELHIVERY_API_KEY`
- `UPI_ID`, `UPI_PAYEE_NAME`

### Shared Secrets (also in storefront)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### Webhook Processing (Delhivery + QStash)
- `lib/services/webhook-processor.ts` — processes incoming Delhivery webhook events.
- `lib/services/delhivery-webhook.ts` — parses Delhivery payloads, updates `orders.tracking_number` and notification records.
- QStash schedule: `scripts/qstash-upsert-delhivery-processor-schedule.ts`
- Webhook events stored in `webhook_events` table (see `database/migrations/20260401_create_webhook_events.sql`).

### Key Conventions
- All privileged DB writes use `SUPABASE_SERVICE_ROLE_KEY` server-side.
- Rate limiting via `lib/rate-limit.ts` on sensitive endpoints (login, setup).
- `lib/types/` for TypeScript types, `lib/services/` for business logic, `hooks/` for React Query hooks.
- Shipment creation and tracking updates live here — the storefront only reads `tracking_number` from orders.
