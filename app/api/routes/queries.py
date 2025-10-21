"""Query and chat endpoints."""

from datetime import datetime
from fastapi import APIRouter, HTTPException, status

from app.models import (
    QueryRequest,
    QueryResponse,
    ChatRequest,
    ChatResponse,
    ErrorResponse,
)
from app.core.agent import agent_manager

router = APIRouter()


@router.post(
    "/query",
    response_model=QueryResponse,
    summary="Query Drug Interactions",
    description="Ask a question about drug interactions without session management",
    tags=["Queries"],
    responses={
        200: {"description": "Successful response"},
        503: {"model": ErrorResponse, "description": "Agent not available"},
    },
)
async def query_drug_interaction(request: QueryRequest):
    """
    Simple query endpoint without session management.
    Each query is independent with no conversation history.
    """
    try:
        agent = agent_manager.get_agent()
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Agent not loaded"
        )

    try:
        # Clear memory to ensure no history
        agent.clear_memory()

        # Process query
        answer = agent.query(request.question)

        return QueryResponse(answer=answer, timestamp=datetime.utcnow().isoformat())

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing query: {str(e)}",
        )


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Chat with Session",
    description="Ask questions with conversation history maintained via session ID",
    tags=["Chat"],
    responses={
        200: {"description": "Successful response"},
        503: {"model": ErrorResponse, "description": "Agent not available"},
    },
)
async def chat_with_session(request: ChatRequest):
    """
    Chat endpoint with session management.
    Maintains conversation history across requests using session_id.
    """
    try:
        agent_manager.get_agent()
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Agent not loaded"
        )

    try:
        # Get or create session
        session_id, session_agent = agent_manager.get_or_create_session(
            request.session_id
        )

        # Process query with session agent
        answer = session_agent.query(request.question)

        return ChatResponse(
            answer=answer,
            session_id=session_id,
            timestamp=datetime.utcnow().isoformat(),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat: {str(e)}",
        )


@router.delete(
    "/chat/{session_id}",
    summary="Clear Session",
    description="Clear conversation history for a specific session",
    tags=["Chat"],
)
async def clear_session(session_id: str):
    """Clear or delete a chat session."""
    if agent_manager.clear_session(session_id):
        return {"message": f"Session {session_id} cleared", "success": True}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
