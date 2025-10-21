"""
REST API for Drug Interaction Agent

FastAPI application providing HTTP endpoints for drug interaction queries.
"""

import os
import uuid
from typing import Optional, Dict
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from drug_agent import create_agent, DrugInteractionAgent


# Load environment variables
load_dotenv()

# Global variables for agent and sessions
agent: Optional[DrugInteractionAgent] = None
sessions: Dict[str, DrugInteractionAgent] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    global agent

    # Startup: Load the agent
    data_file = os.getenv("DATA_FILE", "TWOSIDES_preprocessed.csv")

    if not os.path.exists(data_file):
        raise FileNotFoundError(f"Data file '{data_file}' not found")

    if not os.getenv("OPENAI_API_KEY"):
        raise ValueError("OPENAI_API_KEY not found in environment variables")

    print("🚀 Starting Drug Interaction Agent API...")
    agent = create_agent(
        data_filepath=data_file,
        model_name=os.getenv("OPENAI_MODEL", "gpt-5-mini-2025-08-07"),
        verbose=False,
    )
    print("✅ Agent loaded and ready!")

    yield

    # Shutdown: Cleanup
    print("👋 Shutting down...")
    sessions.clear()


# Initialize FastAPI app
app = FastAPI(
    title="Drug Interaction Agent API",
    description="AI-powered drug interaction query API using LangChain and DrugInteractionGraph",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class QueryRequest(BaseModel):
    """Request model for simple query."""

    question: str = Field(
        ...,
        description="Natural language question about drug interactions",
        min_length=1,
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"question": "What are the interactions between Warfarin and Aspirin?"}
            ]
        }
    }


class QueryResponse(BaseModel):
    """Response model for query."""

    answer: str = Field(..., description="Agent's response to the query")
    timestamp: str = Field(..., description="ISO timestamp of the response")


class ChatRequest(BaseModel):
    """Request model for chat with session."""

    question: str = Field(
        ...,
        description="Natural language question about drug interactions",
        min_length=1,
    )
    session_id: Optional[str] = Field(
        None, description="Session ID for conversation continuity"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "question": "Show me all interactions for Metformin",
                    "session_id": "optional-session-id",
                }
            ]
        }
    }


class ChatResponse(BaseModel):
    """Response model for chat."""

    answer: str = Field(..., description="Agent's response to the query")
    session_id: str = Field(..., description="Session ID for this conversation")
    timestamp: str = Field(..., description="ISO timestamp of the response")


class StatsResponse(BaseModel):
    """Response model for statistics."""

    total_drugs: int = Field(..., description="Total number of drugs in the database")
    total_interactions: int = Field(
        ..., description="Total number of drug interactions"
    )
    active_sessions: int = Field(..., description="Number of active chat sessions")


class HealthResponse(BaseModel):
    """Response model for health check."""

    status: str = Field(..., description="API status")
    agent_loaded: bool = Field(..., description="Whether the agent is loaded")
    timestamp: str = Field(..., description="ISO timestamp")


class ErrorResponse(BaseModel):
    """Response model for errors."""

    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")


# API Endpoints


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Check if the API is running and the agent is loaded",
)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if agent is not None else "unhealthy",
        agent_loaded=agent is not None,
        timestamp=datetime.utcnow().isoformat(),
    )


@app.get(
    "/stats",
    response_model=StatsResponse,
    summary="Get Statistics",
    description="Get statistics about the drug interaction database and active sessions",
)
async def get_stats():
    """Get database and session statistics."""
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Agent not loaded"
        )

    stats = agent.get_graph_stats()

    return StatsResponse(
        total_drugs=stats["drugs"],
        total_interactions=stats["interactions"],
        active_sessions=len(sessions),
    )


@app.post(
    "/query",
    response_model=QueryResponse,
    summary="Query Drug Interactions",
    description="Ask a question about drug interactions without session management",
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
    if agent is None:
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


@app.post(
    "/chat",
    response_model=ChatResponse,
    summary="Chat with Session",
    description="Ask questions with conversation history maintained via session ID",
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
    if agent is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Agent not loaded"
        )

    try:
        # Get or create session
        session_id = request.session_id or str(uuid.uuid4())

        if session_id not in sessions:
            # Create new session with a fresh agent instance
            from drug_agent import DrugInteractionAgent

            sessions[session_id] = DrugInteractionAgent(
                graph=agent.graph,  # Share the same graph
                openai_api_key=os.getenv("OPENAI_API_KEY"),
                model_name=os.getenv("OPENAI_MODEL", "gpt-5-mini-2025-08-07"),
                verbose=False,
            )

        session_agent = sessions[session_id]

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


@app.delete(
    "/chat/{session_id}",
    summary="Clear Session",
    description="Clear conversation history for a specific session",
)
async def clear_session(session_id: str):
    """Clear or delete a chat session."""
    if session_id in sessions:
        sessions[session_id].clear_memory()
        del sessions[session_id]
        return {"message": f"Session {session_id} cleared", "success": True}
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )


@app.get("/", summary="API Root", description="Root endpoint with API information")
async def root():
    """Root endpoint."""
    return {
        "name": "Drug Interaction Agent API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "stats": "/stats",
    }


if __name__ == "__main__":
    import uvicorn

    # Run the API
    uvicorn.run(
        "drug_agent_api:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
        reload=os.getenv("API_RELOAD", "true").lower() == "true",
    )
