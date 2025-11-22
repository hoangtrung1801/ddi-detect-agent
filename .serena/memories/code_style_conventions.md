# Code Style and Conventions

## General Style

### Type Hints
- **Used throughout the codebase**: All functions and methods have type hints
- **Pydantic models**: Extensive use of Pydantic for data validation
- **TypedDict**: Used for state management (e.g., AgentState)

Example:
```python
def query(self, question: str, thread_id: Optional[str] = None) -> str:
    """Query the agent."""
    ...
```

### Docstrings
- **Google-style docstrings** appear to be the standard
- All public functions, classes, and methods have docstrings
- Include descriptions, parameters, returns, and examples where appropriate

Example:
```python
def search_interaction(drug1: str, drug2: str) -> Optional[str]:
    """Search for an interaction between two specific drugs.
    
    Parameters:
        drug1: First drug name (case-insensitive)
        drug2: Second drug name (case-insensitive)
    
    Returns:
        Condition string if interaction exists, None otherwise
    """
```

### Naming Conventions
- **Classes**: PascalCase (e.g., `DrugInteractionAgent`, `AgentManager`)
- **Functions/Methods**: snake_case (e.g., `create_agent`, `get_all_interactions`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `OPENAI_API_KEY`, `API_HOST`)
- **Private methods**: Leading underscore (e.g., `_agent_node`)
- **Module names**: snake_case (e.g., `drug_agent.py`, `state.py`)

### Import Organization
Standard Python import ordering:
1. Standard library imports
2. Third-party imports (FastAPI, LangChain, etc.)
3. Local application imports

Example:
```python
import os
from typing import Optional

from fastapi import FastAPI
from langchain_openai import ChatOpenAI

from app.core.config import settings
```

## Architecture Patterns

### Layered Architecture
The application follows a 3-tier architecture:
1. **API Layer** (routes): HTTP handling and request/response
2. **Core Layer** (core, agents): Business logic
3. **Models Layer**: Data validation

**Key Principle**: Lower layers don't depend on upper layers

### Design Patterns Used
1. **Singleton Pattern**: AgentManager, Settings
2. **Factory Pattern**: `create_agent()` function
3. **Dependency Injection**: FastAPI router dependencies
4. **Repository Pattern**: AgentManager manages agent instances

### State Management
- **LangGraph**: Uses TypedDict-based state (AgentState)
- **Thread-based memory**: Each session has a unique thread_id
- **Immutable state updates**: State is passed and updated through the graph

## Pydantic Models

### BaseModel Usage
All request/response models inherit from `pydantic.BaseModel`:
```python
from pydantic import BaseModel, Field

class QueryRequest(BaseModel):
    question: str = Field(..., description="The question to ask")
```

### Settings Management
Environment variables managed via `pydantic-settings`:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    API_HOST: str = "0.0.0.0"
    
    class Config:
        env_file = ".env"
```

## Error Handling

### HTTP Status Codes
- **200**: Successful response
- **500**: Internal server error (with error details)

### Exception Handling
- Try/except blocks at API boundaries
- Detailed error messages in responses
- Graceful degradation where possible

## LangGraph Conventions

### Tool Definitions
Use the `@tool` decorator from LangChain:
```python
from langchain_core.tools import tool

@tool
def search_drug_interaction(drug1: str, drug2: str) -> str:
    """Search for interaction between two drugs."""
    ...
```

### Graph Structure
- Explicit nodes for agent reasoning and tool execution
- Conditional edges for routing decisions
- State-based flow control

### Memory Management
- Thread-based with unique IDs per session
- MemorySaver checkpointer for persistence
- Clear separation between sessions

## Best Practices Observed

1. **Separation of Concerns**: Clear module boundaries
2. **Single Responsibility**: Each module has a focused purpose
3. **DRY (Don't Repeat Yourself)**: Shared logic in utilities
4. **Configuration over Code**: Environment variables for settings
5. **Documentation**: Comprehensive README files and docstrings
6. **Type Safety**: Extensive use of type hints and Pydantic validation

## No Explicit Linting/Formatting Config
- No `black`, `flake8`, `mypy`, or `pylint` configuration found
- No `pyproject.toml` or `.cfg` files for code style
- Code appears to follow PEP 8 conventions by convention
