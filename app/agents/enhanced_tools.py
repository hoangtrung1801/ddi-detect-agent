"""
Enhanced Drug Interaction Tools with Drug Mapping for LangGraph Agent.

Extends the basic drug interaction tools with drug name mapping capabilities.
"""

import re
import os
from typing import List
import importlib.util
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from openai import OpenAI
from drug_interaction_graph import DrugInteractionGraph

# Check if drug mapping is available
DRUG_MAPPING_AVAILABLE = importlib.util.find_spec("app.core.drug_mapper") is not None


class ActiveIngredientResponse(BaseModel):
    """Response model for active ingredient extraction."""

    reasoning: str = Field(..., description="Reasoning for the ingredient extraction")
    active_ingredient: str = Field(
        ..., description="The primary active ingredient or generic name"
    )
    confidence: str = Field(
        ...,
        description="Confidence level: high, medium, or low",
    )


class EnhancedDrugInteractionTools:
    """Enhanced collection of tools for querying drug interactions with mapping."""

    def __init__(
        self,
        graph: DrugInteractionGraph,
        enable_drug_mapping: bool = True,
        model_name: str = "gpt-4.1-nano-2025-04-14",
    ):
        """
        Initialize enhanced tools with a drug interaction graph and optional mapping.

        Args:
            graph: DrugInteractionGraph instance with loaded data
            enable_drug_mapping: Whether to enable drug name mapping
            model_name: LLM model to use for ingredient extraction
        """
        self.graph = graph
        self.enable_drug_mapping = enable_drug_mapping and DRUG_MAPPING_AVAILABLE
        self.llm = ChatOpenAI(model=model_name, temperature=0.0)

    @staticmethod
    def _parse_two_drugs(query: str) -> tuple[str | None, str | None]:
        """
        Parse two drug names from a query string.

        Args:
            query: String containing two drug names

        Returns:
            Tuple of (drug1, drug2) or (None, None) if parsing fails
        """
        query = query.lower()
        separators = [" and ", " with ", ",", " & "]

        for sep in separators:
            if sep in query:
                parts = query.split(sep, 1)
                if len(parts) == 2:
                    return parts[0].strip(), parts[1].strip()

        return None, None

    def _extract_active_ingredient(self, drug_name: str) -> tuple[str, str]:
        """
        Use LLM to extract the active ingredient from a drug name.

        Args:
            drug_name: The drug name (brand or generic)

        Returns:
            Tuple of (active_ingredient, reasoning)
        """
        system_prompt = """You are a pharmaceutical expert. Given a drug name (which could be a brand name, trade name, or generic name), identify the primary active ingredient or generic name.

Instructions:
- If given a brand name (e.g., "Tylenol", "Advil", "Coumadin"), return the generic/active ingredient name (e.g., "Acetaminophen", "Ibuprofen", "Warfarin")
- If given a generic name already (e.g., "Acetaminophen", "Ibuprofen"), return it as-is
- If the drug contains multiple active ingredients, return the PRIMARY one
- Return ONLY the ingredient name, not dosage or formulation details
- Use standard international non-proprietary names (INN) when possible
- Provide brief reasoning for your answer

Respond with high confidence if you're certain, medium if somewhat certain, low if unsure."""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Drug name: {drug_name}"),
        ]

        try:
            llm_with_structured_output = self.llm.with_structured_output(
                ActiveIngredientResponse
            )
            result: ActiveIngredientResponse = llm_with_structured_output.invoke(
                messages
            )
            return result.active_ingredient, result.reasoning
        except Exception as e:
            print(f"Error extracting ingredient for '{drug_name}': {e}")
            return drug_name, f"Error: {str(e)}"

    def _map_drug_name(self, drug_name: str) -> str:
        """
        Map a drug name to its standardized form if mapping is enabled.
        First extracts active ingredient using LLM, then maps to database.

        Args:
            drug_name: The drug name to map

        Returns:
            Mapped drug name or original if mapping not available
        """
        if not self.enable_drug_mapping:
            return drug_name

        try:
            # Step 1: Extract active ingredient using LLM
            active_ingredient, reasoning = self._extract_active_ingredient(drug_name)
            print(f"LLM extracted ingredient: '{drug_name}' -> '{active_ingredient}'")
            print(f"Reasoning: {reasoning}")

            # Step 2: Map the extracted ingredient to database
            from ..core.drug_mapper import map_drug_name

            mapped = map_drug_name(active_ingredient, threshold=0.5)
            final_name = mapped if mapped else active_ingredient

            print(f"Database mapping: '{active_ingredient}' -> '{final_name}'")
            return final_name
        except Exception as e:
            print(f"Error in drug mapping: {e}")
            return drug_name

    @staticmethod
    def _extract_drug_names_from_query(query: str) -> List[str]:
        """
        Extract drug names from a user query.

        Args:
            query: User's query text

        Returns:
            List of extracted drug names
        """
        # Common separators for drug combinations
        separators = r"\b(?:and|with|,|&|\+)\b"

        # Split by separators and clean up
        potential_drugs = re.split(separators, query, flags=re.IGNORECASE)
        potential_drugs = [drug.strip() for drug in potential_drugs if drug.strip()]

        # Also look for capitalized words (likely drug names)
        capitalized_words = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", query)

        # Filter out common non-drug words
        common_words = {
            "Interaction",
            "Details",
            "Summary",
            "Risk",
            "Clinical",
            "Recommendations",
            "Overall",
            "Key",
            "Final",
            "Between",
            "Drug",
            "Name",
            "Conversions",
            "Pairs",
            "Example",
            "Check",
            "What",
            "Show",
            "Tell",
            "Find",
            "Search",
            "Information",
            "About",
            "Between",
            "Together",
            "Safe",
        }

        drug_names = set()

        # Add drugs from split
        for drug in potential_drugs:
            if len(drug) > 2 and drug.lower() not in [w.lower() for w in common_words]:
                drug_names.add(drug.strip())

        # Add capitalized words
        for word in capitalized_words:
            if word not in common_words and len(word) > 2:
                drug_names.add(word.strip())

        return list(drug_names)

    def create_tools(self) -> List:
        """
        Create enhanced LangChain tools for the agent.

        Returns:
            List of tool functions decorated with @tool
        """
        graph = self.graph

        # Initialize OpenAI client for web search
        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        @tool
        def find_drug_detail_links(query: str) -> str:
            """
            Find detailed drug information links from drugs.com for all drugs mentioned in the query.

            This tool should be called FIRST before checking drug interactions.
            It extracts drug names from the user's query and searches for their
            official information pages on drugs.com.

            Args:
                query: The user's query containing drug names. Examples: "Warfarin and Aspirin",
                       "Check interactions between Tylenol, Advil, and Coumadin"

            Returns:
                Formatted string with drug names and their drugs.com links
            """
            # Extract drug names from query
            drug_names = EnhancedDrugInteractionTools._extract_drug_names_from_query(
                query
            )

            if not drug_names:
                return "No drug names found in the query. Please provide drug names in your query."

            # Limit to 5 drugs to avoid too many API calls
            drug_names = drug_names[:5]

            results = []
            drug_links_dict = {}

            for drug_name in drug_names:
                try:
                    # Use OpenAI client with web search to find drug link
                    completion = openai_client.chat.completions.create(
                        model="gpt-4o-search-preview",
                        web_search_options={},
                        messages=[
                            {
                                "role": "user",
                                "content": f"Find me drug detail link of drug '{drug_name}' on drugs.com. Return only the URL.",
                            }
                        ],
                    )

                    response_text = completion.choices[0].message.content

                    # Extract URL from response
                    url_patterns = [
                        r"https?://(?:www\.)?drugs\.com/[^\s\)]+",
                        r"https?://[^\s]*drugs\.com[^\s\)]*",
                    ]

                    url_found = False
                    for pattern in url_patterns:
                        url_match = re.search(pattern, response_text, re.IGNORECASE)
                        if url_match:
                            url = url_match.group(0)
                            # Clean up URL
                            url = re.sub(r"[.,;:!?\)]+$", "", url)
                            if "drugs.com" in url.lower():
                                drug_links_dict[drug_name] = url
                                results.append(f"- {drug_name}: {url}")
                                url_found = True
                                break

                    if not url_found:
                        # Fallback: construct URL manually
                        drug_slug = re.sub(r"[^a-z0-9\s-]", "", drug_name.lower())
                        drug_slug = re.sub(r"\s+", "-", drug_slug.strip())
                        fallback_url = f"https://www.drugs.com/{drug_slug}.html"
                        drug_links_dict[drug_name] = fallback_url
                        results.append(f"- {drug_name}: {fallback_url} (estimated)")

                except Exception:
                    # Fallback on error
                    drug_slug = re.sub(r"[^a-z0-9\s-]", "", drug_name.lower())
                    drug_slug = re.sub(r"\s+", "-", drug_slug.strip())
                    fallback_url = f"https://www.drugs.com/{drug_slug}.html"
                    drug_links_dict[drug_name] = fallback_url
                    results.append(f"- {drug_name}: {fallback_url} (estimated)")

            if results:
                return "Drug Information Links (drugs.com):\n" + "\n".join(results)
            else:
                return "Could not find drug links."

        @tool
        def search_drug_interaction(query: str) -> str:
            """
            Search for interaction between two drugs with automatic LLM-based mapping.

            Use this tool to find specific interactions between TWO drugs.
            Input should be two drug names separated by 'and', 'with', or comma.
            Drug names will be converted to active ingredients via LLM, then mapped to database.

            Args:
                query: Two drug names. Examples: "Warfarin and Aspirin", "tylenol, advil", "Coumadin and Advil"

            Returns:
                Interaction information or message if not found
            """
            drug1, drug2 = EnhancedDrugInteractionTools._parse_two_drugs(query)

            if not drug1 or not drug2:
                return (
                    "Error: Please provide two drug names separated by 'and', 'with', or comma. "
                    "Example: 'Warfarin and Aspirin'"
                )

            # Map drug names if mapping is enabled
            original_drug1, original_drug2 = drug1, drug2
            mapped_drug1 = self._map_drug_name(drug1)
            mapped_drug2 = self._map_drug_name(drug2)

            print(
                f"enhanced_tools - mapped: '{drug1}' -> '{mapped_drug1}', '{drug2}' -> '{mapped_drug2}'"
            )

            # Search in graph
            result = graph.search_interaction(mapped_drug1, mapped_drug2)
            print(f"enhanced_tools - interaction result: {result}")

            # Build response with detailed mapping information
            response_parts = []

            if mapped_drug1.lower() != original_drug1.lower():
                response_parts.append(
                    f"• Converted '{original_drug1}' → '{mapped_drug1}'"
                )
            if mapped_drug2.lower() != original_drug2.lower():
                response_parts.append(
                    f"• Converted '{original_drug2}' → '{mapped_drug2}'"
                )

            if response_parts:
                mapping_info = (
                    "Drug Conversions:\n" + "\n".join(response_parts) + "\n\n"
                )
            else:
                mapping_info = ""

            if result:
                return f"{mapping_info}Interaction between {mapped_drug1.title()} and {mapped_drug2.title()}: {result}"
            else:
                return (
                    f"{mapping_info}No known interaction found between {mapped_drug1.title()} and {mapped_drug2.title()} "
                    f"in the database."
                )

        @tool
        def get_all_drug_interactions(drug_name: str) -> str:
            """
            Get all known interactions for a specific drug with automatic mapping.

            Use this tool to get ALL interactions for a SINGLE drug.
            Input should be one drug name only.
            Drug name will be automatically mapped to standardized form.

            Args:
                drug_name: Name of the drug. Examples: "Warfarin", "tylenol", "advil"

            Returns:
                List of all interactions for the drug
            """
            original_drug_name = drug_name.strip()
            drug_name = self._map_drug_name(original_drug_name)

            interactions = graph.get_all_interactions_for_drug(drug_name)

            # Build response with mapping information
            mapping_info = ""
            if drug_name != original_drug_name:
                mapping_info = (
                    f"Note: Mapped '{original_drug_name}' to '{drug_name}'\n\n"
                )

            if not interactions:
                return (
                    f"{mapping_info}No interactions found for {drug_name.title()} in the database. "
                    f"The drug may not be in our system or has no recorded interactions."
                )

            # Format results
            result = f"{mapping_info}Found {len(interactions)} interaction(s) for {drug_name.title()}:\n\n"
            for i, interaction in enumerate(interactions, 1):
                result += f"{i}. {interaction['drug']}: {interaction['condition']}\n"

            return result.strip()

        @tool
        def get_drug_statistics() -> str:
            """
            Get statistics about the drug interaction database.

            Use this tool to get general information about the database,
            such as total number of drugs and interactions.

            Returns:
                Database statistics
            """
            stats = graph.get_stats()
            mapping_info = ""
            if self.enable_drug_mapping:
                try:
                    from ..core.drug_mapper import get_drug_mapper

                    mapper = get_drug_mapper()
                    if mapper:
                        mapping_info = f"- Mapped drugs available: {len(mapper.get_all_drug_names())}\n"
                except Exception:
                    pass

            return (
                f"Database Statistics:\n"
                f"- Total drugs: {stats['drugs']}\n"
                f"- Total interactions: {stats['interactions']}\n"
                f"{mapping_info}"
            )

        @tool
        def map_drug_name_tool(drug_name: str) -> str:
            """
            Convert a drug name to its active ingredient and map it to the database.

            This tool uses LLM to first identify the active ingredient (e.g., "Tylenol" -> "Acetaminophen"),
            then maps it to the standardized form in the database.

            Args:
                drug_name: The drug name to convert (can be brand name or generic)

            Returns:
                The standardized active ingredient name with conversion details
            """
            if not self.enable_drug_mapping:
                return f"Drug mapping is not enabled. Original name: '{drug_name}'"

            try:
                # Step 1: Extract active ingredient using LLM
                active_ingredient, reasoning = self._extract_active_ingredient(
                    drug_name
                )

                # Step 2: Map to database
                from ..core.drug_mapper import map_drug_name

                mapped_name = map_drug_name(active_ingredient, threshold=0.5)
                final_name = mapped_name if mapped_name else active_ingredient

                # Build detailed response
                response_parts = []

                if active_ingredient.lower() != drug_name.lower():
                    response_parts.append(
                        f"✓ LLM Conversion: '{drug_name}' → '{active_ingredient}'"
                    )
                    response_parts.append(f"  Reasoning: {reasoning}")

                if mapped_name and mapped_name.lower() != active_ingredient.lower():
                    response_parts.append(
                        f"✓ Database Mapping: '{active_ingredient}' → '{mapped_name}'"
                    )

                if response_parts:
                    result = "\n".join(response_parts)
                    result += f"\n\n✓ Final Name: '{final_name}'"
                else:
                    result = f"✓ Final Name: '{final_name}' (already in standard form)"

                return result

            except Exception as e:
                return f"Error mapping drug name '{drug_name}': {str(e)}"

        @tool
        def get_drug_suggestions_tool(drug_name: str, top_k: int = 5) -> str:
            """
            Get drug name suggestions with similarity scores.

            Use this tool to find similar drug names when you're unsure about the exact name.

            Args:
                drug_name: The drug name to get suggestions for
                top_k: Number of suggestions to return (default: 5)

            Returns:
                List of drug name suggestions with similarity scores
            """
            if not self.enable_drug_mapping:
                return f"Drug mapping is not enabled. Cannot get suggestions for '{drug_name}'"

            try:
                from ..core.drug_mapper import get_drug_mapper

                mapper = get_drug_mapper()
                suggestions = mapper.get_drug_suggestions(
                    drug_name, top_k=top_k, threshold=0.5
                )

                if suggestions:
                    result = f"Suggestions for '{drug_name}':\n"
                    for i, (name, score) in enumerate(suggestions, 1):
                        result += f"{i}. {name} (similarity: {score:.3f})\n"
                    return result.strip()
                else:
                    return f"No suggestions found for '{drug_name}'"
            except Exception as e:
                return f"Error getting suggestions for '{drug_name}': {str(e)}"

        # Create base tools - find_drug_detail_links should be first
        base_tools = [
            find_drug_detail_links,
            search_drug_interaction,
            # get_all_drug_interactions,
            # get_drug_statistics,
        ]

        # Add mapping tools if available
        if self.enable_drug_mapping:
            base_tools.extend(
                [
                    map_drug_name_tool,
                    # get_drug_suggestions_tool,
                ]
            )

        return base_tools
