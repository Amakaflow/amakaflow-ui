# Testing Guide

## Quick Start for Testing

Since you don't have a MyAmaka userId set up yet, you can use any string as a `userId` for testing purposes.

## Step-by-Step Testing Flow

### 1. Choose a Test User ID

Pick any simple string to use as your test `userId`. Examples:
- `test_user`
- `david_test`
- `user123`
- `test`

**For this guide, we'll use `test_user` as an example.**

### 2. Initiate OAuth

```bash
curl -X POST http://localhost:8000/strava/oauth/initiate
```

This returns:
```json
{
  "url": "https://www.strava.com/oauth/authorize?client_id=185803&redirect_uri=..."
}
```

### 3. Authorize the App

1. Copy the `url` from the response
2. Open it in your browser
3. Log in to Strava (if not already logged in)
4. Click "Authorize" to grant permissions

### 4. Complete the Callback

After authorization, Strava will redirect you. **IMPORTANT:** You need to manually add the `userId` parameter to the callback URL.

The redirect will look like:
```
http://localhost:8000/strava/oauth/callback?code=abc123def456
```

**Modify it to include your test userId:**
```
http://localhost:8000/strava/oauth/callback?code=abc123def456&userId=test_user
```

Then visit this modified URL in your browser.

### 5. Verify Connection

After the callback completes, test that it worked:

```bash
# Get your Strava athlete info
curl "http://localhost:8000/strava/athlete?userId=test_user"

# Get your activities
curl "http://localhost:8000/strava/activities?userId=test_user&limit=5"
```

## Using the Same userId

**Important:** Once you complete OAuth with a `userId`, you must use that **same** `userId` for all subsequent API calls. The tokens are stored under that `userId`.

- ✅ Use the same `userId`: `test_user` for all calls
- ❌ Don't mix different `userId` values

## Example Complete Flow

```bash
# 1. Initiate OAuth
curl -X POST http://localhost:8000/strava/oauth/initiate

# 2. Visit the URL, authorize, then manually add userId to callback:
#    http://localhost:8000/strava/oauth/callback?code=XXX&userId=test_user

# 3. Test endpoints (use the same userId!)
curl "http://localhost:8000/strava/athlete?userId=test_user"
curl "http://localhost:8000/strava/activities?userId=test_user&limit=10"
```

## Troubleshooting

### "No tokens found for user X"
- Make sure you completed OAuth with that exact `userId`
- Check that you added `userId` to the callback URL

### "Field required" for userId
- Make sure you're including `?userId=your_test_id` in the URL

### Token errors
- Try completing OAuth again with the same `userId`
- Make sure the callback URL includes the `userId` parameter

