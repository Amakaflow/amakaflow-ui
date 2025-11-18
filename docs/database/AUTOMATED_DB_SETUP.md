# Automated Database Setup

## Important: This is a ONE-TIME setup

The database migration only needs to be run **once** when you first set up the project. After that:
- ✅ New users automatically get profiles (via database trigger)
- ✅ No manual intervention needed
- ✅ Everything is automated

## Quick One-Time Setup

Since this is only needed once, here's the fastest way:

### Option 1: Use Supabase Dashboard (Fastest - 2 minutes)

1. Go to: https://supabase.com/dashboard/project/wdeqaibnwjekcyfpuple/sql/new
2. Open the file: `supabase/migrations/001_create_profiles_table.sql`
3. Copy all the SQL
4. Paste into Supabase SQL Editor
5. Click "Run"
6. Done! ✅

**That's it - you'll never need to do this again!**

### Option 2: Use Supabase CLI (If you prefer automation)

Install Supabase CLI (choose one method):

**Via Homebrew (macOS):**
```bash
brew install supabase/tap/supabase
```

**Via npm:**
```bash
npm install -g supabase
```

Then:
```bash
supabase login
supabase link --project-ref wdeqaibnwjekcyfpuple
npm run db:push
```

## Option 3: Supabase Dashboard (One-Time Manual)

If you prefer not to use CLI, you only need to do this **once**:

1. Go to: https://supabase.com/dashboard/project/wdeqaibnwjekcyfpuple/sql/new
2. Copy the SQL from `supabase/migrations/001_create_profiles_table.sql`
3. Paste and click "Run"
4. Done! ✅

After this one-time setup, all new users will automatically get profiles created.

## Option 4: Add to Project Setup Script

You can add this to your project's setup instructions so new developers know to run it once.

## What Happens After Setup?

Once the migration is run:
- ✅ `profiles` table is created
- ✅ New users automatically get profiles (via database trigger)
- ✅ No manual intervention needed for new signups
- ✅ Existing users can be migrated with a simple SQL query (one-time)

## For Existing Users

If you have users who signed up before the migration, run this **once**:

```sql
INSERT INTO profiles (id, email, name)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)) as name
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);
```

## Recommendation

**Use Option 2 (Supabase CLI)** if you want fully automated migrations. Otherwise, **Option 3** is fine since it's only needed once per database.

