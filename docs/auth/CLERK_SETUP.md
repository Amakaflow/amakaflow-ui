# Clerk Authentication Setup

This document outlines the Clerk authentication integration for the React + Vite application.

## Overview

Clerk is now the primary authentication provider for this application. Supabase is still used for storing user profiles and workout data, but authentication is handled entirely by Clerk.

## Installation

Clerk React SDK has been installed:
```bash
npm install @clerk/clerk-react@latest
```

## Environment Variables

Add the following to your `.env.local` file:

```env
VITE_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

**Important:** The `VITE_` prefix is required for Vite to expose environment variables to client-side code.

To get your Publishable Key:
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **API Keys** page
3. Select **React** as the framework
4. Copy your **Publishable Key**

## Setup

### 1. ClerkProvider (`src/main.tsx`)

The app is wrapped with `<ClerkProvider>` in `src/main.tsx`:

```typescript
import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>
);
```

### 2. Clerk Auth Library (`src/lib/clerk-auth.ts`)

This file provides Clerk-based authentication functions that integrate with the existing Supabase profiles database:

- `useClerkUser()`: Hook to get the current Clerk user
- `useClerkAuth()`: Hook to get Clerk auth functions (signOut, etc.)
- `getUserProfileFromClerk(clerkUserId)`: Get user profile from Supabase
- `syncClerkUserToProfile(clerkUser)`: Create or sync Clerk user to Supabase profile
- `updateUserProfileFromClerk(clerkUserId, updates)`: Update user profile in Supabase

### 3. App Component (`src/App.tsx`)

The main App component uses Clerk hooks:

```typescript
import { useClerkUser, syncClerkUserToProfile } from './lib/clerk-auth';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';

export default function App() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkUser();
  // ... rest of the component
}
```

### 4. Sign-In UI

When not authenticated, the app shows Clerk's sign-in buttons:

```typescript
<SignedOut>
  <SignInButton mode="modal">
    <Button>Sign In</Button>
  </SignInButton>
  <SignUpButton mode="modal">
    <Button variant="outline">Sign Up</Button>
  </SignUpButton>
</SignedOut>
```

### 5. User Button

When authenticated, Clerk's `<UserButton>` is displayed in the navigation:

```typescript
<SignedIn>
  <UserButton afterSignOutUrl="/" />
</SignedIn>
```

## Integration with Supabase

Clerk handles authentication, while Supabase stores user profiles and workout data:

1. **User signs up/logs in with Clerk** → Clerk creates the user
2. **App syncs Clerk user to Supabase** → Creates/updates profile in `profiles` table
3. **Profile data is stored in Supabase** → `selected_devices`, `subscription`, etc.

The `profiles` table uses Clerk's user ID as the primary key (instead of Supabase auth user ID).

## Database Schema

The `profiles` table structure remains the same, but now references Clerk user IDs:

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY, -- Now stores Clerk user ID
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  subscription TEXT DEFAULT 'free',
  workouts_this_week INTEGER DEFAULT 0,
  selected_devices TEXT[] DEFAULT ARRAY[]::TEXT[],
  billing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Note:** The foreign key constraint to `auth.users` has been removed since we're using Clerk for authentication.

## Migration from Supabase Auth

If you're migrating from Supabase Auth to Clerk:

1. **Backup your data** - Export all user profiles from Supabase
2. **Set up Clerk** - Create a Clerk account and get your publishable key
3. **Update environment variables** - Add `VITE_CLERK_PUBLISHABLE_KEY`
4. **User migration** - Users will need to sign up again with Clerk (or you can migrate existing users via Clerk's API)
5. **Update profiles** - Map existing Supabase user IDs to new Clerk user IDs

## OAuth Providers

Clerk supports OAuth providers (Google, Apple, etc.) out of the box. Configure them in the Clerk Dashboard:

1. Go to **User & Authentication** → **Social Connections**
2. Enable the providers you want (Google, Apple, etc.)
3. Configure the OAuth credentials
4. Users can sign in with these providers directly through Clerk's UI

## Account Deletion

Currently, account deletion signs the user out. For full account deletion:

1. Use Clerk's API to delete the user
2. Delete the corresponding profile from Supabase
3. Handle any cleanup of related data

## Troubleshooting

### "Missing Clerk Publishable Key" Error

- Ensure `.env.local` exists and contains `VITE_CLERK_PUBLISHABLE_KEY`
- Restart the dev server after adding the environment variable
- Verify the key is correct in the Clerk Dashboard

### Profile Not Syncing

- Check that `syncClerkUserToProfile` is being called in `App.tsx`
- Verify Supabase connection is working
- Check browser console for errors

### User Button Not Showing

- Ensure `<ClerkProvider>` wraps the entire app
- Verify user is authenticated: `const { user } = useClerkUser()`
- Check that `isLoaded` is `true` before rendering

## Resources

- [Clerk React Quickstart](https://clerk.com/docs/quickstarts/react)
- [Clerk React SDK Documentation](https://clerk.com/docs/references/react/overview)
- [Clerk Dashboard](https://dashboard.clerk.com)

