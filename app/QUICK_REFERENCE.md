# Quick Reference Guide

## 🚀 Start the Application

```bash
# Method 1: Using Python module (recommended)
python -m app.main

# Method 2: Using uvicorn
uvicorn app.main:app --reload

# Method 3: Direct execution
python app/main.py
```

## 📁 File Structure at a Glance

```
app/
├── main.py                 # FastAPI app initialization
├── core/
│   ├── config.py          # Settings & configuration
│   └── agent.py           # Agent & session management
├── api/routes/
│   ├── health.py          # GET / and /health
│   ├── stats.py           # GET /stats
│   └── queries.py         # POST /query, /chat, DELETE /chat/{id}
└── models/
    ├── requests.py        # QueryRequest, ChatRequest
    └── responses.py       # QueryResponse, ChatResponse, etc.
```

## 🔗 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | API information |
| `/health` | GET | Health check |
| `/stats` | GET | Database statistics |
| `/query` | POST | Simple query (no session) |
| `/chat` | POST | Chat with session |
| `/chat/{session_id}` | DELETE | Clear session |

## 📊 Common Imports

```python
# Configuration
from app.core.config import settings

# Agent management
from app.core.agent import agent_manager

# Models
from app.models import (
    QueryRequest, ChatRequest,
    QueryResponse, ChatResponse,
    StatsResponse, HealthResponse
)

# Routes
from app.api.routes import health, stats, queries

# Main app
from app.main import app
```

## ⚙️ Configuration

### Environment Variables (.env)

```bash
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-5-mini-2025-08-07
DATA_FILE=TWOSIDES_preprocessed.csv
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true
```

### Accessing Settings

```python
from app.core.config import settings

print(settings.API_PORT)
print(settings.OPENAI_MODEL)
```

## 🔧 Common Tasks

### Get the Main Agent

```python
from app.core.agent import agent_manager

agent = agent_manager.get_agent()
stats = agent.get_graph_stats()
```

### Create/Get a Session

```python
from app.core.agent import agent_manager

session_id, session_agent = agent_manager.get_or_create_session("user-123")
response = session_agent.query("What is Aspirin?")
```

### Clear a Session

```python
from app.core.agent import agent_manager

success = agent_manager.clear_session("user-123")
```

### Get Active Sessions Count

```python
from app.core.agent import agent_manager

count = agent_manager.get_active_sessions_count()
```

## 🧪 Testing

### Run Structure Tests

```bash
python test_refactored_api.py
```

### Manual API Testing

```bash
# Health check
curl http://localhost:8000/health

# Stats
curl http://localhost:8000/stats

# Query
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are interactions for Aspirin?"}'

# Chat
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "Tell me about Warfarin", "session_id": "test-123"}'
```

## 📖 Documentation

- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **App README**: `app/README.md`
- **Architecture**: `app/ARCHITECTURE.md`
- **Migration Guide**: `MIGRATION_GUIDE.md`

## 🔍 Troubleshooting

### Import Errors

```bash
# Make sure you're in the project root
cd /Users/hoangtrung1801/develpoment/ai-prediciting-ddi/ai

# Run as module
python -m app.main
```

### Missing Dependencies

```bash
pip install -r requirements.txt
```

### Agent Not Loading

Check:
1. ✅ `.env` file exists with `OPENAI_API_KEY`
2. ✅ `TWOSIDES_preprocessed.csv` exists
3. ✅ All dependencies installed

## 🎨 Adding New Features

### Add a New Endpoint

```python
# 1. Create route file: app/api/routes/my_feature.py
from fastapi import APIRouter
router = APIRouter()

@router.get("/my-endpoint", tags=["MyFeature"])
async def my_endpoint():
    return {"status": "ok"}

# 2. Register in app/main.py
from app.api.routes import my_feature
app.include_router(my_feature.router)
```

### Add a New Model

```python
# In app/models/requests.py or responses.py
class MyModel(BaseModel):
    field: str = Field(..., description="Description")

# Export in app/models/__init__.py
from .requests import MyModel
```

### Add Configuration Setting

```python
# In app/core/config.py
class Settings(BaseSettings):
    MY_SETTING: str = "default_value"

# Use anywhere
from app.core.config import settings
value = settings.MY_SETTING
```

## 🐛 Common Issues

### "Agent not loaded" Error

**Cause**: Agent failed to initialize

**Solution**:
- Check OPENAI_API_KEY is set
- Verify data file exists
- Check startup logs for errors

### Session Not Found

**Cause**: Session expired or invalid ID

**Solution**:
- Use the session_id from previous response
- Sessions are cleared on app restart

### Import Path Issues

**Cause**: Running from wrong directory

**Solution**:
```bash
# Always run from project root
cd /Users/hoangtrung1801/develpoment/ai-prediciting-ddi/ai
python -m app.main
```

## 📦 Dependencies

Key packages:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pydantic` - Data validation
- `pydantic-settings` - Configuration
- `langchain` - Agent framework
- `python-dotenv` - Environment variables

## 🔄 Migration from Old API

| Old | New |
|-----|-----|
| `python drug_agent_api.py` | `python -m app.main` |
| Global `agent` | `agent_manager.get_agent()` |
| Global `sessions` | `agent_manager.sessions` |
| Direct env vars | `settings.SETTING_NAME` |

## 📊 Performance Tips

1. **Reuse sessions**: Don't create new sessions for each request
2. **Clear old sessions**: Delete unused sessions to free memory
3. **Use /query for one-off**: No session overhead
4. **Use /chat for conversations**: Session maintains context

## 🎯 Best Practices

1. ✅ Use session IDs for conversations
2. ✅ Clear sessions when done
3. ✅ Handle errors gracefully
4. ✅ Check /health before queries
5. ✅ Use appropriate endpoint (/query vs /chat)

## 🔐 Security Notes

⚠️ **For Production**:
- Set proper CORS origins (not `["*"]`)
- Add authentication middleware
- Use environment-specific configs
- Enable rate limiting
- Use HTTPS

## 📞 Quick Links

- **Test API**: `python test_refactored_api.py`
- **Start API**: `python -m app.main`
- **View Docs**: http://localhost:8000/docs
- **Check Health**: http://localhost:8000/health
- **Get Stats**: http://localhost:8000/stats

---

**For detailed information, see:**
- `app/README.md` - Comprehensive documentation
- `app/ARCHITECTURE.md` - System architecture
- `MIGRATION_GUIDE.md` - Migration instructions
