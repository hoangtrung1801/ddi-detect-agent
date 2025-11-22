# Task Completion Checklist

When completing a development task in this project, follow this checklist:

## 1. Code Quality

### Type Hints
- [ ] All new functions have type hints for parameters and return values
- [ ] Use `Optional[T]` for nullable types
- [ ] Use appropriate types from `typing` module (List, Dict, Sequence, etc.)

### Docstrings
- [ ] All new public functions/classes have docstrings
- [ ] Docstring includes description, parameters, returns, and examples if complex
- [ ] Follow Google-style docstring format

### Imports
- [ ] Imports organized: standard library → third-party → local
- [ ] No unused imports
- [ ] Use absolute imports for app modules (from app.agents import ...)

## 2. Architecture Compliance

### Layered Architecture
- [ ] API layer only handles HTTP concerns (routes/*.py)
- [ ] Business logic stays in core or agents
- [ ] Data validation uses Pydantic models
- [ ] No circular dependencies

### Separation of Concerns
- [ ] Each module has single, clear responsibility
- [ ] Configuration in core/config.py
- [ ] Models in models/ directory
- [ ] No business logic in routes

## 3. Testing

### Manual Testing
- [ ] Test the specific feature added/modified
- [ ] Run relevant test scripts:
  - `python test_langgraph_agent.py` for agent changes
  - `python test_refactored_api.py` for API changes
- [ ] Test edge cases and error conditions

### API Testing (if applicable)
- [ ] Test endpoints with curl or API docs
- [ ] Verify request validation works
- [ ] Check error responses have appropriate status codes
- [ ] Test both success and failure scenarios

### Integration Testing
- [ ] Test with actual OpenAI API (if agent changes)
- [ ] Verify data loading from CSV/GraphML files
- [ ] Test session management (if applicable)

## 4. Documentation

### Code Comments
- [ ] Complex logic has explanatory comments
- [ ] TODOs added for future improvements (if any)
- [ ] Remove debug print statements

### README Updates
- [ ] Update relevant README files if adding features
- [ ] Update ARCHITECTURE.md if changing structure
- [ ] Add examples for new functionality

### API Documentation
- [ ] FastAPI endpoints have descriptions in docstrings
- [ ] Pydantic models have Field descriptions
- [ ] OpenAPI docs remain accurate

## 5. Environment & Configuration

### Environment Variables
- [ ] New settings added to core/config.py
- [ ] .env.example updated with new variables
- [ ] ENV_SETUP.md updated if needed
- [ ] Default values provided where sensible

### Dependencies
- [ ] New packages added to requirements.txt
- [ ] Version constraints specified if needed
- [ ] Dependencies are necessary and well-maintained

## 6. Error Handling

### Exception Handling
- [ ] Proper try/except blocks at boundaries
- [ ] Meaningful error messages
- [ ] Appropriate HTTP status codes (API)
- [ ] No silent failures

### Validation
- [ ] Input validation via Pydantic models
- [ ] Check for None/empty values where needed
- [ ] Validate file paths and data formats

## 7. Code Style

### Naming
- [ ] Classes: PascalCase
- [ ] Functions/variables: snake_case
- [ ] Constants: UPPER_SNAKE_CASE
- [ ] Private methods: _leading_underscore

### Formatting
- [ ] Consistent indentation (4 spaces)
- [ ] Max line length reasonable (~88-120 chars)
- [ ] Blank lines between logical sections
- [ ] No trailing whitespace

## 8. Agent-Specific (if modifying agents/)

### LangGraph
- [ ] State updates properly typed in AgentState
- [ ] Tools use @tool decorator
- [ ] Graph nodes and edges correctly configured
- [ ] Thread IDs properly managed for sessions

### Tools
- [ ] Tool docstrings are clear (LLM uses them)
- [ ] Tool parameters properly typed
- [ ] Return types are LLM-friendly (strings/dicts)
- [ ] Error cases handled gracefully

## 9. Performance & Scalability

### Efficiency
- [ ] No unnecessary database/file reads
- [ ] Graph operations use efficient methods
- [ ] Large datasets handled appropriately
- [ ] Memory usage considered for long sessions

### Caching
- [ ] Reuse graph instances (don't reload data)
- [ ] Session management doesn't leak memory
- [ ] Clear unused sessions periodically

## 10. Security & Best Practices

### API Keys
- [ ] Never hardcode API keys
- [ ] Use environment variables
- [ ] No keys in logs or error messages

### Data Validation
- [ ] All user input validated
- [ ] SQL injection not possible (using graph, not SQL)
- [ ] No arbitrary code execution risks

## Before Committing

- [ ] All tests pass
- [ ] No linter errors (if using linter)
- [ ] Documentation is updated
- [ ] Environment setup is complete
- [ ] Changes are backwards compatible (or migration documented)

## What NOT to Do

❌ Don't commit:
- API keys or secrets
- __pycache__ directories
- .env files
- Large binary files
- Temporary test files

❌ Don't add:
- Unnecessary dependencies
- Commented-out code (remove it)
- Debug print statements
- Hardcoded file paths

## After Task Completion

### Verification
- [ ] Run quick_test.py to verify system still works
- [ ] Test API endpoints if API was modified
- [ ] Check CLI if CLI was modified
- [ ] Verify documentation is accurate

### Communication
- [ ] Update any relevant issue/ticket
- [ ] Document breaking changes
- [ ] Note any follow-up tasks needed
