"""
Test script for the refactored API structure.
Run this to verify the refactored app works correctly.
"""

import sys
import os

# Ensure we can import from the app package
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def test_imports():
    """Test that all modules can be imported."""
    print("✓ Testing imports...")

    try:
        from app.core.config import settings  # noqa: F401

        print("  ✓ Config imported successfully")

        from app.core.agent import agent_manager  # noqa: F401

        print("  ✓ Agent manager imported successfully")

        from app.models import (  # noqa: F401
            QueryRequest,
            ChatRequest,
            QueryResponse,
            ChatResponse,
            StatsResponse,
            HealthResponse,
            ErrorResponse,
        )

        print("  ✓ Models imported successfully")

        from app.api.routes import health, stats, queries  # noqa: F401

        print("  ✓ Routes imported successfully")

        from app.main import app  # noqa: F401

        print("  ✓ Main app imported successfully")

        return True
    except Exception as e:
        print(f"  ✗ Import failed: {e}")
        return False


def test_configuration():
    """Test configuration loading."""
    print("\n✓ Testing configuration...")

    try:
        from app.core.config import settings

        assert hasattr(settings, "API_TITLE")
        assert hasattr(settings, "OPENAI_MODEL")
        assert hasattr(settings, "DATA_FILE")

        print(f"  ✓ API Title: {settings.API_TITLE}")
        print(f"  ✓ OpenAI Model: {settings.OPENAI_MODEL}")
        print(f"  ✓ Data File: {settings.DATA_FILE}")

        return True
    except Exception as e:
        print(f"  ✗ Configuration test failed: {e}")
        return False


def test_models():
    """Test Pydantic models."""
    print("\n✓ Testing models...")

    try:
        from app.models import QueryRequest, ChatRequest

        # Test QueryRequest
        query_req = QueryRequest(question="Test question")
        assert query_req.question == "Test question"
        print("  ✓ QueryRequest model works")

        # Test ChatRequest
        chat_req = ChatRequest(question="Test chat", session_id="test-123")
        assert chat_req.question == "Test chat"
        assert chat_req.session_id == "test-123"
        print("  ✓ ChatRequest model works")

        return True
    except Exception as e:
        print(f"  ✗ Model test failed: {e}")
        return False


def test_agent_manager():
    """Test AgentManager class (without initialization)."""
    print("\n✓ Testing agent manager...")

    try:
        from app.core.agent import AgentManager

        # Create a fresh instance for testing
        manager = AgentManager()

        # Test that it has expected methods
        assert hasattr(manager, "initialize_agent")
        assert hasattr(manager, "get_agent")
        assert hasattr(manager, "get_or_create_session")
        assert hasattr(manager, "clear_session")
        assert hasattr(manager, "get_active_sessions_count")
        assert hasattr(manager, "cleanup")

        print("  ✓ AgentManager has all expected methods")

        # Test sessions count on fresh instance
        count = manager.get_active_sessions_count()
        assert count == 0
        print("  ✓ Initial session count is 0")

        return True
    except Exception as e:
        print(f"  ✗ Agent manager test failed: {e}")
        return False


def test_app_structure():
    """Test FastAPI app structure."""
    print("\n✓ Testing app structure...")

    try:
        from app.main import app

        # Check that routes are included
        routes = [route.path for route in app.routes]

        expected_routes = ["/", "/health", "/stats", "/query", "/chat"]

        for expected in expected_routes:
            if any(expected in route for route in routes):
                print(f"  ✓ Route '{expected}' found")
            else:
                print(f"  ✗ Route '{expected}' not found")
                return False

        return True
    except Exception as e:
        print(f"  ✗ App structure test failed: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Testing Refactored API Structure")
    print("=" * 60)

    results = []

    # Run tests
    results.append(("Imports", test_imports()))
    results.append(("Configuration", test_configuration()))
    results.append(("Models", test_models()))
    results.append(("Agent Manager", test_agent_manager()))
    results.append(("App Structure", test_app_structure()))

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✓ PASSED" if result else "✗ FAILED"
        print(f"{name:20s}: {status}")

    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 60)

    if passed == total:
        print("\n🎉 All tests passed! The refactored structure is working correctly.")
        print("\nNext steps:")
        print("  1. Install dependencies: pip install -r requirements.txt")
        print("  2. Set up .env file with OPENAI_API_KEY")
        print("  3. Run the app: python -m app.main")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please review the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
