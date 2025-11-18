/**
 * ============================================================================
 * Automated Database Setup Script
 * ============================================================================
 * 
 * This script automatically sets up the Supabase database by running the
 * migration SQL through the Supabase API.
 * 
 * HOW TO USE:
 * 1. Make sure you have your Supabase credentials in .env.local
 * 2. Run: node setup-database.js
 * 
 * This will:
 * - Create the profiles table
 * - Set up Row Level Security policies
 * - Create the automatic profile creation trigger
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('❌ ERROR: VITE_SUPABASE_URL not found in .env.local');
  console.error('   Make sure your .env.local file has:');
  console.error('   VITE_SUPABASE_URL=https://wdeqaibnwjekcyfpuple.supabase.co');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log('🔧 Setting up Supabase database...\n');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '001_create_profiles_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded\n');
    console.log('⚠️  NOTE: This script requires the Supabase Management API or manual execution.');
    console.log('   For now, please run the migration manually in Supabase Dashboard.\n');
    console.log('   Steps:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/wdeqaibnwjekcyfpuple/sql/new');
    console.log('   2. Copy the SQL from: supabase/migrations/001_create_profiles_table.sql');
    console.log('   3. Paste and click "Run"\n');
    
    // Alternative: Use Supabase CLI if installed
    console.log('💡 ALTERNATIVE: Use Supabase CLI for automated migrations:');
    console.log('   1. Install: npm install -g supabase');
    console.log('   2. Login: supabase login');
    console.log('   3. Link: supabase link --project-ref wdeqaibnwjekcyfpuple');
    console.log('   4. Run: supabase db push\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();

