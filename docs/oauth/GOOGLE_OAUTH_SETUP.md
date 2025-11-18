# Google OAuth Setup - Step by Step Guide

## Current Status
You're in the Google Cloud Console for your "AmakaFlow" project. Here's what to do next:

## Step 1: Enable Google+ API (if needed)

1. In the Google Cloud Console, click on **"APIs & Services"** from the Quick Access section (or search for it)
2. Click **"Library"** in the left sidebar
3. Search for **"Google+ API"** or **"Google Identity"**
4. Click on **"Google+ API"** or **"Google Identity Services API"**
5. Click **"Enable"** if it's not already enabled

## Step 2: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** > **"Credentials"** (from the left sidebar)
2. Click the **"+ CREATE CREDENTIALS"** button at the top
3. Select **"OAuth client ID"**

## Step 3: Configure OAuth Consent Screen (if prompted)

If this is your first OAuth setup, you'll need to configure the consent screen first:

1. Click **"Configure Consent Screen"**
2. Choose **"External"** (unless you have a Google Workspace account)
3. Fill in the required information:
   - **App name**: AmakaFlow (or MyAmaka)
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **"Save and Continue"**
5. Skip scopes for now (click **"Save and Continue"**)
6. Add test users if needed (click **"Save and Continue"**)
7. Review and go back to Credentials

## Step 4: Create OAuth Client ID

1. Back in **Credentials**, click **"+ CREATE CREDENTIALS"** > **"OAuth client ID"**
2. Select **"Web application"** as the application type
3. Give it a name: **"AmakaFlow Web Client"**
4. **Authorized JavaScript origins** (add these):
   ```
   http://localhost:3000
   https://wdeqaibnwjekcyfpuple.supabase.co
   ```
5. **Authorized redirect URIs** (add these):
   ```
   https://wdeqaibnwjekcyfpuple.supabase.co/auth/v1/callback
   http://localhost:3000
   ```
6. Click **"Create"**

## Step 5: Copy Your Credentials

After creating, you'll see a popup with:
- **Your Client ID** (looks like: `123456789-abcdefg.apps.googleusercontent.com`)
- **Your Client Secret** (looks like: `GOCSPX-xxxxxxxxxxxxx`)

**IMPORTANT:** Copy both of these - you'll need them for Supabase!

## Step 6: Add to Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** > **Providers**
4. Find **"Google"** and click to enable it
5. Paste your **Client ID** and **Client Secret**
6. Click **"Save"**

## Step 7: Test It!

1. Start your dev server: `npm run dev`
2. Go to the login page
3. Click **"Continue with Google"**
4. You should be redirected to Google's sign-in page
5. After signing in, you'll be redirected back to your app

## Troubleshooting

- **"redirect_uri_mismatch" error**: Make sure the redirect URI in Google Console exactly matches: `https://wdeqaibnwjekcyfpuple.supabase.co/auth/v1/callback`
- **"invalid_client" error**: Double-check your Client ID and Secret in Supabase
- **Not redirecting back**: Check that you've enabled the Google provider in Supabase

