"""Chat streaming endpoint.

POST /chat/stream returns an SSE event stream via sse-starlette.
GET /chat/sessions returns a paginated list of user's chat sessions.
GET /chat/sessions/{session_id}/messages returns messages for a session.
DELETE /chat/sessions/{session_id} deletes a chat session and its messages.
"""

from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from api.deps import (
    get_auth_context,
    get_chat_message_repository,
    get_chat_session_repository,
    get_current_user,
    get_stream_chat_use_case,
    AuthContext,
)
from application.use_cases.stream_chat import StreamChatUseCase
from infrastructure.db.chat_message_repository import SupabaseChatMessageRepository
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


class ChatMessage(BaseModel):
    """A single chat message."""

    id: str
    role: str
    content: Optional[str]
    tool_calls: Optional[Any] = None
    tool_results: Optional[Any] = None
    created_at: datetime


class ChatMessagesResponse(BaseModel):
    """Response for listing chat messages."""

    messages: List[ChatMessage]
    has_more: bool


@router.get("/sessions/{session_id}/messages", response_model=ChatMessagesResponse)
async def get_session_messages(
    session_id: str,
    user_id: str = Depends(get_current_user),
    session_repo: SupabaseChatSessionRepository = Depends(get_chat_session_repository),
    message_repo: SupabaseChatMessageRepository = Depends(get_chat_message_repository),
    limit: int = Query(50, ge=1, le=200),
    before: Optional[str] = Query(None, description="Cursor: message ID to fetch messages before"),
) -> ChatMessagesResponse:
    """Get messages for a specific chat session.

    Returns messages in chronological order (oldest first).
    Supports cursor-based pagination via the `before` parameter.

    Args:
        session_id: The session ID to fetch messages for.
        limit: Maximum number of messages to return (1-200, default 50).
        before: Optional cursor - message ID to fetch messages before.

    Returns:
        ChatMessagesResponse with messages and has_more flag.

    Raises:
        HTTPException 404: If session not found or doesn't belong to user.
    """
    session = session_repo.get(session_id, user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = message_repo.list_for_session(session_id, limit=limit, before=before)

    return ChatMessagesResponse(
        messages=[
            ChatMessage(
                id=m["id"],
                role=m["role"],
                content=m["content"],
                tool_calls=m["tool_calls"],
                tool_results=m["tool_results"],
                created_at=m["created_at"],
            )
            for m in messages
        ],
        has_more=len(messages) == limit,
    )


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user),
    session_repo: SupabaseChatSessionRepository = Depends(get_chat_session_repository),
) -> None:
    """Delete a chat session and all its messages.

    Messages are automatically deleted via FK cascade constraint.

    Args:
        session_id: The session ID to delete.

    Raises:
        HTTPException 404: If session not found or doesn't belong to user.
    """
    deleted = session_repo.delete(session_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
