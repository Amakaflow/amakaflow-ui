# Apple OAuth Token Management

## Current Token Status

- **Token Generated**: December 19, 2024
- **Token Expires**: May 19, 2026 (6 months from generation)
- **Key ID**: `QXL4WMPZJQ`
- **Services ID**: `com.amakaflow.web`
- **Team ID**: `A9K5QG6YW8`

## ⚠️ Important Reminders

- [ ] **Set calendar reminder for May 5, 2026** (2 weeks before expiration)
- [ ] **Regenerate token before May 19, 2026** (expiration date)
- [ ] **Update Supabase** with new token before expiration

## Token Regeneration Checklist

When it's time to regenerate (before May 19, 2026):

1. [ ] Open `generate-apple-jwt.js`
2. [ ] Verify all values are still correct:
   - [ ] Team ID: `A9K5QG6YW8`
   - [ ] Key ID: `QXL4WMPZJQ`
   - [ ] Services ID: `com.amakaflow.web`
   - [ ] Key File Path: `/Volumes/David4T/AmakaFlowKey/AuthKey_QXL4WMPZJQ.p8`
3. [ ] Run: `node generate-apple-jwt.js`
4. [ ] Copy the new JWT token
5. [ ] Go to Supabase Dashboard → Authentication → Providers → Apple
6. [ ] Paste new token into "Secret Key (for OAuth)" field
7. [ ] Click "Save"
8. [ ] Test Apple sign-in to verify it works
9. [ ] Update this file with new expiration date

## Token History

| Generated Date | Expiration Date | Status | Notes |
|---------------|----------------|--------|-------|
| 2024-12-19 | 2026-05-19 | ✅ Active | Initial token generation |

## Notes

- Token expires every 6 months (Apple requirement)
- Keep the `.p8` key file secure - never commit to git
- The key file is located at: `/Volumes/David4T/AmakaFlowKey/AuthKey_QXL4WMPZJQ.p8`
- If the key file is lost, you'll need to create a new key in Apple Developer Portal

## Quick Regeneration Command

```bash
cd "/Users/davidandrews/dev/workoutingestormakecode/Workout Content Transformation"
node generate-apple-jwt.js
```

