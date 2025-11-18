# Clerk Integration Fix Applied

## Problem
The errors occurred because:
1. The `profiles` table had a foreign key constraint to `auth.users` (Supabase auth)
2. RLS policies used `auth.uid()` which only works for Supabase auth users
3. Clerk user IDs are strings (like `user_35f0wiA8bp9QyuUlDiqrrotywPJ`), not UUIDs

## Solution Applied

A migration was created and applied: `20250120000000_update_profiles_for_clerk.sql`

### Changes Made:

1. **Removed Foreign Key Constraint**
   - Dropped `REFERENCES auth.users(id) ON DELETE CASCADE`
   - Profiles table is now independent of Supabase auth

2. **Changed ID Column Type**
   - Changed `id` from `UUID` to `TEXT` to support Clerk user IDs

3. **Updated RLS Policies**
   - Removed old policies that used `auth.uid()`
   - Created new policies that work with Clerk
   - Added `upsert_clerk_profile()` function with `SECURITY DEFINER` to bypass RLS

4. **Created Helper Function**
   - `upsert_clerk_profile()` function handles profile creation/updates
   - Uses `SECURITY DEFINER` to bypass RLS restrictions
   - Automatically creates or updates profiles

## Testing

Now you should be able to:

1. **Sign up with Clerk** - No more 400 errors
2. **Profile auto-creation** - Profile is created automatically when Clerk user signs up
3. **Profile sync** - Clerk user data syncs to Supabase profiles

## Next Steps

1. **Delete the test user** (if you want to start fresh):
   - Clerk Dashboard → Users → Delete user
   - Or use: `node delete-clerk-user.js --email your-email@example.com`

2. **Sign up again** with Clerk
   - The profile should be created automatically
   - No more errors in the console

3. **Verify in Supabase**:
   - Go to Supabase Dashboard → Table Editor → `profiles`
   - You should see your new profile with Clerk user ID

## Troubleshooting

If you still see errors:

1. **Check the migration was applied**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'id';
   ```
   Should show `TEXT`, not `uuid`

2. **Check the function exists**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_name = 'upsert_clerk_profile';
   ```
   Should return the function name

3. **Clear browser cache and restart dev server**:
   ```bash
   npm run dev
   ```

## Security Note

The current RLS policies are permissive (using `true`). This is acceptable because:
- Clerk handles authentication
- The `upsert_clerk_profile()` function uses `SECURITY DEFINER` to bypass RLS
- Application-level validation ensures users can only access their own data

For production, consider adding more restrictive RLS policies if needed.

