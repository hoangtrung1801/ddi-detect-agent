# Codebase Structure

## Main Application Package (`app/`)
The main FastAPI application following a 3-tier layered architecture:

### `app/main.py`
- FastAPI application entrypoint
- Registers routes, middleware, and lifespan events
- CORS configuration

### `app/agents/` (LangGraph Implementation)
The new LangGraph-based agent implementation:
- **`drug_agent.py`**: Main DrugInteractionAgent class and create_agent() factory
- **`graph.py`**: LangGraph workflow definition with nodes and edges
- **`state.py`**: AgentState TypedDict for state management
- **`tools.py`**: Tool definitions (@tool decorated functions)
- **`README.md`**: Detailed agent documentation

### `app/api/routes/`
REST API endpoints:
- **`health.py`**: Health check and API info endpoints
- **`queries.py`**: Query and chat endpoints (main interaction)
- **`stats.py`**: Database and session statistics

### `app/core/`
Business logic layer:
- **`config.py`**: Settings class with environment variable management
- **`agent.py`**: AgentManager singleton for agent lifecycle management

### `app/models/`
Pydantic data models:
- **`requests.py`**: Request validation models (QueryRequest, ChatRequest)
- **`responses.py`**: Response formatting models (QueryResponse, ChatResponse)

## Root Level Files

### Core Implementation
- **`drug_interaction_graph.py`**: DrugInteractionGraph class (igraph wrapper)
- **`drug_agent.py`**: Legacy LangChain agent implementation
- **`drug_agent_api.py`**: Legacy standalone API server
- **`drug_agent_cli.py`**: Interactive CLI interface

### Test Files
- **`test_langgraph_agent.py`**: Tests for new LangGraph agent
- **`test_agent.py`**: Tests for legacy agent
- **`test_refactored_api.py`**: API integration tests

### Utilities
- **`visualize_graph.py`**: Graph visualization scripts
- **`example_usage.py`**: Basic usage examples
- **`quick_test.py`**: Quick validation script
- **`quick_visualize.py`**: Quick visualization

### Documentation
- **`README.md`**: Main project documentation
- **`ARCHITECTURE.md`**: Application architecture details
- **`QUICK_START.md`**: Getting started guide
- **`ENV_SETUP.md`**: Environment variable configuration
- **`LANGGRAPH_MIGRATION.md`**: Migration guide to LangGraph
- Various summary documents

## Data Files
- **`TWOSIDES_preprocessed.csv`**: Main drug interaction dataset
- **`drug_interactions.graphml`**: GraphML format export
- **`db_drug_interactions.csv`**: Database export
- **`sample_data.csv`**: Sample data for testing
- PNG files: Graph visualizations

## Dependency Flow
```
main.py
  ├─→ core/config.py (Settings)
  ├─→ core/agent.py (AgentManager)
  │    └─→ app/agents/* (LangGraph implementation)
  └─→ api/routes/*
       ├─→ models/*
       └─→ core/agent.py
```
