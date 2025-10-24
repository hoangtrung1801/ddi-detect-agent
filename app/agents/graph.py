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
        self.model_name = model_name
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
        workflow.add_node("translator", self._translator_node)

        # Set entry point
        workflow.set_entry_point("agent")

        # Add conditional edges
        workflow.add_conditional_edges(
            "agent",
            tools_condition,
            {
                "tools": "tools",
                END: "translator",
            },
        )

        # Add edge from tools back to agent
        workflow.add_edge("tools", "agent")

        # Add edge from translator to end
        workflow.add_edge("translator", END)

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
                # content=(
                #     "You are a helpful medical information assistant specialized in drug-drug interactions. "
                #     "You have access to a comprehensive database of drug interactions. "
                #     "When answering questions:\n"
                #     "1. Use the search_drug_interaction tool to find interactions between two specific drugs\n"
                #     "2. Use the get_all_drug_interactions tool to find all interactions for a single drug\n"
                #     "3. Use the get_drug_statistics tool to get database statistics\n"
                #     "4. Provide clear, accurate information based on the database\n"
                #     "5. If no interaction is found, clearly state that\n"
                #     "6. Always mention that users should consult healthcare professionals for medical advice"
                # )
                content="""
Check drug-drug interactions for a provided list of medications using an intelligent mapping system.

**How It Works:**
The system automatically converts drug names to their active ingredients using AI, then maps them to the database:
- Brand names (e.g., "Tylenol", "Advil", "Coumadin") are converted to generic names (e.g., "Acetaminophen", "Ibuprofen", "Warfarin")
- Generic names are standardized to match the database
- All conversions happen automatically when you use search_drug_interaction

**Your Task:**
1. **Optional**: Use map_drug_name_tool for each drug if you want to explicitly show the conversion process to the user
2. **Required**: Use search_drug_interaction to check ALL unique pairs of drugs
3. **Required**: After checking all pairs, provide a comprehensive summary

**Checking Interactions:**
- For each unique pair (e.g., Drug A + Drug B, Drug A + Drug C, Drug B + Drug C):
  - Use search_drug_interaction with the drug names (conversions happen automatically)
  - Analyze the mechanism, severity, and clinical recommendations
- Think step-by-step about clinical significance before providing your final answer

**Output Format:**
Use clear markdown headings. Structure your response as:

### Drug Name Conversions
(Optional - include this section only if you used map_drug_name_tool)
- [Original Name] → [Active Ingredient] → [Database Name]

### Interactions Between Drug Pairs

#### [Drug 1] + [Drug 2]
**Interaction Details:** [mechanism, severity, recommendations]

#### [Drug 1] + [Drug 3]
**Interaction Details:** [mechanism, severity, recommendations]

(... continue for all pairs)

---

### Final Summary

**Overall Risk:** [High/Medium/Low/None]

**Key Interactions:**
- [Most important findings or "No significant interactions found"]

**Clinical Recommendations:**
- [Specific actions, monitoring needs, or reassurance]
- [Always advise consulting healthcare provider for medical decisions]

**Example Response:**

### Drug Name Conversions

Using map_drug_name_tool:
- Tylenol → Acetaminophen (brand to generic conversion)
- Coumadin → Warfarin (brand to generic conversion)
- Advil → Ibuprofen (brand to generic conversion)

### Interactions Between Drug Pairs

#### Acetaminophen + Warfarin
**Interaction Details:** Acetaminophen may increase the anticoagulant effect of Warfarin, potentially increasing INR. Severity: Moderate. Recommendation: Monitor INR closely if using concurrently.

#### Acetaminophen + Ibuprofen
**Interaction Details:** No significant interaction found.

#### Warfarin + Ibuprofen
**Interaction Details:** Increased risk of bleeding due to combined anticoagulant and antiplatelet effects. Severity: Major. Recommendation: Avoid combination if possible; if necessary, monitor closely for bleeding signs.

---

### Final Summary

**Overall Risk:** High (due to Warfarin + Ibuprofen interaction)

**Key Interactions:**
- **Critical:** Warfarin + Ibuprofen poses major bleeding risk
- **Moderate:** Acetaminophen may affect Warfarin's anticoagulant effect

**Clinical Recommendations:**
- Avoid concurrent use of Warfarin and Ibuprofen if possible
- If Ibuprofen needed, consider alternative pain relief or use with extreme caution
- Monitor INR closely when using Acetaminophen with Warfarin
- Watch for signs of bleeding (bruising, dark stools, etc.)
- Consult healthcare provider before making any changes to medication regimen

**Important:** This information is for educational purposes. Always consult a healthcare professional for medical advice.
"""
            )
            messages = [system_msg] + messages

        # Invoke LLM with tools
        response = self.llm_with_tools.invoke(messages)

        if self.verbose:
            print(f"Agent response: {response}")

        return {"messages": [response]}

    def _translator_node(self, state: DrugInteractionAgentState) -> dict:
        """
        Translation node that translates the agent's output to Vietnamese.

        Args:
            state: Current agent state

        Returns:
            Updated state with Vietnamese translation
        """
        messages = state.get("messages", [])

        # Get the last AI message (the agent's response)
        last_ai_message = None
        for msg in reversed(messages):
            if isinstance(msg, AIMessage):
                last_ai_message = msg
                break

        if not last_ai_message:
            return {"vietnamese_output": "Không thể dịch phản hồi."}

        # Create translation prompt
        translation_prompt = f"""
        Translate the following medical text about drug interactions from English to Vietnamese.
        Keep the markdown formatting intact and ensure medical terminology is accurately translated.
        Maintain the structure with headings, lists, and emphasis.

        Text to translate:
        {last_ai_message.content}
        """

        # Use a separate LLM instance for translation
        translator_llm = ChatOpenAI(
            model=self.model_name,
            temperature=0.1,  # Lower temperature for more consistent translation
        )

        try:
            # Get translation
            translation_response = translator_llm.invoke(
                [
                    SystemMessage(
                        content="You are a professional medical translator specializing in drug interaction information. Translate accurately while preserving markdown formatting."
                    ),
                    HumanMessage(content=translation_prompt),
                ]
            )

            vietnamese_output = translation_response.content

            if self.verbose:
                print(f"Translation completed: {len(vietnamese_output)} characters")

            return {"vietnamese_output": vietnamese_output}

        except Exception as e:
            if self.verbose:
                print(f"Translation error: {e}")
            return {"vietnamese_output": f"Lỗi dịch thuật: {str(e)}"}

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
            "vietnamese_output": "",
            "intermediate_steps": [],
        }

        # Configure thread
        config = {"configurable": {"thread_id": thread_id}}

        try:
            # Run the graph
            result = self.app.invoke(initial_state, config)

            # Extract the final message
            # messages = result.get("messages", [])

            # if messages:
            #     # Get the last AI message
            #     for msg in reversed(messages):
            #         if isinstance(msg, AIMessage):
            # return msg.content

            content = result.get("vietnamese_output", "")

            return content or "I couldn't generate a response."

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
            "vietnamese_output": "",
            "intermediate_steps": [],
        }

        config = {"configurable": {"thread_id": thread_id}}

        try:
            for chunk in self.app.stream(initial_state, config):
                yield chunk
        except Exception as e:
            yield {"error": str(e)}

    def invoke_with_translation(
        self, input_text: str, thread_id: str = "default"
    ) -> dict:
        """
        Invoke the agent with a question and get both English and Vietnamese responses.

        Args:
            input_text: User's question
            thread_id: Conversation thread ID for memory

        Returns:
            Dictionary with 'english' and 'vietnamese' keys containing the responses
        """
        # Create initial state
        initial_state = {
            "messages": [HumanMessage(content=input_text)],
            "input": input_text,
            "output": "",
            "vietnamese_output": "",
            "intermediate_steps": [],
        }

        # Configure thread
        config = {"configurable": {"thread_id": thread_id}}

        try:
            # Run the graph
            result = self.app.invoke(initial_state, config)

            # Extract the final message and Vietnamese translation
            messages = result.get("messages", [])
            vietnamese_output = result.get("vietnamese_output", "")

            english_output = ""
            if messages:
                # Get the last AI message
                for msg in reversed(messages):
                    if isinstance(msg, AIMessage):
                        english_output = msg.content
                        break

            return {
                "english": english_output or "I couldn't generate a response.",
                "vietnamese": vietnamese_output or "Không thể tạo phản hồi.",
            }

        except Exception as e:
            if self.verbose:
                print(f"Error in graph execution: {e}")
            return {
                "english": f"Error processing query: {str(e)}",
                "vietnamese": f"Lỗi xử lý truy vấn: {str(e)}",
            }

    def get_graph_stats(self) -> dict:
        """Get statistics about the drug interaction database."""
        return self.drug_graph.get_stats()
