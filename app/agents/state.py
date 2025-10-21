"""
State definition for LangGraph Drug Interaction Agent.

Defines the state structure that flows through the agent graph.
"""

from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """
    State for the drug interaction agent.

    This state is passed between nodes in the LangGraph workflow.
    """

    # Messages in the conversation (accumulated over time)
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # Current input from the user
    input: str

    # Agent's output/response
    output: str

    # Intermediate steps (for debugging/logging)
    intermediate_steps: list
