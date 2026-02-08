# Database Migrations

This directory contains SQL migrations for the Cozyberries Admin application.

## How to Apply Migrations

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file you want to apply
4. Paste it into the SQL Editor
5. Click "Run" to execute the migration

### Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Apply a specific migration
supabase db execute --file database/migrations/ensure_single_default_address.sql

# Or apply all pending migrations
supabase db push
```

## Migrations

### ensure_single_default_address.sql

Creates a PostgreSQL function that atomically inserts a new address and ensures only one default address exists per user. This prevents race conditions when multiple requests try to set addresses as default simultaneously.

**Purpose:** Fixes race condition in POST /api/profile/addresses endpoint.

**What it does:**
- If `is_default` is true, clears all other default addresses for the user
- Inserts the new address
- Returns the newly created address
- All operations happen in a single transaction

**Required for:** The address creation endpoint to work correctly with the new RPC implementation.

## Important Notes

- Always test migrations in a development environment first
- Back up your database before applying migrations in production
- The `ensure_single_default_address` function requires a `user_addresses` table with the following columns:
  - id (UUID)
  - user_id (UUID)
  - address_type (TEXT)
  - label (TEXT)
  - full_name (TEXT)
  - phone (TEXT)
  - address_line_1 (TEXT)
  - address_line_2 (TEXT)
  - city (TEXT)
  - state (TEXT)
  - postal_code (TEXT)
  - country (TEXT)
  - is_default (BOOLEAN)
  - is_active (BOOLEAN)
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)
