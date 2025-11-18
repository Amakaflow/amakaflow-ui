# Supabase Apple OAuth Configuration

## What You Need to Fill In:

### 1. Enable Sign in with Apple
- Toggle the switch to **ON** (enable it)

### 2. Client IDs
- Enter your **Services ID** that you created in Apple Developer
- Example: `com.amakaflow.oauth` (or whatever identifier you used)
- This is the Services ID, NOT the App ID

### 3. Secret Key (for OAuth)
This is where it gets a bit tricky. Supabase needs a JWT token, not the raw .p8 file.

**Option A: If Supabase accepts the private key directly:**
- Open your downloaded `.p8` file in a text editor
- Copy the ENTIRE contents (including the header and footer lines like `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
- Paste it into the "Secret Key" field

**Option B: If Supabase needs a JWT token:**
You'll need to generate a JWT token using:
- Your Team ID
- Key ID (from the key you created)
- Private Key (.p8 file contents)

### 4. Allow users without an email
- You can leave this OFF for now, or enable it if you want to allow users who hide their email

### 5. Save
- Once all fields are filled, click "Save"

## Important Notes:

1. **The Callback URL** shown (`https://wdeqaibnwjekcyfpuple.supabase.co/auth/v1/callback`) should match what you configured in Apple Developer Center

2. **Secret Key Expiration**: Remember that Apple OAuth secret keys expire every 6 months, so you'll need to regenerate them

3. **If the Save button is disabled**: Make sure:
   - Enable toggle is ON
   - Client IDs field has your Services ID
   - Secret Key field has the private key or JWT token

## Troubleshooting:

- If "Save" is still disabled, try toggling "Enable Sign in with Apple" on first
- Make sure your Services ID exactly matches what you created in Apple Developer
- The private key should include the BEGIN and END lines

