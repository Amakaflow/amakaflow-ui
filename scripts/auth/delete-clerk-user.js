/**
 * Delete a user from Clerk and Supabase
 * 
 * Usage:
 *   node delete-clerk-user.js <clerk-user-id>
 * 
 * Or delete by email:
 *   node delete-clerk-user.js --email <email>
 * 
 * This script requires:
 * - CLERK_SECRET_KEY in .env.local (get from Clerk Dashboard > API Keys > Secret Key)
 * - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 */

require('dotenv').config({ path: '.env.local' });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!CLERK_SECRET_KEY) {
  console.error('❌ CLERK_SECRET_KEY not found in .env.local');
  console.error('   Get it from: Clerk Dashboard > API Keys > Secret Key');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase credentials not found in .env.local');
  process.exit(1);
}

const userId = process.argv[2];
const emailFlag = process.argv[2] === '--email';
const email = process.argv[3];

if (!userId && !emailFlag) {
  console.error('Usage:');
  console.error('  node delete-clerk-user.js <clerk-user-id>');
  console.error('  node delete-clerk-user.js --email <email>');
  process.exit(1);
}

async function deleteUser() {
  try {
    let clerkUserId = userId;

    // If deleting by email, first find the user ID
    if (emailFlag && email) {
      console.log(`🔍 Looking up user by email: ${email}...`);
      
      // Search in Supabase profiles first
      const profileResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (profileResponse.ok) {
        const profiles = await profileResponse.json();
        if (profiles.length > 0) {
          clerkUserId = profiles[0].id;
          console.log(`✅ Found user ID: ${clerkUserId}`);
        } else {
          console.log('⚠️  User not found in Supabase profiles');
        }
      }

      // Also try to find in Clerk (requires Clerk API)
      if (!clerkUserId) {
        console.log('⚠️  Note: To search Clerk by email, use the Clerk Dashboard');
        console.log('   This script can only delete if you provide the Clerk user ID');
        process.exit(1);
      }
    }

    if (!clerkUserId) {
      console.error('❌ User ID is required');
      process.exit(1);
    }

    console.log(`\n🗑️  Deleting user: ${clerkUserId}\n`);

    // Step 1: Delete from Supabase profiles
    console.log('1️⃣  Deleting from Supabase profiles...');
    const deleteProfileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${clerkUserId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (deleteProfileResponse.ok) {
      console.log('   ✅ Profile deleted from Supabase');
    } else {
      const error = await deleteProfileResponse.text();
      console.log(`   ⚠️  Supabase deletion: ${error}`);
    }

    // Step 2: Delete from Clerk
    console.log('2️⃣  Deleting from Clerk...');
    const deleteClerkResponse = await fetch(
      `https://api.clerk.com/v1/users/${clerkUserId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (deleteClerkResponse.ok) {
      console.log('   ✅ User deleted from Clerk');
    } else {
      const error = await deleteClerkResponse.text();
      console.log(`   ❌ Clerk deletion failed: ${error}`);
      console.log('\n💡 Tip: You can also delete users manually from:');
      console.log('   https://dashboard.clerk.com → Users → Select user → Delete');
    }

    console.log('\n✅ Deletion process complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteUser();

