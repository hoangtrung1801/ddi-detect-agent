"""
Test script for LLM-based drug name conversion and mapping.

This script demonstrates how the system:
1. Uses LLM to convert drug names (brand/generic) to active ingredients
2. Maps those ingredients to the standardized database names
3. Uses the mapped names to check drug interactions
"""

from drug_interaction_graph import DrugInteractionGraph
from app.agents.graph import DrugInteractionGraph as LangGraphAgent


def test_llm_drug_mapping():
    """Test the LLM-based drug name conversion and mapping."""
    print("=" * 80)
    print("Testing LLM-Based Drug Name Conversion and Mapping")
    print("=" * 80)

    # Initialize the drug interaction graph
    print("\n[1] Loading drug interaction database...")
    graph = DrugInteractionGraph()
    graph.load_from_csv("TWOSIDES_preprocessed.csv")
    print(
        f"✓ Loaded {graph.get_stats()['drugs']} drugs and {graph.get_stats()['interactions']} interactions"
    )

    # Initialize the LangGraph agent with drug mapping enabled
    print("\n[2] Initializing AI agent with LLM-based drug mapping...")
    agent = LangGraphAgent(
        graph=graph, model_name="gpt-4o-mini", enable_drug_mapping=True, verbose=True
    )
    print("✓ Agent initialized with LLM drug name conversion enabled")

    # Test cases with brand names
    test_queries = [
        "Check interactions between Tylenol and Coumadin",
        "What are the interactions between Advil, Tylenol, and Aspirin?",
        "Is it safe to take Motrin with Warfarin?",
    ]

    print("\n" + "=" * 80)
    print("Running Test Queries")
    print("=" * 80)

    for i, query in enumerate(test_queries, 1):
        print(f"\n{'=' * 80}")
        print(f"Test Query {i}: {query}")
        print("=" * 80)

        try:
            response = agent.invoke(query)
            print("\nAgent Response:")
            print("-" * 80)
            print(response)
            print("-" * 80)
        except Exception as e:
            print(f"\n❌ Error: {e}")

        print("\n")

    print("=" * 80)
    print("Testing Complete!")
    print("=" * 80)


def test_explicit_mapping():
    """Test explicit drug name mapping using the map_drug_name_tool."""
    print("\n" + "=" * 80)
    print("Testing Explicit Drug Name Mapping")
    print("=" * 80)

    # Initialize
    graph = DrugInteractionGraph()
    graph.load_from_csv("TWOSIDES_preprocessed.csv")

    agent = LangGraphAgent(
        graph=graph, model_name="gpt-4o-mini", enable_drug_mapping=True, verbose=False
    )

    # Test explicit mapping
    brand_names = [
        "Tylenol",
        "Advil",
        "Motrin",
        "Coumadin",
        "Aspirin",
        "Aleve",
    ]

    print("\nTesting drug name conversions:")
    print("-" * 80)

    for brand_name in brand_names:
        query = (
            f"What is the active ingredient in {brand_name}? Use map_drug_name_tool."
        )
        try:
            response = agent.invoke(query)
            print(f"\n{brand_name}:")
            print(response)
        except Exception as e:
            print(f"\n{brand_name}: ❌ Error - {e}")

    print("\n" + "=" * 80)


if __name__ == "__main__":
    # Run basic test
    test_llm_drug_mapping()

    # Run explicit mapping test
    # test_explicit_mapping()
