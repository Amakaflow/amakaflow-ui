/**
 * ============================================================================
 * Apple Sign in with Apple - JWT Token Generator for Supabase
 * ============================================================================
 * 
 * This script generates a JWT token that Supabase needs for Apple OAuth.
 * 
 * HOW TO USE:
 * 1. Fill in the 4 values below (Team ID, Key ID, Services ID, Key File Path)
 * 2. Run: node generate-apple-jwt.js
 * 3. Copy the generated token and paste it into Supabase "Secret Key" field
 * 
 * WHERE TO FIND EACH VALUE:
 * - Team ID: Apple Developer > Account > Membership details
 * - Key ID: Apple Developer > Certificates, IDs & Profiles > Keys > [Your Key]
 * - Services ID: The identifier you created (e.g., com.amakaflow.oauth)
 * - Key File: The .p8 file you downloaded from Apple Developer
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');

// ============================================================================
// STEP 1: FILL IN YOUR APPLE DEVELOPER CREDENTIALS
// ============================================================================

// 1. TEAM ID
//    Where to find: Apple Developer Portal > Account > Membership details
//    Example: 'A9K5QG6YW8'
const TEAM_ID = 'A9K5QG6YW8';

// 2. KEY ID  
//    Where to find: Apple Developer > Certificates, IDs & Profiles > Keys
//                   Click on your key (e.g., "AmakaFlow Sign in with Apple Key")
//                   The Key ID is shown on that page
//    Example: 'ABC123DEF4'
const KEY_ID = 'QXL4WMPZJQ'; // ⚠️ REPLACE THIS

// 3. SERVICES ID (also called Client ID)
//    This is the identifier you created for your Services ID
//    Where to find: Apple Developer > Certificates, IDs & Profiles > Identifiers
//                   Look for your Services ID (not App ID)
//    Example: 'com.amakaflow.oauth'
const SERVICES_ID = 'com.amakaflow.web'; // ⚠️ REPLACE THIS

// 4. PRIVATE KEY FILE PATH
//    This is the .p8 file you downloaded from Apple Developer
//    Make sure to use the full path to the file
const PRIVATE_KEY_PATH = '/Volumes/David4T/AmakaFlowKey/AuthKey_QXL4WMPZJQ.p8';

// ============================================================================
// STEP 2: GENERATE THE JWT TOKEN
// ============================================================================
// (You don't need to modify anything below this line)

console.log('\n🔐 Generating Apple JWT Token...\n');
console.log('Configuration:');
console.log(`  Team ID: ${TEAM_ID}`);
console.log(`  Key ID: ${KEY_ID === 'YOUR_KEY_ID_HERE' ? '❌ NOT SET' : '✅ ' + KEY_ID}`);
console.log(`  Services ID: ${SERVICES_ID === 'YOUR_SERVICES_ID_HERE' ? '❌ NOT SET' : '✅ ' + SERVICES_ID}`);
console.log(`  Key File: ${PRIVATE_KEY_PATH}\n`);

// Validate inputs
if (KEY_ID === 'YOUR_KEY_ID_HERE' || SERVICES_ID === 'YOUR_SERVICES_ID_HERE') {
  console.error('❌ ERROR: Please fill in KEY_ID and SERVICES_ID above!\n');
  console.error('See the comments in the script for where to find these values.\n');
  process.exit(1);
}

try {
  // Read the private key file
  console.log('📂 Reading private key file...');
  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  console.log('✅ Key file loaded\n');

  // Create JWT payload (the data inside the token)
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: TEAM_ID,                                    // Issuer: Your Team ID
    iat: now,                                        // Issued at: Current time
    exp: now + 15777000,                            // Expires: 6 months from now (15777000 seconds)
    aud: 'https://appleid.apple.com',                // Audience: Apple's authentication server
    sub: SERVICES_ID,                                // Subject: Your Services ID
  };

  // Create JWT header
  const header = {
    alg: 'ES256',                                    // Algorithm: ES256 (required by Apple)
    kid: KEY_ID,                                     // Key ID: Your Key ID
  };

  // Generate the JWT token
  console.log('🔨 Signing JWT token...');
  const token = jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: header,
  });

  // Success! Display the token
  console.log('✅ JWT Token Generated Successfully!\n');
  console.log('═'.repeat(80));
  console.log('📋 COPY THIS TOKEN AND PASTE IT INTO SUPABASE:');
  console.log('═'.repeat(80));
  console.log('\n' + token + '\n');
  console.log('═'.repeat(80));
  console.log('\n📝 Next Steps:');
  console.log('   1. Copy the token above');
  console.log('   2. Go to Supabase Dashboard > Authentication > Providers > Apple');
  console.log('   3. Paste the token into the "Secret Key (for OAuth)" field');
  console.log('   4. Enter your Services ID in the "Client IDs" field');
  console.log('   5. Enable "Sign in with Apple" toggle');
  console.log('   6. Click "Save"\n');
  console.log('⚠️  IMPORTANT: This token expires in 6 months. You\'ll need to regenerate it.\n');

} catch (error) {
  console.error('\n❌ ERROR: Failed to generate JWT token\n');
  console.error('Error details:');
  console.error(`   ${error.message}\n`);
  
  console.error('🔍 Troubleshooting:');
  
  if (error.code === 'ENOENT') {
    console.error('   ❌ The key file was not found at:');
    console.error(`      ${PRIVATE_KEY_PATH}`);
    console.error('   → Check that the file path is correct\n');
  } else if (error.message.includes('KEY_ID') || error.message.includes('SERVICES_ID')) {
    console.error('   ❌ Missing required values');
    console.error('   → Make sure KEY_ID and SERVICES_ID are filled in above\n');
  } else if (error.message.includes('jsonwebtoken')) {
    console.error('   ❌ jsonwebtoken package not installed');
    console.error('   → Run: npm install jsonwebtoken\n');
  } else {
    console.error('   → Check that all values above are correct');
    console.error('   → Verify the .p8 file is valid\n');
  }
  
  process.exit(1);
}

