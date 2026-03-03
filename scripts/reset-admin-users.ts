/**
 * Deletes all admin_users and creates a single admin from TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD.
 * Run with: npx dotenv -e .env.local -- npx tsx scripts/reset-admin-users.ts
 */
import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

if (!TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD) {
  console.error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD in .env.local');
  process.exit(1);
}

async function resetAdminUsers() {
  const email = TEST_ADMIN_EMAIL;
  const password = TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD');
    process.exit(1);
  }

  const { createAdminSupabaseClient } = await import('../lib/supabase-server');
  const { createAdmin } = await import('../lib/admin-auth');

  const supabase = createAdminSupabaseClient();

  const { data: existingRows, error: fetchError } = await supabase
    .from('admin_users')
    .select('id');

  if (fetchError) {
    console.error('Failed to fetch admin_users:', fetchError.message);
    process.exit(1);
  }

  if (existingRows && existingRows.length > 0) {
    const ids = existingRows.map((r) => r.id);
    const { error: deleteError } = await supabase
      .from('admin_users')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('Failed to delete admin_users:', deleteError.message);
      process.exit(1);
    }
    console.log(`Removed ${ids.length} admin user(s).`);
  } else {
    console.log('No existing admin_users to remove.');
  }

  const username = email.split('@')[0] || 'admin';
  const result = await createAdmin({
    username,
    password,
    email,
    full_name: 'Administrator',
    role: 'super_admin',
  });

  if (!result.success) {
    console.error('Failed to create admin:', result.error);
    process.exit(1);
  }

  console.log(`Admin created: ${email}. Use TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD from .env.local to log in.`);
}

resetAdminUsers();
