"""
Example: Using Drug Interaction Agent Programmatically

This script demonstrates how to use the DrugInteractionAgent in your own code.
"""

import os
from dotenv import load_dotenv
from drug_agent import create_agent

# Load environment variables
load_dotenv()


def basic_example():
    """Basic usage example."""
    print("=" * 70)
    print("Example 1: Basic Usage")
    print("=" * 70)

    # Create agent with default settings
    agent = create_agent(
        data_filepath="TWOSIDES_preprocessed.csv",
        model_name="gpt-3.5-turbo",
        verbose=False,  # Set to True to see agent reasoning
    )

    # Ask a question
    question = "What happens if I take Warfarin and Aspirin together?"
    print(f"\nQuestion: {question}")

    response = agent.query(question)
    print(f"\nResponse: {response}")

    return agent


def multi_query_example(agent):
    """Example with multiple queries using conversation memory."""
    print("\n" + "=" * 70)
    print("Example 2: Multiple Queries with Memory")
    print("=" * 70)

    queries = [
        "Show me all interactions for Metformin",
        "What about Warfarin?",  # Uses context from conversation
        "Which one is more dangerous?",  # Refers to previous drugs
    ]

    for i, query in enumerate(queries, 1):
        print(f"\n[Query {i}] {query}")
        response = agent.query(query)
        print(
            f"[Response] {response[:200]}..."
            if len(response) > 200
            else f"[Response] {response}"
        )


def stats_example(agent):
    """Example showing how to access graph statistics."""
    print("\n" + "=" * 70)
    print("Example 3: Accessing Graph Statistics")
    print("=" * 70)

    stats = agent.get_graph_stats()
    print(f"\nDatabase Statistics:")
    print(f"  Total Drugs: {stats['drugs']:,}")
    print(f"  Total Interactions: {stats['interactions']:,}")


def memory_management_example(agent):
    """Example showing memory management."""
    print("\n" + "=" * 70)
    print("Example 4: Memory Management")
    print("=" * 70)

    # First query
    print("\nQuery 1: What are the interactions for Aspirin?")
    response1 = agent.query("What are the interactions for Aspirin?")
    print(f"Response: {response1[:100]}...")

    # Follow-up that uses memory
    print("\nQuery 2: How many did you find? (uses memory)")
    response2 = agent.query("How many did you find?")
    print(f"Response: {response2}")

    # Clear memory
    print("\nClearing conversation memory...")
    agent.clear_memory()

    # This query won't have context from previous queries
    print("\nQuery 3: How many did you find? (after clearing memory)")
    response3 = agent.query("How many did you find?")
    print(f"Response: {response3}")


def error_handling_example(agent):
    """Example showing error handling."""
    print("\n" + "=" * 70)
    print("Example 5: Error Handling")
    print("=" * 70)

    # Query for non-existent drug
    print("\nQuerying for a drug that might not exist...")
    response = agent.query("What are the interactions for XYZ-NonExistent-Drug-123?")
    print(f"Response: {response}")

    # Invalid query format
    print("\nAsking a vague question...")
    response = agent.query("Tell me about drugs")
    print(
        f"Response: {response[:200]}..."
        if len(response) > 200
        else f"Response: {response}"
    )


def custom_configuration_example():
    """Example with custom configuration."""
    print("\n" + "=" * 70)
    print("Example 6: Custom Configuration")
    print("=" * 70)

    # Create agent with custom settings
    agent = create_agent(
        data_filepath="TWOSIDES_preprocessed.csv",
        model_name=os.getenv("OPENAI_MODEL", "gpt-3.5-turbo"),
        verbose=True,  # Show agent reasoning process
    )

    print("\nAgent configured with verbose mode ON")
    print("You'll see the agent's reasoning process...\n")

    response = agent.query("Is there an interaction between Ibuprofen and Alcohol?")
    print(f"\nFinal Response: {response}")


def main():
    """Run all examples."""
    print("\n" + "=" * 70)
    print("Drug Interaction Agent - Programmatic Usage Examples")
    print("=" * 70 + "\n")

    # Check for API key
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY not found!")
        print("Please set your OpenAI API key in .env file or environment.")
        print("See ENV_SETUP.md for instructions.\n")
        return

    try:
        # Run examples
        agent = basic_example()
        multi_query_example(agent)
        stats_example(agent)
        memory_management_example(agent)
        error_handling_example(agent)
        # Uncomment to see verbose agent reasoning:
        # custom_configuration_example()

        print("\n" + "=" * 70)
        print("✅ All Examples Completed Successfully!")
        print("=" * 70)
        print("\nNext Steps:")
        print("  • Integrate the agent into your application")
        print("  • Customize the tools in drug_agent.py")
        print("  • Try the CLI: python drug_agent_cli.py")
        print("  • Try the API: python drug_agent_api.py")
        print()

    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nTroubleshooting:")
        print("  • Ensure OPENAI_API_KEY is set")
        print("  • Run: python test_agent.py")
        print("  • Check ENV_SETUP.md for configuration help\n")


if __name__ == "__main__":
    main()
