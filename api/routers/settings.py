"""
Settings Router

Handles user default settings for workout processing.
- GET /settings/defaults: Retrieve current user settings
- PUT /settings/defaults: Update user default settings
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yaml
import pathlib
import logging

from backend.adapters.blocks_to_hyrox_yaml import load_user_defaults

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    responses={404: {"description": "Not found"}},
)


class UserDefaultsRequest(BaseModel):
    """Request model for updating user defaults."""
    distance_handling: str
    default_exercise_value: str
    ignore_distance: bool


@router.get("/defaults")
def get_defaults():
    """
    Get current user default settings.
    
    Returns:
        dict: Current user default settings (distance_handling, default_exercise_value, ignore_distance)
    """
    try:
        return load_user_defaults()
    except Exception as e:
        logger.error(f"Error loading user defaults: {e}")
        raise HTTPException(status_code=500, detail="Failed to load user defaults")


@router.put("/defaults")
def update_defaults(p: UserDefaultsRequest):
    """
    Update user default settings.
    
    Args:
        p (UserDefaultsRequest): Settings to update
        - distance_handling: How to handle distance values
        - default_exercise_value: Default value for exercises
        - ignore_distance: Whether to ignore distance in workouts
    
    Returns:
        dict: Confirmation message and updated settings
        
    Raises:
        HTTPException: If settings file cannot be written
    """
    try:
        ROOT = pathlib.Path(__file__).resolve().parents[2]
        USER_DEFAULTS_FILE = ROOT / "shared/settings/user_defaults.yaml"
        
        # Create directory if needed
        USER_DEFAULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # Prepare data structure
        data = {
            "defaults": {
                "distance_handling": p.distance_handling,
                "default_exercise_value": p.default_exercise_value,
                "ignore_distance": p.ignore_distance
            }
        }
        
        # Save settings to YAML file
        with open(USER_DEFAULTS_FILE, 'w') as f:
            yaml.safe_dump(data, f, sort_keys=False, default_flow_style=False)
        
        logger.info(f"Updated user defaults: {data['defaults']}")
        
        return {
            "message": "Settings updated successfully",
            "settings": data["defaults"]
        }
        
    except Exception as e:
        logger.error(f"Error updating user defaults: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user defaults")
