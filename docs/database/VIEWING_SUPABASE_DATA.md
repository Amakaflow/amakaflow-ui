# Viewing Data in Supabase

## What Data is Saved in Supabase?

Supabase stores two main types of data for your application:

### 1. Authentication Data (`auth.users` table)
- **User ID** (UUID) - Unique identifier for each user
- **Email** - User's email address
- **Encrypted password** (for email/password auth)
- **OAuth providers** - Google, Apple, etc.
- **Metadata** - Name, avatar URL, etc. from OAuth providers
- **Created/Updated timestamps**

### 2. User Profiles (`profiles` table)
- **id** (UUID) - References `auth.users(id)`
- **email** (TEXT) - User's email
- **name** (TEXT) - User's display name
- **subscription** (TEXT) - 'free', 'pro', or 'trainer'
- **workouts_this_week** (INTEGER) - Weekly workout count
- **selected_devices** (TEXT[]) - Array of device IDs (e.g., ['garmin', 'apple'])
- **billing_date** (TIMESTAMPTZ) - Optional billing date
- **created_at** (TIMESTAMPTZ) - When profile was created
- **updated_at** (TIMESTAMPTZ) - Last update timestamp

## How to View Your Data in Supabase Dashboard

### Method 1: View Authentication Users

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `wdeqaibnwjekcyfpuple`
3. Click on **"Authentication"** in the left sidebar
4. Click on **"Users"** tab
5. You'll see all authenticated users with:
   - User ID
   - Email
   - Created date
   - Last sign in
   - Auth providers (Email, Google, Apple, etc.)

### Method 2: View User Profiles (Table Editor)

1. Go to your Supabase Dashboard
2. Click on **"Table Editor"** in the left sidebar
3. Select **"profiles"** from the table list
4. You'll see all user profiles with all their data:
   - ID, email, name
   - Subscription tier
   - Workouts this week
   - Selected devices
   - Billing date
   - Created/updated timestamps

### Method 3: View Data Using SQL Editor

1. Go to **"SQL Editor"** in the left sidebar
2. Run these queries:

#### View all profiles:
```sql
SELECT * FROM profiles;
```

#### View profiles with subscription info:
```sql
SELECT 
  id,
  email,
  name,
  subscription,
  workouts_this_week,
  selected_devices,
  created_at
FROM profiles
ORDER BY created_at DESC;
```

#### View authentication users:
```sql
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC;
```

#### View profiles joined with auth users:
```sql
SELECT 
  p.id,
  p.email,
  p.name,
  p.subscription,
  p.workouts_this_week,
  p.selected_devices,
  u.created_at as user_created_at,
  u.last_sign_in_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
ORDER BY p.created_at DESC;
```

### Method 4: View Specific User Data

To view your own user data:

1. Go to **"SQL Editor"**
2. Run this query (replace `YOUR_EMAIL@example.com` with your email):

```sql
SELECT 
  p.*,
  u.email as auth_email,
  u.created_at as auth_created_at,
  u.last_sign_in_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.email = 'YOUR_EMAIL@example.com';
```

## What Gets Saved Automatically?

### On User Sign Up:
- ✅ User record in `auth.users` (automatic by Supabase)
- ✅ Profile record in `profiles` (automatic via database trigger)
  - Email from signup
  - Name from signup form or OAuth metadata
  - Default subscription: 'free'
  - Default workouts_this_week: 0
  - Default selected_devices: ['garmin']

### On User Sign In:
- ✅ `last_sign_in_at` updated in `auth.users` (automatic by Supabase)
- ✅ Profile data is fetched and displayed in the app

### When User Updates Profile:
- ✅ `updated_at` timestamp is updated
- ✅ Any changed fields (name, subscription, devices, etc.) are saved

## Security Notes

- **Row Level Security (RLS)** is enabled on the `profiles` table
- Users can only see and edit their own profile data
- As the project owner, you can view all data in the Supabase Dashboard
- Authentication data in `auth.users` is managed by Supabase

## Quick Access Links

- **Dashboard**: https://supabase.com/dashboard/project/wdeqaibnwjekcyfpuple
- **Authentication Users**: https://supabase.com/dashboard/project/wdeqaibnwjekcyfpuple/auth/users
- **Table Editor**: https://supabase.com/dashboard/project/wdeqaibnwjekcyfpuple/editor
- **SQL Editor**: https://supabase.com/dashboard/project/wdeqaibnwjekcyfpuple/sql/new

## Example Data Structure

Here's what a typical profile record looks like:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "name": "John Doe",
  "subscription": "free",
  "workouts_this_week": 0,
  "selected_devices": ["garmin"],
  "billing_date": null,
  "created_at": "2024-12-19T10:00:00Z",
  "updated_at": "2024-12-19T10:00:00Z"
}
```

