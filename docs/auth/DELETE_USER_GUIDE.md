# How to Delete Users Before Testing

This guide explains how to delete users from both Clerk and Supabase before testing the new Clerk authentication.

## Option 1: Delete via Clerk Dashboard (Easiest)

### Steps:

1. **Go to Clerk Dashboard**
   - Visit: https://dashboard.clerk.com
   - Sign in to your account

2. **Navigate to Users**
   - Click on **"Users"** in the left sidebar
   - You'll see a list of all users

3. **Delete a User**
   - Click on the user you want to delete
   - Scroll down to find the **"Delete User"** button
   - Confirm the deletion

**Note:** Deleting from Clerk will remove the user from Clerk, but you may still need to delete their profile from Supabase separately.

---

## Option 2: Delete via Supabase Dashboard

If you have old users from the previous Supabase auth setup:

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on **"SQL Editor"** in the left sidebar
   - Click **"New query"**

3. **Delete User Profile**
   ```sql
   -- Delete a specific user by email
   DELETE FROM profiles WHERE email = 'user@example.com';
   
   -- Or delete by ID
   DELETE FROM profiles WHERE id = 'user-id-here';
   
   -- ⚠️ WARNING: Delete ALL profiles (use with caution!)
   -- DELETE FROM profiles;
   ```

4. **Run the Query**
   - Click **"Run"** to execute

---

## Option 3: Use the Helper Script

A helper script is available to delete users from both Clerk and Supabase:

### Prerequisites:

1. **Get Clerk Secret Key**
   - Go to Clerk Dashboard → **API Keys**
   - Copy your **Secret Key** (not the Publishable Key)
   - Add it to `.env.local`:
     ```env
     CLERK_SECRET_KEY=sk_test_...
     ```

2. **Run the Script**

   **Delete by Clerk User ID:**
   ```bash
   node delete-clerk-user.js <clerk-user-id>
   ```

   **Delete by Email:**
   ```bash
   node delete-clerk-user.js --email user@example.com
   ```

### Example:

```bash
# Delete by email
node delete-clerk-user.js --email test@example.com

# Delete by Clerk user ID
node delete-clerk-user.js user_2abc123xyz
```

---

## Option 4: Manual SQL Query (Supabase Only)

If you just want to clean up Supabase profiles:

1. **Open Supabase SQL Editor**
2. **Run this query to see all users:**
   ```sql
   SELECT id, email, name, created_at 
   FROM profiles 
   ORDER BY created_at DESC;
   ```

3. **Delete specific user:**
   ```sql
   DELETE FROM profiles WHERE email = 'user@example.com';
   ```

4. **Or delete all profiles (fresh start):**
   ```sql
   TRUNCATE TABLE profiles;
   ```

---

## Quick Start: Fresh Testing Environment

To start completely fresh:

1. **Delete all Clerk users:**
   - Clerk Dashboard → Users → Select all → Delete

2. **Delete all Supabase profiles:**
   - Supabase Dashboard → SQL Editor:
     ```sql
     TRUNCATE TABLE profiles;
     ```

3. **Restart your dev server:**
   ```bash
   npm run dev
   ```

4. **Sign up as a new user** through Clerk's sign-up UI

---

## Important Notes

- **Clerk User ID ≠ Supabase User ID**: With Clerk, the user ID in Supabase `profiles` table is the Clerk user ID, not a Supabase auth user ID.

- **Cascade Deletion**: If you delete a user from Clerk, you should also delete their profile from Supabase to keep data clean.

- **Testing**: After deleting, you can sign up again with the same email address (Clerk will create a new user).

---

## Troubleshooting

### "User not found" in Clerk Dashboard
- The user might have been deleted already
- Check if you're looking in the correct Clerk application

### "Profile still exists in Supabase"
- Manually delete it via SQL Editor or use the helper script

### "Can't delete from Clerk"
- Make sure you're using the correct Clerk application
- Check that you have admin permissions
- Use the Clerk Dashboard for manual deletion

