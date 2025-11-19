# Strava API Setup Guide

## Quick Setup

### 1. Get Strava Credentials

1. Go to https://www.strava.com/settings/api
2. Click "Create Application" (or edit existing application)
3. Fill out the form:
   - **Application Name**: MyAmaka (or your app name)
   - **Category**: Other
   - **Authorization Callback Domain**: `localhost:8000` (IMPORTANT: just domain and port, no protocol or path)
   - **Website**: (optional) your website URL
4. Click "Create" and upload an app icon (required)
5. After creating, copy your **Client ID** and **Client Secret**

### 2. Update `.env` File

Edit `strava-sync-api/.env` and replace the placeholder values:

```bash
# Strava OAuth Configuration
STRAVA_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID_HERE
STRAVA_CLIENT_SECRET=YOUR_ACTUAL_CLIENT_SECRET_HERE
STRAVA_REDIRECT_URI=http://localhost:8000/strava/oauth/callback

# Application Settings
FRONTEND_URL=http://localhost:3000
APP_NAME=Strava Connections Service
APP_VERSION=1.0.0

# Security
INTERNAL_API_KEY=cGCpYAGI4vewwr6uS4wjURvra1629ETia6D336a-QYU
ENCRYPTION_KEY=Kf7GQNbgkxodfd-NxhYt0_18M0rXZZaMHht78pvsJXM=

# Strava API
STRAVA_API_BASE=https://www.strava.com/api/v3

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60

# Logging
LOG_LEVEL=INFO
```

**Important:** 
- Replace `YOUR_ACTUAL_CLIENT_ID_HERE` with your actual Strava Client ID
- Replace `YOUR_ACTUAL_CLIENT_SECRET_HERE` with your actual Strava Client Secret
- The encryption keys above are already generated - you can use them

### 3. Restart Services

After updating the `.env` file, restart the strava-sync-api service:

```bash
cd /Users/davidandrews/dev/amakaflow-dev
docker compose restart strava-sync-api
```

Or rebuild and restart:

```bash
docker compose up -d --build strava-sync-api
```

## Verification

After restarting, you should be able to:
1. Go to Settings → Linked Accounts
2. Click "Connect Strava"
3. You should be redirected to Strava (not get a "Bad Request" error)
4. Authorize the app
5. Be redirected back to the app with tokens stored

## Troubleshooting

**Error: "Bad Request" with "client_id: invalid"**
- Make sure `STRAVA_CLIENT_ID` in `.env` is set to your actual Client ID (not the placeholder)
- Restart the service after updating `.env`

**Error: "Redirect URI mismatch"**
- Make sure the "Authorization Callback Domain" in Strava settings is `localhost:8000` (no protocol, no path)
- Make sure `STRAVA_REDIRECT_URI` in `.env` is `http://localhost:8000/strava/oauth/callback`

**Tokens not found after OAuth**
- Make sure you completed the full OAuth flow (authorized on Strava and were redirected back)
- Check docker logs: `docker compose logs strava-sync-api`

