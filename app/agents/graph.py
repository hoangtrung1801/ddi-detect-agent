"""
LangGraph workflow definition for Drug Interaction Agent.

Defines the graph structure and node functions for the agent.
"""

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver

from .state import DrugInteractionAgentState
from .tools import DrugInteractionTools
from .enhanced_tools import EnhancedDrugInteractionTools
from drug_interaction_graph import DrugInteractionGraph


class DrugInteractionGraph:
    """
    LangGraph-based workflow for drug interaction queries.

    Uses a graph structure with nodes for agent reasoning and tool execution.
    """

    def __init__(
        self,
        graph: DrugInteractionGraph,
        model_name: str = "gpt-4o-mini",
        temperature: float = 0.0,
        verbose: bool = False,
        enable_drug_mapping: bool = True,
    ):
        """
        Initialize the drug interaction graph workflow.

        Args:
            graph: DrugInteractionGraph instance with loaded data
            model_name: OpenAI model to use
            temperature: Model temperature (0.0 for deterministic)
            verbose: Whether to print debug information
            enable_drug_mapping: Whether to enable drug name mapping
        """
        self.drug_graph = graph
        self.verbose = verbose
        self.enable_drug_mapping = enable_drug_mapping

        # Initialize LLM
        self.llm = ChatOpenAI(
            model=model_name,
            # temperature=temperature,
            # reasoning_effort="low" if "o3" in model_name else None,
        )

        # Create tools (use enhanced tools if mapping is enabled)
        if enable_drug_mapping:
            tool_builder = EnhancedDrugInteractionTools(graph, enable_drug_mapping=True)
        else:
            tool_builder = DrugInteractionTools(graph)
        self.tools = tool_builder.create_tools()

        # Bind tools to LLM
        self.llm_with_tools = self.llm.bind_tools(self.tools)

        # Build the graph
        self.workflow = self._build_graph()

        # Add memory for conversation history
        self.memory = MemorySaver()

        # Compile the graph
        self.app = self.workflow.compile(checkpointer=self.memory)

    def _build_graph(self) -> StateGraph:
        """
        Build the LangGraph workflow.

        Returns:
            Compiled StateGraph
        """
        # Create the graph
        workflow = StateGraph(DrugInteractionAgentState)

        # Add nodes
        workflow.add_node("agent", self._agent_node)
        workflow.add_node("tools", ToolNode(self.tools))

        # Set entry point
        workflow.set_entry_point("agent")

        # Add conditional edges
        workflow.add_conditional_edges(
            "agent",
            tools_condition,
            {
                "tools": "tools",
                END: END,
            },
        )

        # Add edge from tools back to agent
        workflow.add_edge("tools", "agent")

        return workflow

    def _agent_node(self, state: DrugInteractionAgentState) -> dict:
        """
        Agent reasoning node.

        Processes the current state and decides what to do next.

        Args:
            state: Current agent state

        Returns:
            Updated state
        """
        messages = state.get("messages", [])

        # Add system message if this is the first message
        if not messages or not any(isinstance(m, SystemMessage) for m in messages):
            system_msg = SystemMessage(
                content=(
                    "You are a helpful medical information assistant specialized in drug-drug interactions. "
                    "You have access to a comprehensive database of drug interactions. "
                    "When answering questions:\n"
                    "1. Use the search_drug_interaction tool to find interactions between two specific drugs\n"
                    "2. Use the get_all_drug_interactions tool to find all interactions for a single drug\n"
                    "3. Use the get_drug_statistics tool to get database statistics\n"
                    "4. Provide clear, accurate information based on the database\n"
                    "5. If no interaction is found, clearly state that\n"
                    "6. Always mention that users should consult healthcare professionals for medical advice"
                )
            )
            messages = [system_msg] + messages

        # Invoke LLM with tools
        response = self.llm_with_tools.invoke(messages)

        if self.verbose:
            print(f"Agent response: {response}")

        return {"messages": [response]}

    def invoke(self, input_text: str, thread_id: str = "default") -> str:
        """
        Invoke the agent with a question.

        Args:
            input_text: User's question
            thread_id: Conversation thread ID for memory

        Returns:
            Agent's response as a string
        """
        # Create initial state
        initial_state = {
            "messages": [HumanMessage(content=input_text)],
            "input": input_text,
            "output": "",
            "intermediate_steps": [],
        }

        # Configure thread
        config = {"configurable": {"thread_id": thread_id}}

        try:
            # Run the graph
            result = self.app.invoke(initial_state, config)

            # Extract the final message
            messages = result.get("messages", [])
            if messages:
                # Get the last AI message
                for msg in reversed(messages):
                    if isinstance(msg, AIMessage):
                        return msg.content

            return "I couldn't generate a response."

        except Exception as e:
            if self.verbose:
                print(f"Error in graph execution: {e}")
            return f"Error processing query: {str(e)}"

    def stream(self, input_text: str, thread_id: str = "default"):
        """
        Stream the agent's response.

        Args:
            input_text: User's question
            thread_id: Conversation thread ID for memory

        Yields:
            Chunks of the response
        """
        initial_state = {
            "messages": [HumanMessage(content=input_text)],
            "input": input_text,
            "output": "",
            "intermediate_steps": [],
        }

        config = {"configurable": {"thread_id": thread_id}}

        try:
            for chunk in self.app.stream(initial_state, config):
                yield chunk
        except Exception as e:
            yield {"error": str(e)}

    def get_graph_stats(self) -> dict:
        """Get statistics about the drug interaction database."""
        return self.drug_graph.get_stats()
