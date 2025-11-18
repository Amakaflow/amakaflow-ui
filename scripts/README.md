# Utility Scripts

This directory contains utility scripts organized by purpose. These scripts help with setup, maintenance, and testing tasks.

## 📁 Directory Structure

### `/auth` - Authentication Scripts
- **delete-clerk-user.js** - Delete a user from both Clerk and Supabase
  - Usage: `node scripts/auth/delete-clerk-user.js <clerk-user-id>`
  - Or by email: `node scripts/auth/delete-clerk-user.js --email user@example.com`
  - Requires: `CLERK_SECRET_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local`

- **delete-user.js** - Delete a user from Supabase (legacy, for Supabase Auth)
  - Usage: `node scripts/auth/delete-user.js your-email@example.com`
  - Requires: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### `/oauth` - OAuth Scripts
- **generate-apple-jwt.js** - Generate JWT token for Apple OAuth
  - Usage: `node scripts/oauth/generate-apple-jwt.js`
  - Edit the script to add your Apple Developer credentials
  - Outputs a JWT token to paste into Supabase Apple OAuth configuration

### `/database` - Database Scripts
- **setup-database.js** - Automated database setup via Supabase API
  - Usage: `node scripts/database/setup-database.js`
  - Requires: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
  - Automatically creates profiles table and RLS policies

## 🔧 Prerequisites

All scripts require Node.js and access to your `.env.local` file with the appropriate credentials.

### Required Environment Variables

**For Auth Scripts:**
```env
# Clerk
CLERK_SECRET_KEY=sk_test_...

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # For delete-user.js and setup-database.js
```

**For OAuth Scripts:**
- Edit `generate-apple-jwt.js` directly to add your Apple Developer credentials

## 📝 Usage Examples

### Delete a Clerk User
```bash
# By user ID
node scripts/auth/delete-clerk-user.js user_2abc123xyz

# By email
node scripts/auth/delete-clerk-user.js --email test@example.com
```

### Generate Apple JWT Token
```bash
# 1. Edit scripts/oauth/generate-apple-jwt.js with your credentials
# 2. Run the script
node scripts/oauth/generate-apple-jwt.js
# 3. Copy the output token to Supabase Dashboard
```

### Setup Database
```bash
node scripts/database/setup-database.js
```

## ⚠️ Warnings

- **User deletion scripts permanently delete user data** - Use with caution
- **Database setup scripts modify your database schema** - Backup first if needed
- Always verify your `.env.local` has the correct credentials before running scripts

## 🔗 Related Documentation

- Authentication: See [`../docs/auth/`](../docs/auth/)
- OAuth: See [`../docs/oauth/`](../docs/oauth/)
- Database: See [`../docs/database/`](../docs/database/)

