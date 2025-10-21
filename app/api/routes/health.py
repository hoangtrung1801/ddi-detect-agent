"""Health check and root endpoints."""

from datetime import datetime
from fastapi import APIRouter

from app.models import HealthResponse
from app.core.agent import agent_manager

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Check if the API is running and the agent is loaded",
    tags=["System"],
)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if agent_manager.agent is not None else "unhealthy",
        agent_loaded=agent_manager.agent is not None,
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get(
    "/",
    summary="API Root",
    description="Root endpoint with API information",
    tags=["System"],
)
async def root():
    """Root endpoint."""
    return {
        "name": "Drug Interaction Agent API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "stats": "/stats",
    }
