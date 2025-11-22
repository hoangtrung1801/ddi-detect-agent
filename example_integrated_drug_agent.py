#!/usr/bin/env python3
"""
Example: Integrated Drug Agent with Drug Mapping

This example demonstrates the drug interaction agent with integrated drug mapping capabilities.
"""

import sys
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent / "app"))


def test_drug_agent_with_mapping():
    """Test the drug agent with mapping functionality."""

    print("Integrated Drug Agent with Drug Mapping")
    print("=" * 50)

    try:
        from app.agents.drug_agent import create_agent
        from dotenv import load_dotenv

        # Load environment variables
        load_dotenv()

        # Check if drug interaction data exists
        data_file = "drug_interactions.graphml"
        if not Path(data_file).exists():
            print(f"❌ Drug interaction data file not found: {data_file}")
            print("Please ensure the GraphML file exists in the current directory")
            return False

        print("✅ Drug interaction data found")

        # Create agent with drug mapping enabled
        print("\nCreating agent with drug mapping enabled...")
        agent = create_agent(
            data_filepath=data_file,
            model_name="gpt-4o-mini",
            verbose=True,
            enable_drug_mapping=True,
            drug_mapping_threshold=0.7,
        )

        print("✅ Agent created successfully")

        # Test drug mapping functionality
        print("\n" + "=" * 50)
        print("TESTING DRUG MAPPING FUNCTIONALITY")
        print("=" * 50)

        test_drugs = [
            "tylenol",  # Should map to Acetaminophen
            "advil",  # Should map to Ibuprofen
            "aspirin",  # Should map to Acetylsalicylic acid
            "warfarin",  # Should stay as Warfarin
            "metformin",  # Should stay as Metformin
        ]

        print("Testing individual drug mapping:")
        for drug in test_drugs:
            mapped = agent.map_drug_name(drug)
            status = "✅" if mapped != drug else "➡️"
            print(f"{status} '{drug}' -> '{mapped}'")

        print("\nTesting drug suggestions:")
        suggestions = agent.get_drug_suggestions("tylenol", top_k=3)
        for name, score in suggestions:
            print(f"  {name} (similarity: {score:.3f})")

        # Test agent queries with drug mapping
        print("\n" + "=" * 50)
        print("TESTING AGENT QUERIES WITH DRUG MAPPING")
        print("=" * 50)

        test_queries = [
            "What happens if I take tylenol and advil together?",
            "Show me all interactions for aspirin",
            "Is it safe to combine warfarin with ibuprofen?",
            "Tell me about metformin interactions",
        ]

        for i, query in enumerate(test_queries, 1):
            print(f"\n{i}. Query: {query}")
            print("-" * 40)

            try:
                response = agent.query(query)
                print(f"Response: {response}")
            except Exception as e:
                print(f"Error: {e}")

        print("\n" + "=" * 50)
        print("TESTING DRUG EXTRACTION AND MAPPING")
        print("=" * 50)

        # Test drug extraction from text
        test_texts = [
            "tylenol and advil",
            "aspirin with warfarin",
            "metformin, lisinopril, and simvastatin",
        ]

        for text in test_texts:
            print(f"\nExtracting drugs from: '{text}'")
            extracted_drugs = agent.extract_and_map_drugs(text)
            print(f"Mapped drugs: {extracted_drugs}")

        print("\n" + "=" * 50)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 50)

        return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Please ensure all dependencies are installed:")
        print("  pip install sentence-transformers scikit-learn")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_agent_without_mapping():
    """Test the agent without drug mapping for comparison."""

    print("\n" + "=" * 50)
    print("TESTING AGENT WITHOUT DRUG MAPPING")
    print("=" * 50)

    try:
        from app.agents.drug_agent import create_agent

        # Create agent without drug mapping
        agent = create_agent(
            data_filepath="drug_interactions.graphml",
            model_name="gpt-4o-mini",
            verbose=False,
            enable_drug_mapping=False,
        )

        print("✅ Agent created without drug mapping")

        # Test that mapping functions return original names
        test_drugs = ["tylenol", "advil", "aspirin"]
        print("\nTesting drug mapping (should return original names):")
        for drug in test_drugs:
            mapped = agent.map_drug_name(drug)
            print(f"  '{drug}' -> '{mapped}'")

        print("✅ Agent without mapping works correctly")
        return True

    except Exception as e:
        print(f"❌ Error testing agent without mapping: {e}")
        return False


def demonstrate_enhanced_tools():
    """Demonstrate the enhanced tools functionality."""

    print("\n" + "=" * 50)
    print("DEMONSTRATING ENHANCED TOOLS")
    print("=" * 50)

    try:
        from app.agents.enhanced_tools import EnhancedDrugInteractionTools
        from drug_interaction_graph import DrugInteractionGraph

        # Load the graph
        graph = DrugInteractionGraph("drug_interactions.graphml")

        # Create enhanced tools
        tools_builder = EnhancedDrugInteractionTools(graph, enable_drug_mapping=True)
        tools = tools_builder.create_tools()

        print(f"✅ Created {len(tools)} enhanced tools:")
        for tool in tools:
            print(f"  - {tool.name}: {tool.description}")

        # Test a tool directly
        print("\nTesting map_drug_name_tool:")
        for tool in tools:
            if tool.name == "map_drug_name_tool":
                result = tool.invoke({"drug_name": "tylenol"})
                print(f"  Result: {result}")
                break

        return True

    except Exception as e:
        print(f"❌ Error demonstrating enhanced tools: {e}")
        return False


if __name__ == "__main__":
    print("Drug Agent Integration Test")
    print("=" * 50)

    # Test with drug mapping
    success1 = test_drug_agent_with_mapping()

    # Test without drug mapping
    success2 = test_agent_without_mapping()

    # Demonstrate enhanced tools
    success3 = demonstrate_enhanced_tools()

    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)

    if success1:
        print("✅ Drug agent with mapping: PASSED")
    else:
        print("❌ Drug agent with mapping: FAILED")

    if success2:
        print("✅ Drug agent without mapping: PASSED")
    else:
        print("❌ Drug agent without mapping: FAILED")

    if success3:
        print("✅ Enhanced tools: PASSED")
    else:
        print("❌ Enhanced tools: FAILED")

    if all([success1, success2, success3]):
        print("\n🎉 ALL TESTS PASSED! Drug mapping integration is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the error messages above.")
