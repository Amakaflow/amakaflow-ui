/**
 * ============================================================================
 * Delete User Account Script
 * ============================================================================
 * 
 * This script deletes a user account from Supabase (for testing purposes).
 * 
 * HOW TO USE:
 * 1. Make sure you have your Supabase credentials in .env.local
 * 2. Run: node delete-user.js your-email@example.com
 * 
 * WARNING: This permanently deletes the user and all their data!
 * ============================================================================
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ ERROR: VITE_SUPABASE_URL not found in .env.local');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  console.error('   You need the Service Role Key (not the anon key) to delete users.');
  console.error('   Find it in: Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

const email = process.argv[2];

if (!email) {
  console.error('❌ ERROR: Please provide an email address');
  console.error('   Usage: node delete-user.js your-email@example.com');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function deleteUser() {
  try {
    console.log(`\n🔍 Looking for user: ${email}\n`);

    // Find user by email
    const { data: users, error: findError } = await supabase.auth.admin.listUsers();
    
    if (findError) {
      throw findError;
    }

    const user = users.users.find(u => u.email === email);

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})\n`);

    // Delete user (this will cascade delete the profile)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      throw deleteError;
    }

    console.log('✅ User deleted successfully!');
    console.log(`\n📝 You can now sign up again with: ${email}\n`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

deleteUser();

