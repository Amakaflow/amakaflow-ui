"""Strava API client."""
import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class StravaAPIError(Exception):
    """Custom exception for Strava API errors."""
    pass


class StravaClient:
    """Client for interacting with Strava API."""
    
    def __init__(self, base_url: str = "https://www.strava.com/api/v3"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def exchange_code_for_token(
        self,
        code: str,
        client_id: str,
        client_secret: str,
    ) -> Dict[str, Any]:
        """
        Exchange authorization code for access token.
        
        Args:
            code: Authorization code from OAuth callback
            client_id: Strava client ID
            client_secret: Strava client secret
            
        Returns:
            Token response with access_token, refresh_token, expires_at
        """
        url = f"{self.base_url}/oauth/token"
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
        }
        
        try:
            response = await self.client.post(url, json=data)
            response.raise_for_status()
            token_data = response.json()
            
            logger.info("Successfully exchanged code for token")
            return {
                "access_token": token_data["access_token"],
                "refresh_token": token_data["refresh_token"],
                "expires_at": token_data["expires_at"],
                "athlete": token_data.get("athlete", {}),
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to exchange token: {e.response.text}")
            raise StravaAPIError(f"Token exchange failed: {e.response.text}")
        except Exception as e:
            logger.error(f"Unexpected error during token exchange: {e}")
            raise StravaAPIError(f"Token exchange error: {str(e)}")
    
    async def refresh_access_token(
        self,
        refresh_token: str,
        client_id: str,
        client_secret: str,
    ) -> Dict[str, Any]:
        """
        Refresh access token using refresh token.
        
        Args:
            refresh_token: Current refresh token
            client_id: Strava client ID
            client_secret: Strava client secret
            
        Returns:
            New token data
        """
        url = f"{self.base_url}/oauth/token"
        data = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        
        try:
            response = await self.client.post(url, json=data)
            response.raise_for_status()
            token_data = response.json()
            
            logger.info("Successfully refreshed access token")
            return {
                "access_token": token_data["access_token"],
                "refresh_token": token_data.get("refresh_token", refresh_token),
                "expires_at": token_data["expires_at"],
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to refresh token: {e.response.text}")
            raise StravaAPIError(f"Token refresh failed: {e.response.text}")
        except Exception as e:
            logger.error(f"Unexpected error during token refresh: {e}")
            raise StravaAPIError(f"Token refresh error: {str(e)}")
    
    async def get_athlete(self, access_token: str) -> Dict[str, Any]:
        """
        Get authenticated athlete information.
        
        Args:
            access_token: Valid access token
            
        Returns:
            Athlete information including ID, username, etc.
        """
        url = f"{self.base_url}/athlete"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        try:
            response = await self.client.get(url, headers=headers)
            
            if response.status_code == 401:
                raise StravaAPIError("Unauthorized - token expired or invalid")
            
            response.raise_for_status()
            athlete = response.json()
            
            # Handle different possible field names for profile picture
            profile = athlete.get("profile") or athlete.get("profile_medium") or athlete.get("avatar_url") or ""
            
            return {
                "id": athlete["id"],
                "username": athlete.get("username") or athlete.get("login", ""),
                "firstname": athlete.get("firstname", ""),
                "lastname": athlete.get("lastname", ""),
                "profile": profile,
            }
        except httpx.HTTPStatusError as e:
            error_detail = e.response.text
            logger.error(f"Failed to fetch athlete (status {e.response.status_code}): {error_detail}")
            if e.response.status_code == 401:
                raise StravaAPIError("Unauthorized - token expired or invalid. Please reconnect via OAuth.")
            elif e.response.status_code == 403:
                raise StravaAPIError("Forbidden - insufficient permissions. Check your OAuth scopes.")
            raise StravaAPIError(f"Failed to fetch athlete from Strava API: {error_detail}")
        except KeyError as e:
            logger.error(f"Missing expected field in athlete response: {e}")
            raise StravaAPIError(f"Unexpected response format from Strava API: missing field {e}")
        except Exception as e:
            logger.error(f"Unexpected error fetching athlete: {e}", exc_info=True)
            raise StravaAPIError(f"Error fetching athlete: {str(e)}")
    
    async def get_activities(
        self,
        access_token: str,
        limit: int = 30,
        page: int = 1,
    ) -> List[Dict[str, Any]]:
        """
        Get athlete activities.
        
        Args:
            access_token: Valid access token
            limit: Number of activities to return
            page: Page number
            
        Returns:
            List of activities
        """
        url = f"{self.base_url}/athlete/activities"
        headers = {"Authorization": f"Bearer {access_token}"}
        params = {"per_page": limit, "page": page}
        
        try:
            response = await self.client.get(url, headers=headers, params=params)
            
            if response.status_code == 401:
                raise StravaAPIError("Unauthorized - token expired or invalid")
            
            response.raise_for_status()
            activities = response.json()
            
            # Format activities for response
            formatted = []
            for activity in activities:
                formatted.append({
                    "id": activity["id"],
                    "name": activity["name"],
                    "start_date": activity["start_date"],
                    "distance": activity.get("distance", 0),
                    "elapsed_time": activity.get("elapsed_time", 0),
                    "type": activity.get("type", "Unknown"),
                })
            
            return formatted
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to fetch activities: {e.response.text}")
            if e.response.status_code == 401:
                raise StravaAPIError("Unauthorized")
            raise StravaAPIError(f"Failed to fetch activities: {e.response.text}")
        except Exception as e:
            logger.error(f"Unexpected error fetching activities: {e}")
            raise StravaAPIError(f"Error fetching activities: {str(e)}")
    
    async def update_activity(
        self,
        activity_id: int,
        access_token: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Update an activity.
        
        Args:
            activity_id: Strava activity ID
            access_token: Valid access token
            name: New activity name (optional)
            description: New activity description (optional)
            
        Returns:
            Updated activity data
        """
        url = f"{self.base_url}/activities/{activity_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        data = {}
        if name is not None:
            data["name"] = name
        if description is not None:
            # Strava has a 2000 character limit for description
            if len(description) > 2000:
                logger.warning(f"Description truncated from {len(description)} to 2000 chars")
                description = description[:2000]
            data["description"] = description
        
        if not data:
            raise ValueError("At least one of name or description must be provided")
        
        try:
            response = await self.client.put(url, headers=headers, json=data)
            
            if response.status_code == 401:
                raise StravaAPIError("Unauthorized - token expired or invalid")
            
            response.raise_for_status()
            activity = response.json()
            
            logger.info(f"Successfully updated activity {activity_id}")
            return {
                "id": activity["id"],
                "name": activity["name"],
                "description": activity.get("description", ""),
                "updated_at": datetime.now().isoformat(),
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to update activity: {e.response.text}")
            if e.response.status_code == 401:
                raise StravaAPIError("Unauthorized")
            raise StravaAPIError(f"Failed to update activity: {e.response.text}")
        except Exception as e:
            logger.error(f"Unexpected error updating activity: {e}")
            raise StravaAPIError(f"Error updating activity: {str(e)}")
    
    async def upload_activity_image(
        self,
        activity_id: int,
        access_token: str,
        image_data: bytes,
        image_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """
        Upload an image to an activity.
        
        Note: Strava API doesn't directly support photo uploads via API.
        This implementation attempts to use the uploads endpoint, but photos
        typically need to be added manually through the Strava app/website.
        
        Args:
            activity_id: Strava activity ID
            access_token: Valid access token
            image_data: Image file bytes
            image_type: MIME type of image
            
        Returns:
            Upload result
        """
        # Strava doesn't have a direct photo upload endpoint for activities
        # Photos must be uploaded through the mobile app or website
        # However, we can attempt to use the uploads endpoint with activity_id
        url = f"{self.base_url}/uploads"
        headers = {
            "Authorization": f"Bearer {access_token}",
        }
        
        # Prepare multipart form data
        files = {
            "file": ("image.jpg", image_data, image_type),
        }
        data = {
            "activity_type": "workout",  # Generic type
            "data_type": "fit",  # Required but not used for photos
        }
        
        try:
            # Note: This may not work as Strava API doesn't officially support
            # photo uploads via API. This is an attempt based on uploads endpoint.
            response = await self.client.post(
                url,
                headers=headers,
                files=files,
                data=data,
            )
            
            if response.status_code == 401:
                raise StravaAPIError("Unauthorized - token expired or invalid")
            
            if response.status_code not in [200, 201]:
                logger.warning(
                    f"Photo upload may not be supported via API. "
                    f"Status: {response.status_code}, Response: {response.text}"
                )
                # Return a message indicating manual upload is needed
                return {
                    "status": "manual_upload_required",
                    "message": "Strava API doesn't support direct photo uploads. "
                               "Please upload photos manually through the Strava app or website.",
                    "activity_id": activity_id,
                }
            
            result = response.json()
            logger.info(f"Upload initiated for activity {activity_id}")
            return {
                "status": "success",
                "activity_id": activity_id,
                "upload_id": result.get("id"),
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to upload image: {e.response.text}")
            if e.response.status_code == 401:
                raise StravaAPIError("Unauthorized")
            # Return helpful message instead of error
            return {
                "status": "manual_upload_required",
                "message": "Strava API doesn't support direct photo uploads. "
                           "Please upload photos manually through the Strava app or website.",
                "activity_id": activity_id,
            }
        except Exception as e:
            logger.error(f"Unexpected error uploading image: {e}")
            return {
                "status": "error",
                "message": f"Error uploading image: {str(e)}. "
                           "Please upload photos manually through the Strava app or website.",
                "activity_id": activity_id,
            }
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

