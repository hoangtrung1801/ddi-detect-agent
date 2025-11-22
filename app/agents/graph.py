"""
LangGraph workflow definition for Drug Interaction Agent.

Defines the graph structure and node functions for the agent.
"""

import re
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver

from .state import DrugInteractionAgentState
from .tools import DrugInteractionTools
from .enhanced_tools import EnhancedDrugInteractionTools
from .models import DrugInteractionResult
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
        workflow.add_node("parser", self._parser_node)

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

        # Add edge from translator to parser
        workflow.add_edge("translator", "parser")

        # Add edge from parser to end
        workflow.add_edge("parser", END)

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

**Your Task (IMPORTANT - Follow This Order):**
1. **REQUIRED FIRST STEP**: Use find_drug_detail_links tool with the user's original query to find drug information links from drugs.com for all drugs mentioned
2. **Optional**: Use map_drug_name_tool for each drug if you want to explicitly show the conversion process to the user
3. **Required**: Use search_drug_interaction to check ALL unique pairs of drugs
4. **Required**: After checking all pairs, provide a comprehensive summary

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

    def _extract_drug_conversions_from_messages(self, messages) -> dict:
        """
        Extract drug name conversions from tool call messages.

        Looks for patterns like:
        - "Converted 'original' → 'converted'"
        - "• Converted 'original' → 'converted'"
        - "Mapped 'original' to 'converted'"
        - "LLM Conversion: 'original' → 'converted'"

        Args:
            messages: List of messages from state

        Returns:
            Dictionary mapping original drug names to converted names
        """
        conversions = {}

        # Look through messages for tool responses containing conversions
        for msg in messages:
            if hasattr(msg, "content") and msg.content:
                content = str(msg.content)

                # Pattern 1: "Converted 'original' → 'converted'" or "• Converted 'original' → 'converted'"
                pattern1 = r"(?:•\s*)?Converted\s+['\"]([^'\"]+)['\"]\s*→\s*['\"]([^'\"]+)['\"]"
                matches1 = re.findall(pattern1, content, re.IGNORECASE)
                for original, converted in matches1:
                    conversions[original.strip()] = converted.strip()

                # Pattern 2: "Mapped 'original' to 'converted'"
                pattern2 = r"Mapped\s+['\"]([^'\"]+)['\"]\s+to\s+['\"]([^'\"]+)['\"]"
                matches2 = re.findall(pattern2, content, re.IGNORECASE)
                for original, converted in matches2:
                    conversions[original.strip()] = converted.strip()

                # Pattern 3: "LLM Conversion: 'original' → 'converted'"
                pattern3 = (
                    r"LLM\s+Conversion:\s+['\"]([^'\"]+)['\"]\s*→\s*['\"]([^'\"]+)['\"]"
                )
                matches3 = re.findall(pattern3, content, re.IGNORECASE)
                for original, converted in matches3:
                    conversions[original.strip()] = converted.strip()

                # Pattern 4: "Database Mapping: 'original' → 'converted'"
                pattern4 = r"Database\s+Mapping:\s+['\"]([^'\"]+)['\"]\s*→\s*['\"]([^'\"]+)['\"]"
                matches4 = re.findall(pattern4, content, re.IGNORECASE)
                for original, converted in matches4:
                    conversions[original.strip()] = converted.strip()

        return conversions

    def _extract_drug_links_from_messages(self, messages) -> dict:
        """
        Extract drug links from tool call messages.

        Args:
            messages: List of messages from state

        Returns:
            Dictionary mapping drug names to URLs
        """
        drug_links = {}

        # Look through messages for tool responses containing drug links
        for i, msg in enumerate(messages):
            # Check if this is a tool response message
            if hasattr(msg, "content") and msg.content:
                content = str(msg.content)

                # Check if this contains drugs.com links
                if "drugs.com" in content.lower():
                    # Pattern: "- DrugName: https://www.drugs.com/..."
                    # Also handle: "DrugName: https://..."
                    link_patterns = [
                        r"-?\s*([^:\n]+?):\s*(https?://[^\s\)]+drugs\.com[^\s\)\n]*)",
                        r"\[([^\]]+)\]\((https?://[^\)]+drugs\.com[^\)]*)\)",
                    ]

                    for pattern in link_patterns:
                        matches = re.findall(
                            pattern, content, re.IGNORECASE | re.MULTILINE
                        )
                        for match in matches:
                            if len(match) == 2:
                                drug_name, url = match
                                drug_name = drug_name.strip()
                                url = re.sub(r"[.,;:!?\)]+$", "", url.strip())
                                if drug_name and url and "drugs.com" in url.lower():
                                    drug_links[drug_name] = url

        return drug_links

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

        # Extract drug links from tool call messages
        drug_links = self._extract_drug_links_from_messages(messages)

        # Also check state (for backward compatibility)
        state_links = state.get("drug_links", {})
        if state_links:
            drug_links.update(state_links)

        # Extract drug conversions from tool call messages
        drug_conversions = self._extract_drug_conversions_from_messages(messages)

        # Also check state (for backward compatibility)
        state_conversions = state.get("drug_conversions", {})
        if state_conversions:
            drug_conversions.update(state_conversions)

        # Append drug links section to the content if available
        content_to_translate = last_ai_message.content
        if drug_links:
            links_section = "\n\n### Drug Information Links\n"
            for drug_name, url in drug_links.items():
                links_section += f"- [{drug_name}]({url})\n"
            content_to_translate += links_section

        # Create translation prompt
        translation_prompt = f"""
        Translate the following medical text about drug interactions from English to Vietnamese.
        Keep the markdown formatting intact and ensure medical terminology is accurately translated.
        Maintain the structure with headings, lists, and emphasis.
        Keep URLs unchanged.

        Text to translate:
        {content_to_translate}
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

            return {
                "vietnamese_output": vietnamese_output,
                "drug_conversions": drug_conversions,
            }

        except Exception as e:
            if self.verbose:
                print(f"Translation error: {e}")
            return {
                "vietnamese_output": f"Lỗi dịch thuật: {str(e)}",
                "drug_conversions": drug_conversions,
            }

    def _parser_node(self, state: DrugInteractionAgentState) -> dict:
        """
        Parser node that parses the Vietnamese output into structured JSON format.

        Args:
            state: Current agent state

        Returns:
            Updated state with parsed structured result
        """
        vietnamese_output = state.get("vietnamese_output", "")
        drug_links = state.get("drug_links", {})
        drug_conversions = state.get("drug_conversions", {})

        if not vietnamese_output:
            return {"parsed_result": None}

        # Create a prompt for parsing the Vietnamese output into structured format
        parsing_prompt = f"""
        Parse the following Vietnamese text about drug interactions into a structured JSON format.

        Extract the following information:
        1. Drug name conversions (original -> converted) - look for sections like "Drug Name Conversions" or "Chuyển đổi tên thuốc"
        2. Drug interactions between pairs (drug1, drug2, status, details) - look for sections like "Interactions Between Drug Pairs" or "Tương tác giữa các cặp thuốc"
        3. Summary (overall_risk, major_interactions, recommendations) - look for sections like "Final Summary" or "Tóm tắt cuối cùng"

        For drug references, use the provided drug_links dictionary to find URLs. Match drug names from the text to keys in drug_links.

        Vietnamese text to parse:
        {vietnamese_output}

        Drug links available:
        {drug_links}

        Drug conversions tracked from tool calls (use these as the source of truth):
        {drug_conversions}

        Instructions:
        - IMPORTANT: Use the drug_conversions dictionary above as the PRIMARY source for drug conversions. These are the actual conversions that happened during tool execution.
        - Extract all drug conversions: For each entry in drug_conversions, create a DrugConversion entry with original and converted names. Also extract any additional conversions mentioned in the Vietnamese text.
        - Extract all drug interaction pairs and their details (look for headings like "Drug1 + Drug2" or "Thuốc1 + Thuốc2")
        - For each interaction, determine status: "An Toàn" if safe/no interaction, "Có Tương Tác" if interaction found
        - Extract the summary information:
          * overall_risk: Look for "Overall Risk" or "Rủi ro tổng thể" (values like "High", "Medium", "Low", "None" or "Cao", "Trung bình", "Thấp", "Không")
          * major_interactions: List of key interaction findings
          * recommendations: List of clinical recommendations
        - Map drug names to their reference links if available in drug_links (case-insensitive matching)
        - For DrugConversion references, use drug_links to find URLs for the converted drug names
        - Set step to 1
        - Set title to a descriptive title about the drug interaction analysis (can be in Vietnamese)
        - If a section is missing, use empty lists [] or appropriate defaults
        - Ensure all required fields are present in the output
        """

        # Use structured output with Pydantic model
        parser_llm = ChatOpenAI(
            model=self.model_name,
            temperature=0.0,  # Low temperature for consistent parsing
        )

        try:
            # Use with_structured_output for parsing
            structured_llm = parser_llm.with_structured_output(DrugInteractionResult)

            # Get parsed result
            parsed_result = structured_llm.invoke(
                [
                    SystemMessage(
                        content="You are a parser that extracts structured information from Vietnamese drug interaction text. Parse accurately and map all available information to the required structure."
                    ),
                    HumanMessage(content=parsing_prompt),
                ]
            )

            # Convert Pydantic model to dict for state
            parsed_dict = (
                parsed_result.model_dump()
                if hasattr(parsed_result, "model_dump")
                else parsed_result
            )

            if self.verbose:
                print(f"Parsing completed: {len(str(parsed_dict))} characters")

            return {"parsed_result": parsed_dict}

        except Exception as e:
            if self.verbose:
                print(f"Parsing error: {e}")
            return {"parsed_result": None}

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
            "drug_links": {},
            "drug_conversions": {},
            "parsed_result": None,
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
            "drug_links": {},
            "drug_conversions": {},
            "parsed_result": None,
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
            "drug_links": {},
            "drug_conversions": {},
            "parsed_result": None,
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
            parsed_result = result.get("parsed_result")
            drug_conversions = result.get("drug_conversions", {})

            # Extract drug links from messages (from tool responses)
            drug_links = self._extract_drug_links_from_messages(messages)
            # Also check state for backward compatibility
            state_links = result.get("drug_links", {})
            if state_links:
                drug_links.update(state_links)

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
                "drug_links": drug_links,
                "drug_conversions": drug_conversions,
                "parsed_result": parsed_result,
            }

        except Exception as e:
            if self.verbose:
                print(f"Error in graph execution: {e}")
            return {
                "english": f"Error processing query: {str(e)}",
                "vietnamese": f"Lỗi xử lý truy vấn: {str(e)}",
                "drug_links": {},
                "parsed_result": None,
            }

    def get_graph_stats(self) -> dict:
        """Get statistics about the drug interaction database."""
        return self.drug_graph.get_stats()
