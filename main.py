"""FastAPI application for Strava connections service."""
from fastapi import FastAPI, HTTPException, Depends, Header, Query, Path, Request, status, UploadFile, File
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, Field
from typing import Optional, List
import logging
from urllib.parse import urlencode
import httpx

from config import settings
from crypto_utils import init_encryption
from token_manager import token_manager
from strava_client import StravaClient, StravaAPIError
from database import db

# Initialize encryption
init_encryption(settings.encryption_key)

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Strava client
strava_client = StravaClient(settings.strava_api_base)


# Pydantic models
class OAuthInitiateResponse(BaseModel):
    url: str


class Activity(BaseModel):
    id: int
    name: str
    start_date: str
    distance: float
    elapsed_time: int
    type: str


class UpdateActivityRequest(BaseModel):
    overwriteTitle: Optional[bool] = False
    newTitle: Optional[str] = None
    overwriteDescription: Optional[bool] = False
    description: Optional[str] = None
    source: Optional[dict] = None


class UpdateActivityResponse(BaseModel):
    id: int
    name: str
    description: str
    updated_at: str


class TokenRefreshResponse(BaseModel):
    success: bool
    expires_at: int


class InternalTokenResponse(BaseModel):
    access_token: str
    expires_at: int


class AthleteResponse(BaseModel):
    id: int
    username: str
    firstname: str
    lastname: str
    profile: str = ""  # Profile picture URL (may be empty)


# Dependency for internal API key authentication
async def verify_internal_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    """Verify internal API key for service-to-service calls."""
    if x_api_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    return True


# Dependency to get user_id from query/header (to be implemented based on auth system)
async def get_user_id(user_id: Optional[str] = Query(None, alias="userId")) -> str:
    """Get user ID from request."""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="userId is required"
        )
    return user_id


# ============================================================================
# 5.1 OAuth Endpoints
# ============================================================================

@app.post("/strava/oauth/initiate", response_model=OAuthInitiateResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def initiate_oauth(
    request: Request,
    user_id: str = Query(..., alias="userId", description="Your user ID (e.g., 'david_test')"),
):
    """
    Start OAuth flow with Strava.
    
    Provide your userId as a query parameter. It will be automatically passed through
    the OAuth flow and used to store your tokens.
    
    Example: POST /strava/oauth/initiate?userId=david_test
    """
    try:
        # Encode userId in state parameter to pass it through OAuth flow
        import base64
        state = base64.urlsafe_b64encode(user_id.encode()).decode()
        
        # Build Strava OAuth URL
        params = {
            "client_id": settings.strava_client_id,
            "redirect_uri": settings.strava_redirect_uri,
            "response_type": "code",
            "scope": "activity:read_all,activity:write",
            "approval_prompt": "force",
            "state": state,  # Pass userId through OAuth state
        }
        
        oauth_url = f"https://www.strava.com/oauth/authorize?{urlencode(params)}"
        
        logger.info(f"OAuth initiation requested for user: {user_id}")
        return OAuthInitiateResponse(url=oauth_url)
    
    except Exception as e:
        logger.error(f"Error initiating OAuth: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate OAuth"
        )


@app.get("/strava/oauth/callback")
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def oauth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    """
    Handle OAuth callback from Strava.
    
    Automatically extracts userId from the OAuth state parameter.
    Exchanges code for tokens and stores them linked to user_id.
    """
    # Extract userId from state parameter
    user_id = None
    if state:
        try:
            import base64
            user_id = base64.urlsafe_b64decode(state.encode()).decode()
        except Exception as e:
            logger.error(f"Failed to decode state parameter: {e}")
    
    # Fallback to query parameter if state is not available (backward compatibility)
    if not user_id:
        user_id = request.query_params.get("userId")
    
    if not user_id:
        logger.error("OAuth callback missing userId (from state or query parameter)")
        return RedirectResponse(
            url=f"{settings.frontend_url}/connected?provider=strava&status=error&error=missing_user_id"
        )
    if error:
        logger.error(f"OAuth error: {error}")
        return RedirectResponse(
            url=f"{settings.frontend_url}/connected?provider=strava&status=error&error={error}"
        )
    
    if not code:
        logger.error("OAuth callback missing code")
        return RedirectResponse(
            url=f"{settings.frontend_url}/connected?provider=strava&status=error&error=missing_code"
        )
    
    try:
        # Exchange code for token
        token_data = await strava_client.exchange_code_for_token(
            code=code,
            client_id=settings.strava_client_id,
            client_secret=settings.strava_client_secret,
        )
        
        # Extract athlete ID from OAuth response
        athlete_id = None
        if "athlete" in token_data and token_data["athlete"]:
            athlete_id = token_data["athlete"].get("id")
        
        # Store tokens (encrypted) linked to user_id
        await token_manager.store_initial_tokens(
            user_id=user_id,
            access_token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            expires_at=token_data["expires_at"],
            athlete_id=athlete_id,
        )
        
        logger.info(f"Successfully connected Strava for user {user_id}")
        
        # Redirect to frontend
        return RedirectResponse(
            url=f"{settings.frontend_url}/connected?provider=strava&status=success"
        )
    
    except StravaAPIError as e:
        logger.error(f"Strava API error during OAuth: {e}")
        return RedirectResponse(
            url=f"{settings.frontend_url}/connected?provider=strava&status=error&error=api_error"
        )
    except Exception as e:
        logger.error(f"Unexpected error during OAuth callback: {e}")
        return RedirectResponse(
            url=f"{settings.frontend_url}/connected?provider=strava&status=error&error=unexpected"
        )


# ============================================================================
# 5.2 Token Management
# ============================================================================

@app.post("/strava/token/refresh", response_model=TokenRefreshResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def refresh_token(
    request: Request,
    user_id: str = Depends(get_user_id),
):
    """
    Refresh access token for a user.
    
    Called automatically when token expires or 401 is received.
    """
    try:
        result = await token_manager.refresh_token(user_id)
        return TokenRefreshResponse(
            success=True,
            expires_at=result["expires_at"],
        )
    except ValueError as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except StravaAPIError as e:
        logger.error(f"Strava API error during refresh: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to refresh token with Strava"
        )
    except Exception as e:
        logger.error(f"Unexpected error during token refresh: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh token"
        )


# ============================================================================
# 5.3 Get Athlete Info (Strava User ID)
# ============================================================================

@app.get("/strava/athlete", response_model=AthleteResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def get_athlete(
    request: Request,
    user_id: str = Depends(get_user_id),
):
    """
    Get authenticated Strava athlete information including user ID.
    
    This endpoint returns your Strava athlete ID and profile information.
    
    Note: You must complete OAuth first by calling /strava/oauth/initiate
    and then /strava/oauth/callback with your userId.
    """
    try:
        # Get valid token (auto-refreshes if needed)
        access_token = await token_manager.get_valid_token(user_id)
        
        # Fetch athlete info from Strava
        athlete = await strava_client.get_athlete(access_token=access_token)
        
        logger.info(f"Successfully fetched athlete info for user {user_id}: {athlete.get('id')}")
        return AthleteResponse(**athlete)
    
    except ValueError as e:
        logger.error(f"Athlete fetch error: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except StravaAPIError as e:
        if "Unauthorized" in str(e):
            # Try to refresh and retry once
            try:
                await token_manager.refresh_token(user_id)
                access_token = await token_manager.get_valid_token(user_id)
                athlete = await strava_client.get_athlete(access_token=access_token)
                return AthleteResponse(**athlete)
            except Exception as retry_error:
                logger.error(f"Retry after refresh failed: {retry_error}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication failed"
                )
        logger.error(f"Strava API error fetching athlete: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)  # Pass through the actual error message
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching athlete: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch athlete"
        )


# ============================================================================
# 5.4 Fetch Activities
# ============================================================================

@app.get("/strava/activities", response_model=List[Activity])
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def get_activities(
    request: Request,
    limit: int = Query(30, ge=1, le=200),
    user_id: str = Depends(get_user_id),
):
    """
    Get user's recent activities from Strava.
    """
    try:
        # Get valid token (auto-refreshes if needed)
        access_token = await token_manager.get_valid_token(user_id)
        
        # Fetch activities
        activities = await strava_client.get_activities(
            access_token=access_token,
            limit=limit,
        )
        
        return activities
    
    except ValueError as e:
        logger.error(f"Activities fetch error: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except StravaAPIError as e:
        if "Unauthorized" in str(e):
            # Try to refresh and retry once
            try:
                await token_manager.refresh_token(user_id)
                access_token = await token_manager.get_valid_token(user_id)
                activities = await strava_client.get_activities(
                    access_token=access_token,
                    limit=limit,
                )
                return activities
            except Exception as retry_error:
                logger.error(f"Retry after refresh failed: {retry_error}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication failed"
                )
        logger.error(f"Strava API error fetching activities: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch activities from Strava"
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching activities: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch activities"
        )


# ============================================================================
# 5.5 Update Activity
# ============================================================================

@app.put("/strava/activities/{activity_id}", response_model=UpdateActivityResponse)
@limiter.limit("30/minute")  # Lower limit for write operations
async def update_activity(
    request: Request,
    activity_id: int = Path(..., description="Strava activity ID"),
    payload: UpdateActivityRequest = ...,
    user_id: str = Depends(get_user_id),
):
    """
    Update a Strava activity with MyAmaka data.
    """
    try:
        # Get valid token
        access_token = await token_manager.get_valid_token(user_id)
        
        # Prepare update data
        name = None
        description = None
        
        if payload.overwriteTitle and payload.newTitle:
            name = payload.newTitle
        
        if payload.overwriteDescription and payload.description:
            description = payload.description
        
        if not name and not description:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one of overwriteTitle+newTitle or overwriteDescription+description must be provided"
            )
        
        # Update activity
        result = await strava_client.update_activity(
            activity_id=activity_id,
            access_token=access_token,
            name=name,
            description=description,
        )
        
        return UpdateActivityResponse(**result)
    
    except ValueError as e:
        logger.error(f"Update activity error: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except StravaAPIError as e:
        if "Unauthorized" in str(e):
            # Try to refresh and retry once
            try:
                await token_manager.refresh_token(user_id)
                access_token = await token_manager.get_valid_token(user_id)
                name = payload.newTitle if payload.overwriteTitle else None
                description = payload.description if payload.overwriteDescription else None
                result = await strava_client.update_activity(
                    activity_id=activity_id,
                    access_token=access_token,
                    name=name,
                    description=description,
                )
                return UpdateActivityResponse(**result)
            except Exception as retry_error:
                logger.error(f"Retry after refresh failed: {retry_error}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication failed"
                )
        logger.error(f"Strava API error updating activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to update activity on Strava"
        )
    except Exception as e:
        logger.error(f"Unexpected error updating activity: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update activity"
        )


# ============================================================================
# 5.6 Upload Image (Stub)
# ============================================================================

@app.post("/strava/activities/{activity_id}/image")
@limiter.limit("30/minute")
async def upload_activity_image(
    request: Request,
    activity_id: int = Path(..., description="Strava activity ID"),
    user_id: str = Depends(get_user_id),
    file: UploadFile = File(..., description="Image file to upload"),
):
    """
    Upload an image to a Strava activity.
    
    Note: Strava API doesn't officially support photo uploads via API.
    Photos typically need to be added manually through the Strava app/website.
    This endpoint will attempt to upload but may return a message indicating
    manual upload is required.
    """
    try:
        # Get valid token
        access_token = await token_manager.get_valid_token(user_id)
        
        # Read image data
        image_data = await file.read()
        image_type = file.content_type or "image/jpeg"
        
        # Store for potential retry
        image_data_copy = image_data
        
        # Attempt upload
        result = await strava_client.upload_activity_image(
            activity_id=activity_id,
            access_token=access_token,
            image_data=image_data,
            image_type=image_type,
        )
        
        # Return appropriate status based on result
        if result.get("status") == "manual_upload_required":
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
        elif result.get("status") == "success":
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
    
    except ValueError as e:
        logger.error(f"Image upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except StravaAPIError as e:
        if "Unauthorized" in str(e):
            # Try to refresh and retry once
            try:
                await token_manager.refresh_token(user_id)
                access_token = await token_manager.get_valid_token(user_id)
                # Use the stored copy since file.read() can only be called once
                result = await strava_client.upload_activity_image(
                    activity_id=activity_id,
                    access_token=access_token,
                    image_data=image_data_copy,
                    image_type=image_type,
                )
                return JSONResponse(status_code=status.HTTP_200_OK, content=result)
            except Exception as retry_error:
                logger.error(f"Retry after refresh failed: {retry_error}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication failed"
                )
        logger.error(f"Strava API error uploading image: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error uploading image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )


# ============================================================================
# 6. Internal Endpoints
# ============================================================================

@app.get("/strava/internal/token/{user_id}", response_model=InternalTokenResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def get_internal_token(
    request: Request,
    user_id: str = Path(..., description="MyAmaka user ID"),
    _: bool = Depends(verify_internal_api_key),
):
    """
    Get current access token for a user.
    
    Only accessible by MyAmaka backend with API key.
    """
    try:
        # Get valid token (decrypted)
        access_token = await token_manager.get_valid_token(user_id)
        
        # Get expiration info
        tokens = await db.get_tokens(user_id)
        expires_at = tokens["expires_at"]
        
        return InternalTokenResponse(
            access_token=access_token,
            expires_at=expires_at,
        )
    
    except ValueError as e:
        logger.error(f"Token retrieval error: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error retrieving token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve token"
        )


# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "strava-connections"}


# ============================================================================
# Startup/Shutdown
# ============================================================================

@app.on_event("startup")
async def startup():
    """Initialize services on startup."""
    logger.info("Starting Strava Connections Service")
    logger.info(f"Frontend URL: {settings.frontend_url}")
    logger.info(f"Strava API Base: {settings.strava_api_base}")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown."""
    await strava_client.close()
    logger.info("Shutting down Strava Connections Service")

