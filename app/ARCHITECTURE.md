# Application Architecture

## 🏗️ Architecture Overview

The Drug Interaction Agent API follows a **3-tier layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Routes)                    │
│  ┌──────────────┬──────────────┬──────────────┐        │
│  │   Health     │    Stats     │   Queries    │        │
│  │  Endpoints   │  Endpoints   │  & Chat      │        │
│  └──────────────┴──────────────┴──────────────┘        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Core Layer (Business Logic)            │
│  ┌──────────────────────┬───────────────────────┐      │
│  │   AgentManager       │   Settings            │      │
│  │   - Agent lifecycle  │   - Configuration     │      │
│  │   - Session mgmt     │   - Environment vars  │      │
│  └──────────────────────┴───────────────────────┘      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   Models Layer (Data)                    │
│  ┌──────────────────────┬───────────────────────┐      │
│  │   Request Models     │   Response Models     │      │
│  │   - QueryRequest     │   - QueryResponse     │      │
│  │   - ChatRequest      │   - ChatResponse      │      │
│  │                      │   - StatsResponse     │      │
│  └──────────────────────┴───────────────────────┘      │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              External Dependencies                       │
│  ┌──────────────────────┬───────────────────────┐      │
│  │ DrugInteractionAgent │   DrugInteractionGraph│      │
│  │   (drug_agent.py)    │ (drug_interaction_    │      │
│  │                      │     graph.py)         │      │
│  └──────────────────────┴───────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

## 📦 Module Dependencies

### Dependency Flow

```
main.py
  ├─→ core/config.py (Settings)
  ├─→ core/agent.py (AgentManager)
  │    └─→ core/config.py
  │    └─→ drug_agent.py (external)
  └─→ api/routes/*
       ├─→ models/*
       └─→ core/agent.py
```

### Import Hierarchy

```
Level 1 (No internal dependencies):
  - models/requests.py
  - models/responses.py
  - core/config.py

Level 2 (Depends on Level 1):
  - core/agent.py
    (uses: config.py)

Level 3 (Depends on Level 1 & 2):
  - api/routes/health.py
    (uses: models/*, core/agent.py)
  - api/routes/stats.py
    (uses: models/*, core/agent.py)
  - api/routes/queries.py
    (uses: models/*, core/agent.py)

Level 4 (Application):
  - main.py
    (uses: all of the above)
```

## 🔄 Request Flow

### Simple Query Flow

```
1. Client Request
   POST /query
   {"question": "What drugs interact with Aspirin?"}
        ↓
2. FastAPI Router
   routes/queries.py::query_drug_interaction()
        ↓
3. Get Agent
   agent_manager.get_agent()
        ↓
4. Clear Memory
   agent.clear_memory()
        ↓
5. Process Query
   agent.query(question)
        ↓
6. DrugInteractionAgent
   - Parse question
   - Execute tools
   - Generate response
        ↓
7. Format Response
   QueryResponse(answer, timestamp)
        ↓
8. Return to Client
   {"answer": "...", "timestamp": "..."}
```

### Chat with Session Flow

```
1. Client Request
   POST /chat
   {"question": "...", "session_id": "abc-123"}
        ↓
2. FastAPI Router
   routes/queries.py::chat_with_session()
        ↓
3. Get or Create Session
   agent_manager.get_or_create_session(session_id)
        ↓
4. Session Agent
   - Check if session exists
   - Create new if needed
   - Return existing agent with memory
        ↓
5. Process Query
   session_agent.query(question)
   (maintains conversation history)
        ↓
6. DrugInteractionAgent
   - Consider conversation context
   - Execute tools
   - Generate contextual response
        ↓
7. Format Response
   ChatResponse(answer, session_id, timestamp)
        ↓
8. Return to Client
   {"answer": "...", "session_id": "abc-123", "timestamp": "..."}
```

## 🎯 Component Responsibilities

### API Layer (`app/api/routes/`)

**Responsibility**: Handle HTTP requests and responses

**Components**:
- `health.py`: System health checks and API information
- `stats.py`: Database and session statistics
- `queries.py`: Drug interaction queries and chat sessions

**Duties**:
- Request validation (using Pydantic models)
- HTTP status codes and error handling
- Response formatting
- Endpoint documentation

### Core Layer (`app/core/`)

**Responsibility**: Business logic and system management

**Components**:
- `config.py`: Application configuration
- `agent.py`: Agent lifecycle and session management

**Duties**:
- Configuration management with validation
- Agent initialization and cleanup
- Session creation and management
- State management

### Models Layer (`app/models/`)

**Responsibility**: Data validation and serialization

**Components**:
- `requests.py`: Input data models
- `responses.py`: Output data models

**Duties**:
- Data validation
- Type checking
- JSON schema generation
- API documentation

## 🔐 Separation of Concerns

### What Goes Where?

| Concern | Layer | File |
|---------|-------|------|
| HTTP handling | API | routes/*.py |
| Request validation | Models | requests.py |
| Response formatting | Models | responses.py |
| Configuration | Core | config.py |
| Agent management | Core | agent.py |
| Business logic | External | drug_agent.py |
| Data structures | External | drug_interaction_graph.py |

## 🚦 Lifecycle Management

### Application Startup

```
1. Load Environment Variables
   (.env file) → Settings
        ↓
2. Initialize FastAPI App
   main.py creates app instance
        ↓
3. Register Middleware
   CORS configuration
        ↓
4. Register Routes
   Include routers from routes/
        ↓
5. Lifespan Startup
   agent_manager.initialize_agent()
        ↓
6. Load Data & Create Agent
   - Read CSV data
   - Initialize DrugInteractionGraph
   - Create DrugInteractionAgent
        ↓
7. Ready to Serve Requests
```

### Application Shutdown

```
1. Lifespan Shutdown Triggered
        ↓
2. Cleanup Sessions
   agent_manager.cleanup()
        ↓
3. Clear Memory
   - Clear all session agents
   - Release resources
        ↓
4. Shutdown Complete
```

## 📊 Data Flow

### Configuration Data

```
.env file
    ↓
os.environ
    ↓
Settings class (core/config.py)
    ↓
Application components
```

### Session Data

```
Client Request (with session_id)
    ↓
AgentManager.get_or_create_session()
    ↓
sessions dict {session_id: DrugInteractionAgent}
    ↓
Session Agent (with conversation memory)
    ↓
Query processing (with context)
    ↓
Response (maintaining session)
```

## 🧩 Design Patterns

### 1. **Singleton Pattern**
- `agent_manager`: Single global instance
- `settings`: Single configuration instance

### 2. **Factory Pattern**
- `create_agent()`: Agent creation
- `get_or_create_session()`: Session creation

### 3. **Dependency Injection**
- FastAPI routers inject dependencies
- Configuration injected via settings

### 4. **Repository Pattern**
- `AgentManager`: Manages agent instances
- Abstracts storage and retrieval

### 5. **Layered Architecture**
- Clear separation: API → Core → Models
- Each layer depends only on lower layers

## 🔧 Extension Points

### Adding New Endpoints

```python
# 1. Create new route file
# app/api/routes/my_routes.py

from fastapi import APIRouter
router = APIRouter()

@router.get("/my-endpoint")
async def my_endpoint():
    return {"message": "Hello"}

# 2. Register in main.py
from app.api.routes import my_routes
app.include_router(my_routes.router)
```

### Adding New Configuration

```python
# In app/core/config.py

class Settings(BaseSettings):
    # Add new setting
    MY_NEW_SETTING: str = "default_value"

# Use in code
from app.core.config import settings
value = settings.MY_NEW_SETTING
```

### Adding New Models

```python
# In app/models/requests.py or responses.py

class MyNewRequest(BaseModel):
    field: str = Field(..., description="My field")

# Export in __init__.py
from .requests import MyNewRequest
```

## 🎓 Best Practices Implemented

### 1. **Configuration Management**
✅ Centralized configuration
✅ Environment variable validation
✅ Type-safe settings
✅ Default values

### 2. **Error Handling**
✅ Proper HTTP status codes
✅ Detailed error messages
✅ Exception handling at boundaries
✅ Graceful degradation

### 3. **Code Organization**
✅ Single Responsibility Principle
✅ Separation of Concerns
✅ Clear module boundaries
✅ Logical grouping

### 4. **Documentation**
✅ Docstrings on all functions
✅ Type hints throughout
✅ README files
✅ Architecture documentation

### 5. **Testing**
✅ Testable components
✅ Clear dependencies
✅ Mock-friendly design
✅ Automated validation

## 📈 Scalability Considerations

### Current Design Supports:

1. **Horizontal Scaling**
   - Stateless query endpoint
   - Session storage can be externalized (Redis)

2. **Feature Growth**
   - Easy to add new routes
   - Modular design supports new features

3. **Team Growth**
   - Clear module ownership
   - Parallel development

4. **Performance**
   - Session pooling
   - Shared graph instance
   - Memory management

### Future Enhancements:

1. **Database Integration**
   - Replace in-memory sessions with database
   - Persistent session storage

2. **Caching**
   - Add Redis for response caching
   - Cache frequently queried interactions

3. **Authentication**
   - Add API key middleware
   - User management

4. **Rate Limiting**
   - Protect against abuse
   - Per-session or per-IP limits

5. **Monitoring**
   - Add metrics collection
   - Performance monitoring
   - Error tracking

## 🎯 Conclusion

This architecture provides:

- ✅ **Clear separation of concerns**
- ✅ **Easy to understand and navigate**
- ✅ **Simple to extend and modify**
- ✅ **Ready for production use**
- ✅ **Testable and maintainable**
- ✅ **Follows industry best practices**

The modular design ensures the application can grow and evolve while maintaining code quality and developer productivity.
