"""Detection router for workout auto-detection endpoint.

Part of AMA-688: POST /workouts/detect endpoint that matches
wearable-detected exercises against scheduled AmakaFlow workouts.

Endpoint: POST /workouts/detect
"""

from fastapi import APIRouter, Depends

from api.deps import get_auth_context, AuthContext
from api.schemas.detection import DetectionRequest, DetectionMatch
from application.use_cases.match_workout import match_workout


router = APIRouter(prefix="/api/workouts", tags=["detection"])


@router.post("/detect", response_model=DetectionMatch)
async def detect_workout(
    request: DetectionRequest,
    auth: AuthContext = Depends(get_auth_context),
) -> DetectionMatch:
    """Detect and match workout from wearable device data.
    
    When a wearable device detects exercise patterns on-device, it calls
    this endpoint to match the detected activity against the user's
    scheduled AmakaFlow workouts.
    
    Returns the best match if confidence exceeds 0.85, otherwise returns
    a no-match with a reason code.
    
    ## Request Body
    - **user_id**: User identifier
    - **device**: Device type ("apple_watch" | "garmin" | "wear_os")
    - **timestamp**: Detection timestamp
    - **sport**: Detected sport type
    - **detected_exercises**: List of detected exercise names
    
    ## Response
    - **matched**: Boolean indicating if a match was found
    - **workout_id**: ID of matched workout (if matched)
    - **workout_name**: Name of matched workout (if matched)
    - **confidence**: Match confidence score (if matched)
    - **reason**: Reason code if not matched ("no_scheduled_workout" | "low_confidence" | "sport_mismatch")
    
    Requires authentication.
    """
    # Always use user_id from auth context for security
    user_id = auth.user_id
    
    # Create request with authenticated user_id
    authenticated_request = DetectionRequest(
        user_id=user_id,
        device=request.device,
        timestamp=request.timestamp,
        sport=request.sport,
        detected_exercises=request.detected_exercises,
    )
    
    return await match_workout(authenticated_request)
