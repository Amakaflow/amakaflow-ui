# Create Profiles Table in Supabase

If you're not seeing the `profiles` table, you need to run the database migration. Here's how:

## Step-by-Step Instructions

### 1. Go to Supabase SQL Editor

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `wdeqaibnwjekcyfpuple`
3. Click on **"SQL Editor"** in the left sidebar
4. Click **"New query"** button

### 2. Copy and Paste the Migration SQL

Copy the entire contents of the file `supabase/migrations/001_create_profiles_table.sql` and paste it into the SQL Editor.

Or copy this SQL directly:

```sql
-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  subscription TEXT DEFAULT 'free' CHECK (subscription IN ('free', 'pro', 'trainer')),
  workouts_this_week INTEGER DEFAULT 0,
  selected_devices TEXT[] DEFAULT ARRAY['garmin'],
  billing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Create policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
```

### 3. Run the Migration

1. Click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
2. You should see a success message: "Success. No rows returned"

### 4. Verify the Table Was Created

1. Go to **"Table Editor"** in the left sidebar
2. You should now see **"profiles"** in the table list
3. Click on it to view the table structure

### 5. Check if Profiles Exist

If you already have users, you can check if profiles were created:

1. Go to **"SQL Editor"**
2. Run this query:

```sql
SELECT * FROM profiles;
```

If no profiles exist yet, they will be created automatically when:
- A new user signs up
- Or you can manually create one for existing users

## Create Profile for Existing Users

If you have existing users in `auth.users` but no profiles, you can create profiles for them:

```sql
INSERT INTO profiles (id, email, name)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)) as name
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);
```

## Troubleshooting

### "Table already exists" error
- This means the table was already created
- You can skip the CREATE TABLE part and just run the policies/trigger parts

### "Permission denied" error
- Make sure you're logged in as the project owner
- Check that you have the correct permissions

### Still not seeing the table
- Refresh the Table Editor page
- Check that you're in the correct project
- Verify the SQL ran successfully (check for errors in the SQL Editor)

## What This Migration Creates

✅ `profiles` table with all user data fields
✅ Row Level Security (RLS) policies
✅ Automatic profile creation trigger (creates profile when user signs up)
✅ Index on email for faster lookups

