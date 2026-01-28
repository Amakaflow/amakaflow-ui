"""Chat streaming endpoint.

POST /chat/stream returns an SSE event stream via sse-starlette.
"""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from api.deps import get_auth_context, get_stream_chat_use_case, AuthContext
from application.use_cases.stream_chat import StreamChatUseCase

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
