# Design Patterns and Guidelines

## Architectural Patterns

### 1. Layered Architecture (3-Tier)

The application strictly follows a layered architecture:

```
┌─────────────────────────────────────┐
│     API Layer (app/api/routes/)     │  HTTP handling, routing
├─────────────────────────────────────┤
│     Core Layer (app/core/, agents/) │  Business logic, agents
├─────────────────────────────────────┤
│     Models Layer (app/models/)      │  Data validation
└─────────────────────────────────────┘
```

**Rules**:
- Upper layers can depend on lower layers
- Lower layers NEVER depend on upper layers
- Each layer has clear, distinct responsibilities

**Example**:
- `routes/queries.py` → uses `core/agent.py` ✓
- `core/agent.py` → uses `routes/queries.py` ✗ (violation)

### 2. Singleton Pattern

Used for global, single-instance objects:

```python
# app/core/agent.py
class AgentManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

# Global singleton
agent_manager = AgentManager()
```

**Where Used**:
- `AgentManager` (core/agent.py)
- `Settings` instance (core/config.py)

### 3. Factory Pattern

Used for object creation with complex initialization:

```python
def create_agent(
    data_filepath: str,
    model_name: str = "gpt-4o-mini",
    verbose: bool = False,
    thread_id: Optional[str] = None,
) -> DrugInteractionAgent:
    """Factory function to create a configured agent."""
    graph = load_graph(data_filepath)
    return DrugInteractionAgent(
        graph=graph,
        model_name=model_name,
        verbose=verbose,
        thread_id=thread_id,
    )
```

**Benefits**:
- Encapsulates complex creation logic
- Provides sensible defaults
- Easy to modify without changing call sites

### 4. Dependency Injection

FastAPI's native dependency injection system:

```python
from app.core.agent import agent_manager

@router.post("/query")
async def query_drug_interaction(request: QueryRequest):
    agent = agent_manager.get_agent()  # Dependency injected
    response = agent.query(request.question)
    return QueryResponse(answer=response)
```

**Benefits**:
- Testability (can inject mocks)
- Loose coupling
- Clear dependencies

### 5. Repository Pattern

`AgentManager` acts as a repository for agent instances:

```python
class AgentManager:
    def __init__(self):
        self.agent: Optional[DrugInteractionAgent] = None
        self.sessions: Dict[str, DrugInteractionAgent] = {}
    
    def get_agent(self) -> DrugInteractionAgent:
        """Get the global agent instance."""
        ...
    
    def get_or_create_session(self, session_id: str) -> DrugInteractionAgent:
        """Get or create session agent."""
        ...
```

**Benefits**:
- Centralized agent management
- Session lifecycle control
- Memory management

## LangGraph-Specific Patterns

### Graph-Based Workflow

The agent uses an explicit graph structure:

```python
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("agent", self._agent_node)
workflow.add_node("tools", ToolNode(self.tools))

# Add edges with conditions
workflow.add_conditional_edges(
    "agent",
    tools_condition,
    {"continue": "tools", "end": END}
)
```

**Key Concepts**:
1. **Nodes**: Discrete processing steps
2. **Edges**: Transitions between nodes
3. **Conditional Edges**: Routing based on state
4. **State**: Data flowing through the graph

### State Management Pattern

State is immutable and flows through the graph:

```python
class AgentState(TypedDict):
    messages: Sequence[BaseMessage]  # Conversation history
    input: str                        # Current input
    output: str                       # Current output
    intermediate_steps: list          # Debug info
```

**Rules**:
- State is TypedDict for type safety
- Each node receives and returns state
- State updates are explicit
- No global mutable state

### Tool Definition Pattern

Tools use decorators and have LLM-friendly signatures:

```python
@tool
def search_drug_interaction(drug1: str, drug2: str) -> str:
    """
    Search for interactions between two specific drugs.
    
    Use this when the user asks about interactions between two named drugs.
    
    Args:
        drug1: Name of the first drug
        drug2: Name of the second drug
    
    Returns:
        A description of the interaction or a message if none found
    """
    # Implementation
```

**Best Practices**:
- Clear, detailed docstring (LLM reads this!)
- Simple parameter types (str, int, bool)
- Return strings or simple dicts
- Handle errors gracefully

### Thread-Based Memory

Each conversation has a unique thread ID:

```python
# Create agent with specific thread
agent = DrugInteractionAgent(
    graph=graph,
    thread_id="user-123"
)

# Queries maintain context via thread_id
agent.query("Tell me about Warfarin")
agent.query("What drugs interact with it?")  # "it" = Warfarin
```

**Pattern**:
- Thread ID = conversation identifier
- MemorySaver checkpointer stores history
- Clear memory = new thread ID

## FastAPI Patterns

### Lifespan Management

Use context managers for startup/shutdown:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    agent_manager.initialize_agent()
    yield
    # Shutdown
    agent_manager.cleanup()

app = FastAPI(lifespan=lifespan)
```

### Pydantic Validation

All inputs/outputs validated via Pydantic:

```python
class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Question to ask")

@router.post("/query")
async def query(request: QueryRequest) -> QueryResponse:
    # request is automatically validated
    ...
```

### Router Organization

Group related endpoints into routers:

```python
# app/api/routes/queries.py
router = APIRouter(prefix="", tags=["queries"])

@router.post("/query")
async def query_drug_interaction(...):
    ...

@router.post("/chat")
async def chat_with_session(...):
    ...

# app/main.py
app.include_router(queries.router)
```

## Error Handling Patterns

### API Boundaries

Handle errors at API boundaries:

```python
@router.post("/query")
async def query_drug_interaction(request: QueryRequest):
    try:
        agent = agent_manager.get_agent()
        response = agent.query(request.question)
        return QueryResponse(answer=response)
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
```

### Graceful Degradation

Provide helpful messages when things fail:

```python
def search_interaction(drug1: str, drug2: str) -> str:
    result = graph.search_interaction(drug1, drug2)
    if result is None:
        return f"No interaction found between {drug1} and {drug2}"
    return result
```

## Data Access Patterns

### Graph as Single Source of Truth

The `DrugInteractionGraph` is loaded once and shared:

```python
class AgentManager:
    def initialize_agent(self):
        # Load graph once
        self.graph = load_graph(settings.DATA_FILE)
        # Create agent with graph reference
        self.agent = DrugInteractionAgent(graph=self.graph)
```

**Benefits**:
- No redundant data loading
- Consistent data across requests
- Memory efficient

### Case-Insensitive Search

Graph uses normalized keys for lookups:

```python
def _normalize(self, name: str) -> str:
    """Normalize drug name for case-insensitive lookup."""
    return name.lower().strip()
```

## Configuration Patterns

### Environment-Based Configuration

All configuration via environment variables:

```python
class Settings(BaseSettings):
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"
    DATA_FILE: str = "drug_interactions.graphml"
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

**Guidelines**:
- Required fields have no default (will error if missing)
- Optional fields have sensible defaults
- Never hardcode secrets
- Document in ENV_SETUP.md

## Anti-Patterns to Avoid

### ❌ Circular Dependencies

```python
# BAD: Don't do this
# app/core/agent.py
from app.api.routes.queries import some_function  # ✗

# GOOD: Keep dependencies flowing downward
from app.core.agent import AgentManager  # ✓
```

### ❌ Business Logic in Routes

```python
# BAD: Business logic in route
@router.post("/query")
async def query(request: QueryRequest):
    graph = load_graph("data.csv")  # ✗ Wrong place
    result = graph.search(...)
    return result

# GOOD: Route delegates to core layer
@router.post("/query")
async def query(request: QueryRequest):
    agent = agent_manager.get_agent()  # ✓ Correct
    return agent.query(request.question)
```

### ❌ Mutable Global State

```python
# BAD: Mutable global
current_user = "user123"  # ✗

# GOOD: Thread-based or request-scoped
agent = DrugInteractionAgent(thread_id="user123")  # ✓
```

### ❌ Tight Coupling

```python
# BAD: Hardcoded dependency
class Agent:
    def __init__(self):
        self.graph = DrugInteractionGraph()  # ✗ Hard to test

# GOOD: Dependency injection
class Agent:
    def __init__(self, graph: DrugInteractionGraph):
        self.graph = graph  # ✓ Easy to mock
```

## Summary of Key Principles

1. **Separation of Concerns**: Each module has one job
2. **Dependency Inversion**: Depend on abstractions, not concretions
3. **Single Responsibility**: Classes and functions do one thing well
4. **DRY (Don't Repeat Yourself)**: Extract common logic
5. **Explicit is Better**: Clear, readable code over clever tricks
6. **Type Safety**: Use type hints and Pydantic validation
7. **Fail Fast**: Validate early, fail with clear messages
8. **Stateless Where Possible**: State management via thread IDs, not globals
9. **Configuration Over Code**: Environment variables for settings
10. **Documentation as Code**: Docstrings, type hints, clear naming
