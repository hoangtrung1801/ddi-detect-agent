"""
Quick Test Script for Drug Interaction Agent

Tests the agent setup and basic functionality.
"""

import os
import sys
from dotenv import load_dotenv


def test_environment():
    """Test environment setup."""
    print("=" * 70)
    print("1. Testing Environment Setup")
    print("=" * 70)

    load_dotenv()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ OPENAI_API_KEY not found!")
        print("Please set your OpenAI API key in .env file or environment variables.")
        print("See ENV_SETUP.md for instructions.")
        return False

    print(f"✓ OPENAI_API_KEY is set")
    print(f"✓ Model: {os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')}")
    print(f"✓ Data file: {os.getenv('DATA_FILE', 'TWOSIDES_preprocessed.csv')}")
    return True


def test_data_file():
    """Test data file exists."""
    print("\n" + "=" * 70)
    print("2. Testing Data File")
    print("=" * 70)

    data_file = os.getenv("DATA_FILE", "TWOSIDES_preprocessed.csv")

    if not os.path.exists(data_file):
        print(f"❌ Data file '{data_file}' not found!")
        return False

    file_size = os.path.getsize(data_file) / (1024 * 1024)
    print(f"✓ Data file found: {data_file}")
    print(f"✓ File size: {file_size:.2f} MB")
    return True


def test_imports():
    """Test required packages are installed."""
    print("\n" + "=" * 70)
    print("3. Testing Package Imports")
    print("=" * 70)

    packages = [
        ("python-igraph", "igraph"),
        ("langchain", "langchain"),
        ("langchain-openai", "langchain_openai"),
        ("openai", "openai"),
        ("fastapi", "fastapi"),
        ("rich", "rich"),
        ("networkx", "networkx"),
        ("matplotlib", "matplotlib"),
    ]

    all_ok = True
    for package_name, import_name in packages:
        try:
            __import__(import_name)
            print(f"✓ {package_name}")
        except ImportError:
            print(f"❌ {package_name} - Not installed!")
            all_ok = False

    if not all_ok:
        print("\n⚠ Missing packages detected!")
        print("Run: pip install -r requirements.txt")
        return False

    return True


def test_agent_creation():
    """Test agent creation."""
    print("\n" + "=" * 70)
    print("4. Testing Agent Creation")
    print("=" * 70)

    try:
        from drug_agent import create_agent

        print("Creating agent (this may take a moment)...")
        agent = create_agent(
            data_filepath=os.getenv("DATA_FILE", "TWOSIDES_preprocessed.csv"),
            verbose=True,
        )

        stats = agent.get_graph_stats()
        print(f"✓ Agent created successfully!")
        print(f"✓ Loaded {stats['drugs']} drugs")
        print(f"✓ Loaded {stats['interactions']} interactions")

        return agent

    except Exception as e:
        print(f"❌ Failed to create agent: {str(e)}")
        return None


def test_agent_query(agent):
    """Test basic agent queries."""
    print("\n" + "=" * 70)
    print("5. Testing Agent Queries")
    print("=" * 70)

    if agent is None:
        print("❌ Agent not available, skipping query tests")
        return False

    test_queries = [
        "What is the interaction between Warfarin and Aspirin?",
        "what interaction between acetaminophen and glycopyrroniu?",
    ]

    for i, query in enumerate(test_queries, 1):
        print(f"\nTest Query {i}:")
        print(f"Q: {query}")

        try:
            response = agent.query(query)
            print(
                f"A: {response[:200]}..." if len(response) > 200 else f"A: {response}"
            )
            print("✓ Query successful")
        except Exception as e:
            print(f"❌ Query failed: {str(e)}")
            return False

    return True


def main():
    """Run all tests."""
    print("\n" + "=" * 70)
    print("Drug Interaction Agent - System Test")
    print("=" * 70 + "\n")

    # Run tests
    if not test_environment():
        sys.exit(1)

    if not test_data_file():
        sys.exit(1)

    if not test_imports():
        sys.exit(1)

    agent = test_agent_creation()
    if agent is None:
        sys.exit(1)

    if not test_agent_query(agent):
        sys.exit(1)

    # All tests passed
    print("\n" + "=" * 70)
    print("✅ All Tests Passed!")
    print("=" * 70)
    print("\nYou can now use the agent:")
    print("  • CLI: python drug_agent_cli.py")
    print("  • API: python drug_agent_api.py")
    print("  • Interactive docs: http://localhost:8000/docs")
    print()


if __name__ == "__main__":
    main()
