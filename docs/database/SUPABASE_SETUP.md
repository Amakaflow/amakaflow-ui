# Supabase Setup Instructions

## 1. Database Setup

Run the SQL migration file in your Supabase SQL Editor:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Copy and paste the contents of `supabase/migrations/001_create_profiles_table.sql`
5. Click "Run" to execute the migration

This will create:
- `profiles` table for storing user data
- Row Level Security (RLS) policies
- Automatic profile creation trigger on user signup

## 2. Environment Variables

Create a `.env.local` file in the root of your project with:

```env
VITE_SUPABASE_URL=https://wdeqaibnwjekcyfpuple.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkZXFhaWJud2pla2N5ZnB1cGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MTIxODgsImV4cCI6MjA3ODk4ODE4OH0.sTKCbC9us92RdUjqEAs96LXp8COQBNHZa0UMHgghSss
```

**Note:** The `.env.local` file is gitignored for security. Make sure to add these variables to your deployment environment as well.

## 3. Authentication Settings

In your Supabase Dashboard:

1. Go to **Authentication** > **Settings**
2. Configure email settings:
   - Enable "Enable email confirmations" (optional, recommended for production)
   - Set up email templates if needed
3. Configure password requirements:
   - Minimum password length: 6 characters (default)

## 3.1. OAuth Provider Setup (Google & Apple)

### Google OAuth Setup

1. Go to **Authentication** > **Providers** in your Supabase Dashboard
2. Find **Google** and click to enable it
3. You'll need to create a Google OAuth application:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable Google+ API
   - Go to **Credentials** > **Create Credentials** > **OAuth client ID**
   - Choose **Web application**
   - Add authorized redirect URIs:
     - `https://wdeqaibnwjekcyfpuple.supabase.co/auth/v1/callback`
     - For local development: `http://localhost:3000` (Supabase will handle the callback)
   - Copy the **Client ID** and **Client Secret**
4. In Supabase, paste your Google **Client ID** and **Client Secret**
5. Save the configuration

### Apple OAuth Setup

1. Go to **Authentication** > **Providers** in your Supabase Dashboard
2. Find **Apple** and click to enable it
3. You'll need to create an Apple OAuth application:
   - Go to [Apple Developer Portal](https://developer.apple.com/)
   - Navigate to **Certificates, Identifiers & Profiles**
   - Create a new **Services ID** (if you don't have one)
   - Enable **Sign in with Apple**
   - Configure the redirect URL:
     - `https://wdeqaibnwjekcyfpuple.supabase.co/auth/v1/callback`
     - For local development: `http://localhost:3000` (Supabase will handle the callback)
   - Create a **Key** for Sign in with Apple
   - Download the key file (`.p8`)
4. In Supabase, you'll need:
   - **Services ID** (Client ID)
   - **Team ID** (found in your Apple Developer account)
   - **Key ID** (from the key you created)
   - **Private Key** (contents of the `.p8` file)
5. Paste all the information in Supabase and save

**Important:** Make sure to add your redirect URLs to both Google and Apple OAuth configurations.

## 4. Features Implemented

✅ Email/Password Sign Up
✅ Email/Password Sign In
✅ Google OAuth Sign In
✅ Apple OAuth Sign In
✅ Session Management
✅ User Profile Management
✅ Automatic Profile Creation
✅ Logout Functionality
✅ Protected Routes
✅ OAuth Callback Handling

## 5. Testing

1. Start the development server: `npm run dev`
2. Try signing up with a new account (email/password)
3. Test OAuth sign-in:
   - Click "Continue with Google" to test Google OAuth
   - Click "Continue with Apple" to test Apple OAuth
4. Check your email for verification (if enabled)
5. Sign in with your credentials
6. Test logout functionality

**Note:** OAuth providers must be configured in Supabase before testing OAuth sign-in.

## 6. Database Schema

The `profiles` table structure:

- `id` (UUID) - References auth.users
- `email` (TEXT) - User email
- `name` (TEXT) - User display name
- `subscription` (TEXT) - 'free', 'pro', or 'trainer'
- `workouts_this_week` (INTEGER) - Weekly workout count
- `selected_devices` (TEXT[]) - Array of device IDs
- `billing_date` (TIMESTAMPTZ) - Optional billing date
- `created_at` (TIMESTAMPTZ) - Creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

## 7. Security

- Row Level Security (RLS) is enabled
- Users can only access their own profile data
- All policies are scoped to authenticated users

