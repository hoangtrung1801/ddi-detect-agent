"""Agent management and initialization."""

import os
import uuid
from typing import Dict, Optional

from app.agents import create_agent, DrugInteractionAgent
from app.core.config import settings


class AgentManager:
    """Manages the drug interaction agent and sessions."""

    def __init__(self):
        """Initialize the agent manager."""
        self.agent: Optional[DrugInteractionAgent] = None
        self.sessions: Dict[str, DrugInteractionAgent] = {}

    def initialize_agent(self) -> None:
        """Initialize the main agent."""
        # Use GraphML file instead of CSV
        graphml_file = "drug_interactions.graphml"

        if not os.path.exists(graphml_file):
            raise FileNotFoundError(f"GraphML file '{graphml_file}' not found")

        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not found in environment variables")

        print("🚀 Starting Drug Interaction Agent API (LangGraph)...")
        self.agent = create_agent(
            data_filepath=graphml_file,
            openai_api_key=settings.OPENAI_API_KEY,
            model_name=settings.OPENAI_MODEL,
            verbose=settings.AGENT_VERBOSE,
        )
        print("✅ LangGraph Agent loaded and ready!")

    def get_agent(self) -> DrugInteractionAgent:
        """Get the main agent instance."""
        if self.agent is None:
            raise RuntimeError("Agent not initialized")
        return self.agent

    def get_or_create_session(
        self, session_id: Optional[str] = None
    ) -> tuple[str, DrugInteractionAgent]:
        """
        Get an existing session or create a new one.

        Args:
            session_id: Optional session ID. If None, creates a new session.

        Returns:
            Tuple of (session_id, session_agent)
        """
        if self.agent is None:
            raise RuntimeError("Main agent not initialized")

        # Generate session ID if not provided
        if session_id is None:
            session_id = str(uuid.uuid4())

        # Create new session if it doesn't exist
        if session_id not in self.sessions:
            self.sessions[session_id] = DrugInteractionAgent(
                graph=self.agent.graph,  # Share the same graph
                openai_api_key=settings.OPENAI_API_KEY,
                model_name=settings.OPENAI_MODEL,
                verbose=settings.AGENT_VERBOSE,
                thread_id=session_id,  # Use session_id as thread_id for memory
            )

        return session_id, self.sessions[session_id]

    def clear_session(self, session_id: str) -> bool:
        """
        Clear a specific session.

        Args:
            session_id: Session ID to clear

        Returns:
            True if session was found and cleared, False otherwise
        """
        if session_id in self.sessions:
            self.sessions[session_id].clear_memory()
            del self.sessions[session_id]
            return True
        return False

    def get_active_sessions_count(self) -> int:
        """Get the count of active sessions."""
        return len(self.sessions)

    def cleanup(self) -> None:
        """Cleanup all sessions."""
        print("👋 Shutting down...")
        self.sessions.clear()


# Global agent manager instance
agent_manager = AgentManager()
