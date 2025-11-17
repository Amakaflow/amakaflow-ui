# Strava Connections Service

A Python FastAPI service for connecting MyAmaka with Strava, managing OAuth flows, tokens, and activity synchronization.

## Features

- **OAuth 2.0 Integration**: Secure OAuth flow with Strava
- **Token Management**: Automatic token refresh with encryption at rest
- **Activity Sync**: Fetch and update Strava activities
- **Security**: Encrypted token storage, API key authentication, rate limiting
- **Performance**: Optimized for 200ms average response time
- **Logging**: Comprehensive logging for debugging and monitoring

## API Endpoints

### Public API (Frontend → MyAmaka → Connections Service)

#### OAuth
- `POST /strava/oauth/initiate` - Start OAuth flow, returns redirect URL
- `GET /strava/oauth/callback` - Handle OAuth callback, stores tokens

#### Activities
- `GET /strava/activities?limit=30&userId=<id>` - Fetch recent activities
- `PUT /strava/activities/:id?userId=<id>` - Update activity with MyAmaka data
- `POST /strava/activities/:id/image?userId=<id>` - Upload image (stub)

### Internal API (Backend → Connections Service)

- `GET /strava/internal/token/:userId` - Get access token (requires API key)
- `POST /strava/token/refresh?userId=<id>` - Manually refresh token

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required environment variables:
- `STRAVA_CLIENT_ID` - Your Strava app client ID
- `STRAVA_CLIENT_SECRET` - Your Strava app client secret
- `STRAVA_REDIRECT_URI` - OAuth callback URL
- `INTERNAL_API_KEY` - Secure random key for service-to-service auth
- `ENCRYPTION_KEY` - Base64 encoded 32-byte key for token encryption

Generate encryption key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Strava App Setup

1. **Navigate to Strava API Settings**
   - Go to https://www.strava.com/settings/api
   - You'll see the "My API Application" page with a form titled "Create An Application"

2. **Fill Out the Application Form**
   - **Application Name**: Enter your application name (e.g., "Amaka" or "MyAmaka")
   - **Category**: Select a category from the dropdown (e.g., "Other")
   - **Club**: Select a club or leave as "[None]"
   - **Website**: (Optional) Enter your website URL
   - **Application Description**: (Optional) Enter a description of your application
   - **Authorization Callback Domain**: ⚠️ **CRITICAL** - Enter **ONLY the domain** (no protocol, no slashes, no paths)
     - ❌ **WRONG**: `http://localhost:8000/strava/oauth/callback` (will show error: "This field must be just a domain, no slashes or paths")
     - ✅ **CORRECT for local development**: `localhost:8000` (just domain and port)
     - ✅ **CORRECT for production**: `api.myamaka.com` (just the domain)
     - **Important Notes**:
       - This field accepts **only the domain**, not the full URL
       - The domain must match the domain in your `STRAVA_REDIRECT_URI` environment variable
       - Example: If your `STRAVA_REDIRECT_URI=http://localhost:8000/strava/oauth/callback`, enter `localhost:8000` in this field
       - The full callback URL (with path) goes in your `.env` file, not in this form field

3. **Agree to Terms**
   - Check the box: "I've read and agree with Strava's API Agreement"
   - Click the "Create" button

4. **Upload App Icon** (Required)
   - After creating the application, you'll be prompted to upload an app icon
   - You'll see a page titled "Update App Icon" with the message: "Apps need an icon before they can be viewed or edited. Adding an app icon enables your users and fellow developers to identify your app within their 'My Apps' lists, as well as on the Strava API Directory."
   - Click the "Upload" button and select an icon image file
   - **Note**: This step is required before you can view or edit your application details

5. **Get Your Credentials**
   - After uploading the icon, you'll be taken to your application details page
   - Copy the **Client ID** and **Client Secret**
   - Add these to your `.env` file:
     ```
     STRAVA_CLIENT_ID=your_client_id_here
     STRAVA_CLIENT_SECRET=your_client_secret_here
     STRAVA_REDIRECT_URI=http://localhost:8000/strava/oauth/callback
     ```
   - ⚠️ **Important**: The `STRAVA_REDIRECT_URI` must match the callback domain you entered in step 2

### 4. Run the Service

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or with production settings:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Usage Examples

### OAuth Flow (Simplified)

**Simple 3-step process:** Just provide your `userId` when initiating OAuth, and everything else is automatic!

1. **Initiate OAuth with your userId**:
```bash
# Use any string as your userId (e.g., "david_test")
curl -X POST "http://localhost:8000/strava/oauth/initiate?userId=david_test"
# Returns: {"url": "https://www.strava.com/oauth/authorize?..."}
```

2. **Authorize the app**:
   - Copy the `url` from the response
   - Open it in your browser
   - Log in to Strava (if needed)
   - Click "Authorize"

3. **Done!** The callback automatically:
   - Extracts your userId from the OAuth flow
   - Exchanges code for tokens
   - Encrypts and stores tokens linked to your userId
   - Extracts and stores your Strava athlete ID
   - Redirects to frontend

**No need to manually modify callback URLs anymore!** The userId is automatically passed through the OAuth flow.

### Get Your Strava User ID

After connecting via OAuth, get your Strava athlete ID using the **same userId** you used in OAuth:

```bash
# Use the same userId you used in OAuth (e.g., "david_test")
curl "http://localhost:8000/strava/athlete?userId=david_test"
```

This returns:
```json
{
  "id": 71964009,           // <-- This is your Strava athlete ID
  "username": "your_username",
  "firstname": "David",
  "lastname": "Andrews",
  "profile": "https://..."
}
```

**Key Points:**
- `userId` parameter = Your **MyAmaka user ID** (e.g., "user123", "david123")
- `id` in response = Your **Strava athlete ID** (e.g., 71964009)
- You must complete OAuth first with your MyAmaka userId before calling this endpoint

### Fetch Activities

```bash
# Use the same userId from OAuth
curl "http://localhost:8000/strava/activities?limit=30&userId=david_test"
```

### Update Activity

```bash
# Use the same userId from OAuth
curl -X PUT "http://localhost:8000/strava/activities/12345?userId=david_test" \
  -H "Content-Type: application/json" \
  -d '{
    "overwriteTitle": true,
    "newTitle": "Hyrox Engine – MyAmaka Workout",
    "overwriteDescription": true,
    "description": "Structured Workout...\nBlocks..."
  }'
```

### Internal Token Access

```bash
curl -X GET "http://localhost:8000/strava/internal/token/user123" \
  -H "X-API-Key: your_internal_api_key"
```

## Architecture

### Token Management

- Tokens are encrypted at rest using Fernet symmetric encryption
- Automatic refresh when token expires (60 second buffer)
- Retry logic on 401 errors with automatic refresh
- No tokens ever sent to frontend

### Security

- **Encryption**: All tokens encrypted before storage
- **API Keys**: Internal endpoints require `X-API-Key` header
- **Rate Limiting**: Configurable per endpoint (default 60/min)
- **CORS**: Configurable CORS middleware

### Database Integration

Currently uses in-memory storage. To integrate Supabase:

1. Update `database.py` to use Supabase client
2. Set `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
3. Create table:
```sql
CREATE TABLE strava_tokens (
  user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Error Handling

- OAuth failures logged with error details
- Token refresh failures logged and retried
- Strava API errors logged with response details
- All errors return appropriate HTTP status codes

## Performance

- Target: 200ms average response time
- Async/await throughout for non-blocking I/O
- Connection pooling via httpx
- Efficient token caching

## Monitoring

Logs include:
- OAuth initiation and callbacks
- Token refresh operations
- Strava API calls and responses
- Error conditions

## Future Enhancements

The service is designed to support additional providers:
- Garmin
- Amazfit
- TrainingPeaks
- Zwift
- Apple Health
- Coros

## Testing

QA scenarios covered:
- ✅ Valid OAuth callback
- ✅ Expired token auto-refresh
- ✅ Invalid code handling
- ✅ Missing user link
- ✅ Valid activity fetch
- ✅ No activities case
- ✅ Activity update with title/description
- ✅ Description truncation (>2000 chars)

## License

Proprietary - MyAmaka

