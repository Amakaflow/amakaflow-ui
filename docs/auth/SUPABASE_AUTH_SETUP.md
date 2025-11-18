# Supabase Authentication Setup Documentation

This document describes the complete Supabase authentication setup, including client configuration, Row Level Security (RLS) policies, database triggers, and authentication functions.

## Table of Contents

1. [Supabase Client Setup](#supabase-client-setup)
2. [Database Schema](#database-schema)
3. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
4. [Database Triggers](#database-triggers)
5. [Authentication Functions](#authentication-functions)
6. [Edge Functions](#edge-functions)
7. [OAuth Configuration](#oauth-configuration)
8. [Environment Variables](#environment-variables)

---

## Supabase Client Setup

### Client Configuration

**File:** `src/lib/supabase.ts`

The Supabase client is initialized with the following configuration:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,      // Automatically refresh expired tokens
    persistSession: true,        // Persist session in localStorage
    detectSessionInUrl: true,    // Detect OAuth callback in URL hash
  },
});
```

### Key Features

- **Auto-refresh tokens**: Automatically refreshes expired JWT tokens
- **Session persistence**: Stores session in browser localStorage
- **OAuth callback detection**: Automatically handles OAuth redirects from URL hash

---

## Database Schema

### Profiles Table

**Migration:** `supabase/migrations/20251117211547_create_profiles_table.sql`

The `profiles` table stores user-specific data:

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  subscription TEXT DEFAULT 'free' CHECK (subscription IN ('free', 'pro', 'trainer')),
  workouts_this_week INTEGER DEFAULT 0,
  selected_devices TEXT[] DEFAULT ARRAY[]::TEXT[],  -- Empty array by default
  billing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Points

- **Foreign Key**: `id` references `auth.users(id)` with `ON DELETE CASCADE`
  - When a user is deleted from `auth.users`, their profile is automatically deleted
- **Default Devices**: `selected_devices` defaults to empty array `ARRAY[]::TEXT[]`
  - This enforces profile completion for new users
- **Subscription Types**: Restricted to `'free'`, `'pro'`, or `'trainer'`

### Indexes

```sql
CREATE INDEX profiles_email_idx ON profiles(email);
```

---

## Row Level Security (RLS) Policies

**RLS is enabled** on the `profiles` table for security.

### Policy 1: Users can view their own profile

```sql
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);
```

**What it does:**
- Users can only SELECT (read) their own profile
- Uses `auth.uid()` to get the current authenticated user's ID
- Only returns rows where `id` matches the authenticated user

### Policy 2: Users can update their own profile

```sql
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

**What it does:**
- Users can only UPDATE their own profile
- Prevents users from modifying other users' profiles

### Policy 3: Users can insert their own profile

```sql
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

**What it does:**
- Users can only INSERT profiles with their own `id`
- Prevents users from creating profiles for other users
- Note: This is typically handled by the trigger, but the policy ensures security

### RLS Summary

All three policies use the same pattern: `auth.uid() = id`

This ensures:
- ✅ Users can only access their own data
- ✅ No user can read, update, or insert data for other users
- ✅ All operations are scoped to the authenticated user's ID

---

## Database Triggers

### Automatic Profile Creation Trigger

**Migration:** `supabase/migrations/20251117211547_create_profiles_table.sql`

When a new user signs up (via email/password or OAuth), a profile is automatically created:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, selected_devices)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    ARRAY[]::TEXT[]  -- Empty array - user must complete profile
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**What it does:**
1. **Trigger**: Fires `AFTER INSERT` on `auth.users` table
2. **Function**: `handle_new_user()` creates a profile with:
   - User's ID from `auth.users`
   - Email from `auth.users`
   - Name from user metadata or email prefix
   - Empty `selected_devices` array (enforces profile completion)
3. **Security**: Uses `SECURITY DEFINER` to run with elevated privileges

**Important Notes:**
- Works for both email/password and OAuth signups
- Profile is created automatically - no manual intervention needed
- Empty `selected_devices` ensures users must complete profile setup

---

## Authentication Functions

**File:** `src/lib/auth.ts`

### Available Functions

#### 1. Sign Up
```typescript
signUp({ email, password, name })
```
- Creates new user in `auth.users`
- Profile is automatically created by trigger
- Returns user and session

#### 2. Sign In
```typescript
signIn({ email, password })
```
- Authenticates existing user
- Returns user and session

#### 3. Sign Out
```typescript
signOut()
```
- Signs out current user
- Clears session

#### 4. Get Session
```typescript
getSession()
```
- Returns current session if authenticated
- Returns `null` if not authenticated

#### 5. Get Current User
```typescript
getCurrentUser()
```
- Returns current authenticated user from `auth.users`
- Returns `null` if not authenticated

#### 6. Get User Profile
```typescript
getUserProfile(userId)
```
- Fetches user profile from `profiles` table
- Returns `null` if profile doesn't exist
- Handles RLS automatically (only returns user's own profile)

#### 7. Update User Profile
```typescript
updateUserProfile(userId, updates)
```
- Updates user profile in `profiles` table
- Only updates fields provided in `updates` object
- Enforced by RLS (users can only update their own profile)

#### 8. Sign In with OAuth
```typescript
signInWithOAuth(provider: 'google' | 'apple')
```
- Initiates OAuth flow with Google or Apple
- Redirects to provider's authentication page
- Handles callback automatically

#### 9. Get User Identity Providers
```typescript
getUserIdentityProviders()
```
- Returns array of OAuth providers linked to user's account
- Example: `['google', 'apple']` if both are linked

#### 10. Delete Account
```typescript
deleteAccount()
```
- Calls Edge Function to delete user account
- Requires admin privileges (handled by Edge Function)
- Automatically deletes profile via `ON DELETE CASCADE`

---

## Edge Functions

### Delete User Account Function

**Location:** `supabase/functions/delete-user-account/index.ts`

**Purpose:** Securely delete user accounts using admin API

**How it works:**
1. Client calls Edge Function with user's access token
2. Edge Function verifies authentication
3. Uses service role key to call `supabase.auth.admin.deleteUser()`
4. Profile is automatically deleted via `ON DELETE CASCADE`

**Security:**
- Service role key is never exposed to client
- Only authenticated users can delete their own account
- Edge Function validates user identity before deletion

**Deployment:**
```bash
npx supabase functions deploy delete-user-account
```

---

## OAuth Configuration

### Supported Providers

1. **Google OAuth**
   - Configured in Supabase Dashboard → Authentication → Providers
   - Redirect URL: `https://wdeqaibnwjekcyfpuple.supabase.co/auth/v1/callback`
   - Auto-sign-in enabled (no forced prompt)

2. **Apple OAuth**
   - Configured in Supabase Dashboard → Authentication → Providers
   - Requires Services ID, Team ID, Key ID, and Private Key
   - Redirect URL: `https://wdeqaibnwjekcyfpuple.supabase.co/auth/v1/callback`

### OAuth Flow

1. User clicks "Sign in with Google/Apple"
2. Redirects to provider's authentication page
3. User authenticates with provider
4. Provider redirects back to Supabase callback URL
5. Supabase creates/updates user in `auth.users`
6. Trigger creates/updates profile in `profiles` table
7. User is redirected back to app with session

### Multiple Providers

- Users can link multiple OAuth providers to the same account
- Supabase links providers by email address (if enabled in settings)
- Use `getUserIdentityProviders()` to see which providers are linked

---

## Environment Variables

**File:** `.env.local` (not tracked in git)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://wdeqaibnwjekcyfpuple.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Optional: For Edge Functions (server-side only)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Variable Usage

- **`VITE_SUPABASE_URL`**: Supabase project URL
- **`VITE_SUPABASE_ANON_KEY`**: Public anon key (safe for client-side)
- **`SUPABASE_SERVICE_ROLE_KEY`**: Service role key (server-side only, never expose to client)

### Security Notes

- ✅ Anon key is safe to use in client-side code
- ✅ Service role key should NEVER be exposed to client
- ✅ Service role key is only used in Edge Functions
- ✅ `.env.local` is gitignored

---

## Database Migrations

### Migration Files

1. **`20251117211547_create_profiles_table.sql`**
   - Creates `profiles` table
   - Sets up RLS policies
   - Creates trigger for automatic profile creation
   - Initial default: `selected_devices = ARRAY['garmin']`

2. **`20251118040801_update_profiles_default_devices.sql`**
   - Updates default `selected_devices` to empty array
   - Updates trigger function to insert empty array
   - Enforces profile completion for new users

3. **`20251118041943_create_delete_user_function.sql`**
   - Creates `delete_user_account()` database function
   - Note: Currently not used (Edge Function is used instead)
   - Kept as backup approach

### Applying Migrations

```bash
# Push migrations to remote database
npm run db:push

# Or manually via Supabase CLI
npx supabase db push
```

---

## Authentication Flow Diagram

```
User Action
    │
    ├─ Email/Password Sign Up
    │   └─> auth.users (created)
    │       └─> Trigger: handle_new_user()
    │           └─> profiles (created with empty selected_devices)
    │
    ├─ OAuth Sign In (Google/Apple)
    │   └─> Redirect to Provider
    │       └─> Provider authenticates
    │           └─> Callback to Supabase
    │               └─> auth.users (created/updated)
    │                   └─> Trigger: handle_new_user()
    │                       └─> profiles (created/updated)
    │
    └─ Sign In
        └─> auth.users (authenticated)
            └─> Session created
                └─> getUserProfile() (fetches from profiles)
```

---

## Security Summary

### Client-Side Security
- ✅ Uses anon key (limited permissions)
- ✅ RLS policies enforce data access
- ✅ Users can only access their own data

### Server-Side Security
- ✅ Edge Functions use service role key securely
- ✅ Database functions use `SECURITY DEFINER` appropriately
- ✅ Triggers run with elevated privileges safely

### Data Protection
- ✅ RLS enabled on all user data tables
- ✅ Foreign key constraints ensure data integrity
- ✅ Cascade deletes prevent orphaned records

---

## Common Operations

### Check if user is authenticated
```typescript
const { session } = await getSession();
if (session) {
  // User is authenticated
}
```

### Get user profile
```typescript
const { user } = await getCurrentUser();
if (user) {
  const profile = await getUserProfile(user.id);
}
```

### Update user profile
```typescript
await updateUserProfile(userId, {
  name: 'New Name',
  selectedDevices: ['garmin', 'apple'],
});
```

### Check linked OAuth providers
```typescript
const { providers } = await getUserIdentityProviders();
// Returns: ['google', 'apple'] or ['google'] etc.
```

---

## Troubleshooting

### Profile not created after signup
- Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
- Check trigger function: `SELECT * FROM pg_proc WHERE proname = 'handle_new_user';`
- Verify RLS policies allow INSERT

### RLS blocking queries
- Ensure user is authenticated: `auth.uid()` must return a value
- Check policy conditions match your query
- Verify user ID matches profile ID

### OAuth not working
- Check redirect URLs in Supabase Dashboard
- Verify OAuth provider configuration
- Check browser console for errors
- Ensure environment variables are set

---

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Triggers](https://supabase.com/docs/guides/database/triggers)
- [Edge Functions](https://supabase.com/docs/guides/functions)

---

**Last Updated:** November 2024
**Project:** Workout Content Transformation
**Supabase Project:** wdeqaibnwjekcyfpuple

