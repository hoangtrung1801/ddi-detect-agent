"""
State definition for LangGraph Drug Interaction Agent.

Defines the state structure that flows through the agent graph.
"""

from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class DrugInteractionAgentState(TypedDict):
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

    # Translated output in Vietnamese
    vietnamese_output: str

    # Drug links from drugs.com
    drug_links: dict

    # Intermediate steps (for debugging/logging)
    intermediate_steps: list


class DrugNameExtractAgentState(TypedDict):
    """
    State for the drug name extract agent.
    """

    input: str
    output: str
    intermediate_steps: list
