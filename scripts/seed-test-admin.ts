/**
 * Seeds or updates the test admin user from TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD.
 * Run with: npx dotenv -e .env.local -- npx tsx scripts/seed-test-admin.ts
 * Or: node --env-file=.env.local --import tsx scripts/seed-test-admin.ts (Node 20+)
 *
 * This ensures login with your .env.local test credentials works against the admin_users table.
 */
import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.local before any app code that reads process.env
config({ path: resolve(process.cwd(), '.env.local') });

const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

if (!TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD) {
  console.error(
    'Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD in .env.local. Add them and run again.'
  );
  process.exit(1);
}

async function seedTestAdmin() {
  const email = TEST_ADMIN_EMAIL;
  const password = TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD');
    process.exit(1);
  }

  const { createAdminSupabaseClient } = await import('../lib/supabase-server');
  const { hashPassword, createAdmin } = await import('../lib/admin-auth');

  const supabase = createAdminSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from('admin_users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (fetchError) {
    console.error('Failed to check existing admin:', fetchError.message);
    process.exit(1);
  }

  if (existing) {
    const password_hash = await hashPassword(password);
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (updateError) {
      console.error('Failed to update test admin password:', updateError.message);
      process.exit(1);
    }
    console.log(`Test admin password updated for ${email}. You can log in with .env.local credentials.`);
    return;
  }

  const username = email.split('@')[0] || 'testadmin';
  const result = await createAdmin({
    username,
    password,
    email,
    full_name: 'Test Administrator',
    role: 'super_admin',
  });

  if (!result.success) {
    if (result.error?.includes('already exists')) {
      console.log('An admin with that username already exists. Updating by email instead.');
      const { data: byEmail } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (byEmail) {
        const password_hash = await hashPassword(password);
        await supabase
          .from('admin_users')
          .update({ password_hash, updated_at: new Date().toISOString() })
          .eq('id', byEmail.id);
        console.log(`Test admin password set for ${email}. You can log in with .env.local credentials.`);
        return;
      }
    }
    console.error('Failed to create test admin:', result.error);
    process.exit(1);
  }

  console.log(`Test admin created: ${email}. You can log in with .env.local credentials.`);
}

seedTestAdmin();
