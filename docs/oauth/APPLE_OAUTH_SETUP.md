# Apple OAuth (Sign in with Apple) Setup - Step by Step Guide

## Current Status
You're in the Apple Developer Account page. Here's what to do next:

## Step 1: Navigate to Identifiers

1. Click on **"Certificates, IDs & Profiles"** card (the one with the gear icon)
2. In the left sidebar, click on **"Identifiers"**
3. Click the **"+"** button (top left) to create a new identifier

## Step 2: Create a Services ID

1. Select **"Services IDs"** and click **"Continue"**
2. Fill in the form:
   - **Description**: `AmakaFlow Web Service` (or any descriptive name)
   - **Identifier**: `com.amakaflow.web` (must be unique, reverse domain format)
   - Click **"Continue"**
   - Review and click **"Register"**

## Step 3: Configure Sign in with Apple

1. Find your newly created Services ID in the list and click on it
2. Check the box next to **"Sign in with Apple"**
3. Click **"Configure"** next to "Sign in with Apple"

## Step 4: Create an App ID (Required First!)

**IMPORTANT:** You need to create an App ID before you can configure Sign in with Apple for web.

1. Go back to **"Identifiers"** (if you're not already there)
2. Click the **"+"** button to create a new identifier
3. Select **"App IDs"** and click **"Continue"**
4. Select **"App"** and click **"Continue"**
5. Fill in:
   - **Description**: `AmakaFlow App` (or any name)
   - **Bundle ID**: `com.amakaflow.app` (must be unique, reverse domain format)
   - Under **Capabilities**, check **"Sign in with Apple"**
   - Click **"Continue"**
   - Review and click **"Register"**

## Step 5: Configure Sign in with Apple Settings

Now go back to your Services ID:

1. Find your Services ID in the list and click on it
2. Check the box next to **"Sign in with Apple"**
3. Click **"Configure"** next to "Sign in with Apple"
4. **Primary App ID**: 
   - Now you should see your App ID in the dropdown
   - Select the App ID you just created (e.g., `com.amakaflow.app`)
   
5. **Website URLs**:
   - **Domains and Subdomains**: Add:
     ```
     wdeqaibnwjekcyfpuple.supabase.co
     ```
   - **Return URLs** (Redirect URLs): Add:
     ```
     https://wdeqaibnwjekcyfpuple.supabase.co/auth/v1/callback
     ```
   - For local development, also add:
     ```
     http://localhost:3000
     ```

3. Click **"Next"** and then **"Done"**
4. Click **"Continue"** and then **"Save"**

## Step 6: Create a Key for Sign in with Apple

1. Go back to **"Certificates, IDs & Profiles"**
2. Click on **"Keys"** in the left sidebar
3. Click the **"+"** button to create a new key
4. Fill in:
   - **Key Name**: `AmakaFlow Sign in with Apple Key`
   - Check the box for **"Sign in with Apple"**
   - Click **"Configure"**
   - Select your **Primary App ID** (or Services ID)
   - Click **"Save"**
   - Click **"Continue"**
   - Click **"Register"**

## Step 7: Download and Save Your Key

**IMPORTANT:** You can only download the key once!

1. After registering, you'll see a download button
2. Click **"Download"** to save the `.p8` file
3. **Save this file securely** - you cannot download it again!
4. Note the **Key ID** shown on the page (you'll need this)

## Step 8: Get Your Team ID

1. Go back to the main **"Account"** page
2. Click on **"Membership details"** (the ID card icon)
3. Find your **Team ID** (looks like: `ABC123DEF4`)
4. Copy this - you'll need it for Supabase

## Step 9: Prepare Information for Supabase

You'll need these 4 pieces of information:

1. **Services ID** (Client ID): `com.amakaflow.web` (or whatever you created)
2. **Team ID**: From Step 7 (e.g., `ABC123DEF4`)
3. **Key ID**: From Step 6 (shown when you created the key)
4. **Private Key**: Open the downloaded `.p8` file in a text editor and copy its entire contents

## Step 10: Add to Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** > **Providers**
4. Find **"Apple"** and click to enable it
5. Fill in the form:
   - **Services ID**: Your Services ID from Step 2
   - **Team ID**: Your Team ID from Step 7
   - **Key ID**: Your Key ID from Step 6
   - **Private Key**: Paste the entire contents of your `.p8` file
6. Click **"Save"**

## Step 11: Test It!

1. Start your dev server: `npm run dev`
2. Go to the login page
3. Click **"Continue with Apple"**
4. You should be redirected to Apple's sign-in page
5. After signing in, you'll be redirected back to your app

## Troubleshooting

- **"Invalid client" error**: Double-check your Services ID in Supabase matches exactly what you created
- **"Invalid key" error**: Make sure you copied the entire `.p8` file contents, including the header and footer lines
- **Redirect errors**: Verify the redirect URL in Apple matches exactly: `https://wdeqaibnwjekcyfpuple.supabase.co/auth/v1/callback`
- **Key ID not found**: Make sure you're using the Key ID from the Keys section, not the Services ID

## Important Notes

- The `.p8` key file can only be downloaded once - keep it safe!
- The Services ID identifier must be unique across all Apple Developer accounts
- Sign in with Apple requires an active Apple Developer Program membership ($99/year)
- For production, you may need to complete additional verification steps

