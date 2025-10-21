"""Statistics endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.models import StatsResponse
from app.core.agent import agent_manager

router = APIRouter()


@router.get(
    "/stats",
    response_model=StatsResponse,
    summary="Get Statistics",
    description="Get statistics about the drug interaction database and active sessions",
    tags=["Statistics"],
)
async def get_stats():
    """Get database and session statistics."""
    try:
        agent = agent_manager.get_agent()
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Agent not loaded"
        )

    stats = agent.get_graph_stats()

    return StatsResponse(
        total_drugs=stats["drugs"],
        total_interactions=stats["interactions"],
        active_sessions=agent_manager.get_active_sessions_count(),
    )
