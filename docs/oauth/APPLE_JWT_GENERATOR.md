# Generate Apple JWT Token for Supabase

Supabase requires a JWT token (not the raw private key) for Apple OAuth. Here's how to generate it:

## Quick Method: Using the Script

1. **Install the required package:**
   ```bash
   npm install jsonwebtoken
   ```

2. **Update the script:**
   - Open `generate-apple-jwt.js`
   - Fill in these values:
     - `TEAM_ID`: Your Team ID (e.g., `A9K5QG6YW8`)
     - `KEY_ID`: The Key ID from when you created the key in Apple Developer
     - `SERVICES_ID`: Your Services ID (e.g., `com.amakaflow.oauth`)
     - `PRIVATE_KEY_PATH`: Path to your downloaded `.p8` file

3. **Run the script:**
   ```bash
   node generate-apple-jwt.js
   ```

4. **Copy the generated JWT token** and paste it into Supabase's "Secret Key" field

## Alternative: Online Tool

You can also use an online JWT generator, but be careful with your private key:
- https://jwt.io (for testing/development only)

## What You Need:

1. **Team ID**: Found in Apple Developer > Account > Membership details
   - Example: `A9K5QG6YW8`

2. **Key ID**: From the key you created in Apple Developer > Keys
   - Example: `ABC123DEF4`

3. **Services ID**: The identifier you created for your Services ID
   - Example: `com.amakaflow.oauth`

4. **Private Key**: The `.p8` file you downloaded

## JWT Token Details:

The JWT token contains:
- **iss** (issuer): Your Team ID
- **iat** (issued at): Current timestamp
- **exp** (expiration): 6 months from now
- **aud** (audience): `https://appleid.apple.com`
- **sub** (subject): Your Services ID

## Important Notes:

- ⚠️ The JWT token expires in 6 months - you'll need to regenerate it
- 🔒 Keep your private key (`.p8` file) secure - never commit it to git
- ✅ The generated JWT is what goes in Supabase's "Secret Key" field

