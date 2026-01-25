"""
Program generation router.

Part of AMA-461: Create program-api service scaffold

This router provides endpoints for AI-powered program generation:
- Generate new training programs based on user preferences

Note: These are stubs that will be implemented in AMA-462.
"""

from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_current_user
from models.generation import GenerateProgramRequest, GenerateProgramResponse
from models.program import TrainingProgram

router = APIRouter(
    prefix="/generate",
    tags=["Generation"],
)


@router.post("", response_model=GenerateProgramResponse)
async def generate_program(
    request: GenerateProgramRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Generate a new training program using AI.

    This endpoint takes user preferences and generates a personalized
    training program using AI models.

    Args:
        request: Generation parameters including goal, duration, etc.

    Returns:
        Generated training program with metadata
    """
    # Stub: Will be implemented in AMA-462
    raise HTTPException(status_code=501, detail="Not implemented")
