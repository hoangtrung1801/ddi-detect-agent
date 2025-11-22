# Migration Guide: Refactored API Structure

This guide explains how to migrate from the old monolithic `drug_agent_api.py` to the new refactored structure in the `/app` directory.

## 🎯 Overview

The Drug Interaction Agent API has been refactored from a single file into a modular, maintainable structure following FastAPI best practices.

### What Changed?

| Aspect | Before | After |
|--------|--------|-------|
| **Structure** | Single file (`drug_agent_api.py`) | Modular structure (`/app` directory) |
| **Configuration** | Environment variables scattered | Centralized in `app/core/config.py` |
| **Agent Management** | Global variables | `AgentManager` class |
| **Models** | In main file | Separate `app/models/` directory |
| **Routes** | All in one file | Organized in `app/api/routes/` |

## 📦 Installation

### 1. Update Dependencies

The refactored version requires `pydantic-settings`. Update your dependencies:

```bash
pip install -r requirements.txt
```

Or install just the new dependency:

```bash
pip install pydantic-settings>=2.0.0
```

### 2. Environment Variables

No changes to environment variables are needed. The `.env` file works exactly as before:

```bash
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-5-mini-2025-08-07
DATA_FILE=TWOSIDES_preprocessed.csv
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true
```

## 🚀 Running the Application

### Old Way (Still Works)

```bash
python drug_agent_api.py
```

### New Way (Recommended)

**Option 1: Using Python module**
```bash
python -m app.main
```

**Option 2: Using uvicorn directly**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Option 3: Using the script**
```bash
python app/main.py
```

## 🔧 API Endpoints (No Changes)

All API endpoints remain the same:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API information |
| `/health` | GET | Health check |
| `/stats` | GET | Statistics |
| `/query` | POST | Simple query |
| `/chat` | POST | Chat with session |
| `/chat/{session_id}` | DELETE | Clear session |

## 📝 Code Changes Required

### If You Were Importing the Old Module

**Before:**
```python
from drug_agent_api import app, agent, sessions
```

**After:**
```python
from app.main import app
from app.core.agent import agent_manager

# Access agent
agent = agent_manager.get_agent()

# Access sessions
sessions = agent_manager.sessions
```

### If You Were Extending the API

**Before (adding a new endpoint):**
```python
# At the end of drug_agent_api.py
@app.get("/my-endpoint")
def my_endpoint():
    return {"message": "Hello"}
```

**After (create a new route file):**
```python
# app/api/routes/my_routes.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/my-endpoint", tags=["Custom"])
def my_endpoint():
    return {"message": "Hello"}

# Then in app/main.py
from app.api.routes import my_routes
app.include_router(my_routes.router)
```

## 🔄 Component Mapping

### Configuration

**Before:**
```python
# In drug_agent_api.py
data_file = os.getenv("DATA_FILE", "TWOSIDES_preprocessed.csv")
model_name = os.getenv("OPENAI_MODEL", "gpt-5-mini-2025-08-07")
```

**After:**
```python
# In app/core/config.py
from app.core.config import settings

data_file = settings.DATA_FILE
model_name = settings.OPENAI_MODEL
```

### Agent Management

**Before:**
```python
# In drug_agent_api.py
agent: Optional[DrugInteractionAgent] = None
sessions: Dict[str, DrugInteractionAgent] = {}

# Startup
agent = create_agent(...)

# Session creation
if session_id not in sessions:
    sessions[session_id] = DrugInteractionAgent(...)
```

**After:**
```python
# In app/core/agent.py
from app.core.agent import agent_manager

# Startup (handled automatically)
agent_manager.initialize_agent()

# Get agent
agent = agent_manager.get_agent()

# Session creation
session_id, session_agent = agent_manager.get_or_create_session(session_id)

# Clear session
agent_manager.clear_session(session_id)

# Get active sessions count
count = agent_manager.get_active_sessions_count()
```

### Models

**Before:**
```python
# In drug_agent_api.py
class QueryRequest(BaseModel):
    question: str = Field(...)
```

**After:**
```python
# In app/models/requests.py
from app.models import QueryRequest, ChatRequest
from app.models import QueryResponse, ChatResponse
```

## 🧪 Testing Impact

### Unit Tests

The refactored structure makes testing easier:

**Before (testing was difficult):**
- Had to mock global variables
- Couldn't test components in isolation
- Required full app initialization

**After (testing is easier):**

```python
# Test configuration
from app.core.config import Settings

def test_settings():
    settings = Settings(DATA_FILE="test.csv")
    assert settings.DATA_FILE == "test.csv"

# Test agent manager
from app.core.agent import AgentManager

def test_agent_manager():
    manager = AgentManager()
    # Test methods independently

# Test routes
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
```

## 🔍 Directory Structure

```
ai/
├── app/                          # NEW: Refactored application
│   ├── __init__.py
│   ├── main.py                   # FastAPI app
│   ├── README.md                 # App documentation
│   ├── api/
│   │   └── routes/
│   │       ├── health.py         # Health endpoints
│   │       ├── stats.py          # Stats endpoints
│   │       └── queries.py        # Query/chat endpoints
│   ├── core/
│   │   ├── config.py            # Configuration
│   │   └── agent.py             # Agent management
│   └── models/
│       ├── requests.py          # Request models
│       └── responses.py         # Response models
│
├── drug_agent_api.py             # OLD: Original file (can be kept for reference)
├── drug_agent.py                 # Agent implementation (unchanged)
├── drug_interaction_graph.py     # Graph implementation (unchanged)
└── requirements.txt              # Updated with pydantic-settings
```

## ✅ Validation Checklist

After migration, verify:

- [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] Environment variables in `.env` file
- [ ] Data file exists: `TWOSIDES_preprocessed.csv`
- [ ] App starts: `python -m app.main`
- [ ] Health check works: `curl http://localhost:8000/health`
- [ ] Stats endpoint works: `curl http://localhost:8000/stats`
- [ ] Query endpoint works: `curl -X POST http://localhost:8000/query -H "Content-Type: application/json" -d '{"question":"test"}'`
- [ ] API docs accessible: http://localhost:8000/docs

## 🐛 Troubleshooting

### Import Errors

**Error:** `ModuleNotFoundError: No module named 'app'`

**Solution:** Run from the project root directory:
```bash
cd /Users/hoangtrung1801/develpoment/ai-prediciting-ddi/ai
python -m app.main
```

### Configuration Errors

**Error:** `OPENAI_API_KEY not found`

**Solution:** Ensure `.env` file exists and contains:
```bash
OPENAI_API_KEY=your-key-here
```

### Import Path Issues

**Error:** `ModuleNotFoundError: No module named 'drug_agent'`

**Solution:** The `drug_agent.py` file must be in the project root (parent of `app/`)

## 🎓 Learning Resources

To better understand the new structure:

1. **FastAPI Best Practices**: https://fastapi.tiangolo.com/tutorial/bigger-applications/
2. **Pydantic Settings**: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
3. **Python Package Structure**: https://docs.python.org/3/tutorial/modules.html#packages

## 💡 Benefits of the Refactored Structure

1. **Modularity**: Easy to add/modify features
2. **Testability**: Components can be tested independently
3. **Maintainability**: Clear organization and separation of concerns
4. **Scalability**: Ready for growth
5. **Team Collaboration**: Multiple developers can work on different modules
6. **Best Practices**: Follows industry-standard patterns

## 🔄 Rollback Plan

If you need to rollback to the old structure:

1. The original `drug_agent_api.py` remains unchanged
2. Simply run: `python drug_agent_api.py`
3. No data or configuration changes needed

## 📞 Need Help?

If you encounter issues during migration:

1. Check this guide's troubleshooting section
2. Review the `app/README.md` for detailed documentation
3. Compare your changes with the original `drug_agent_api.py`
4. Ensure all dependencies are installed
5. Verify environment variables are set correctly
