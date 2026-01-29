"""Chat streaming endpoint.

POST /chat/stream returns an SSE event stream via sse-starlette.
GET /chat/sessions returns a paginated list of user's chat sessions.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from api.deps import (
    get_auth_context,
    get_chat_session_repository,
    get_current_user,
    get_stream_chat_use_case,
    AuthContext,
)
from application.use_cases.stream_chat import StreamChatUseCase
from infrastructure.db.chat_session_repository import SupabaseChatSessionRepository

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    """Request body for chat streaming."""

    message: str = Field(..., min_length=1, max_length=10000)
    session_id: Optional[str] = None


@router.post("/stream")
def stream_chat(
    body: ChatRequest,
    auth: AuthContext = Depends(get_auth_context),
    use_case: StreamChatUseCase = Depends(get_stream_chat_use_case),
):
    """Stream a chat response as Server-Sent Events.

    Returns an SSE stream with event types:
    - message_start: Session info
    - content_delta: Incremental text
    - function_call: Tool invocation
    - function_result: Tool result
    - message_end: Final stats
    - error: Error details
    """

    def event_generator():
        for sse_event in use_case.execute(
            user_id=auth.user_id,
            message=body.message,
            session_id=body.session_id,
            auth_token=auth.auth_token,
        ):
            yield {"event": sse_event.event, "data": sse_event.data}

    return EventSourceResponse(event_generator())


class ChatSessionSummary(BaseModel):
    """Summary of a chat session for listing."""

    id: str
    title: Optional[str]
    created_at: datetime
    updated_at: datetime


@router.get("/sessions", response_model=List[ChatSessionSummary])
async def list_sessions(
    user_id: str = Depends(get_current_user),
    session_repo: SupabaseChatSessionRepository = Depends(get_chat_session_repository),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> List[ChatSessionSummary]:
    """List all chat sessions for the authenticated user.

    Returns sessions ordered by updated_at DESC (most recently active first).
    Supports pagination via limit and offset query parameters.
    """
    sessions = session_repo.list_for_user(user_id, limit=limit, offset=offset)
    return [
        ChatSessionSummary(
            id=s["id"],
            title=s["title"],
            created_at=s["created_at"],
            updated_at=s["updated_at"],
        )
        for s in sessions
    ]
