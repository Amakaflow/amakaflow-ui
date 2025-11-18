# Delete User Account - Testing Guide

## Option 1: Delete via Supabase Dashboard (Easiest)

### Step 1: Delete from Authentication
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/wdeqaibnwjekcyfpuple/auth/users
2. Find your user (search by email)
3. Click on the user
4. Click the **"Delete user"** button (usually at the bottom)
5. Confirm deletion

**Note:** This will automatically delete the profile due to CASCADE foreign key.

### Step 2: Verify Deletion
1. Go to **Table Editor** → **profiles**
2. Verify your profile is gone (it should be deleted automatically)

## Option 2: Delete via SQL (Quick)

1. Go to **SQL Editor** in Supabase Dashboard
2. Run this query (replace with your email):

```sql
-- Delete user by email (this will cascade delete the profile)
DELETE FROM auth.users 
WHERE email = 'your-email@gmail.com';
```

## Option 3: Delete All Test Users (Clean Slate)

If you want to delete all users and start fresh:

```sql
-- WARNING: This deletes ALL users and profiles!
DELETE FROM auth.users;
```

## Option 4: Create a Delete Script

I can create a script to delete users programmatically if you prefer.

## After Deletion

Once deleted, you can:
1. Sign up again with the same email
2. Test the profile completion flow
3. See the new profile completion screen

## Important Notes

- Deleting from `auth.users` automatically deletes the profile (CASCADE)
- You can sign up again with the same email after deletion
- All user data (workout history, etc.) will be deleted
- This is safe for testing/development

