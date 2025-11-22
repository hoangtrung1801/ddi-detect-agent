# LLM-Based Drug Name Conversion Workflow

## Complete System Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INPUT                                   │
│                                                                       │
│  "Check interactions between Tylenol, Coumadin, and Advil"          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LANGGRAPH AGENT                                 │
│                   (app/agents/graph.py)                              │
│                                                                       │
│  Receives user query and decides which tools to use                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  OPTIONAL: Explicit Mapping                          │
│              Tool: map_drug_name_tool (x3)                           │
│                                                                       │
│  Drug 1: "Tylenol"    → map_drug_name_tool                          │
│  Drug 2: "Coumadin"   → map_drug_name_tool                          │
│  Drug 3: "Advil"      → map_drug_name_tool                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│               REQUIRED: Check All Unique Pairs                       │
│           Tool: search_drug_interaction (x3)                         │
│                                                                       │
│  Pair 1: "Tylenol and Coumadin"   → search_drug_interaction         │
│  Pair 2: "Tylenol and Advil"      → search_drug_interaction         │
│  Pair 3: "Coumadin and Advil"     → search_drug_interaction         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
```

## Tool Execution: search_drug_interaction

```
┌─────────────────────────────────────────────────────────────────────┐
│               INPUT: "Tylenol and Coumadin"                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PARSE DRUG NAMES                                  │
│                                                                       │
│  Input: "Tylenol and Coumadin"                                      │
│  Parse: drug1 = "Tylenol", drug2 = "Coumadin"                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   CONVERT DRUG 1          │   │   CONVERT DRUG 2          │
│   _map_drug_name()        │   │   _map_drug_name()        │
└───────────┬───────────────┘   └───────────┬───────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│  STEP 1: LLM EXTRACTION   │   │  STEP 1: LLM EXTRACTION   │
│                           │   │                           │
│  Input: "Tylenol"         │   │  Input: "Coumadin"        │
│  ↓                        │   │  ↓                        │
│  LLM Call with prompt:    │   │  LLM Call with prompt:    │
│  "Extract active          │   │  "Extract active          │
│   ingredient from         │   │   ingredient from         │
│   Tylenol"                │   │   Coumadin"               │
│  ↓                        │   │  ↓                        │
│  Response:                │   │  Response:                │
│  - ingredient:            │   │  - ingredient:            │
│    "Acetaminophen"        │   │    "Warfarin"             │
│  - reasoning:             │   │  - reasoning:             │
│    "Tylenol is brand      │   │    "Coumadin is brand     │
│     name for              │   │     name for              │
│     Acetaminophen"        │   │     Warfarin"             │
│  - confidence: "high"     │   │  - confidence: "high"     │
└───────────┬───────────────┘   └───────────┬───────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│  STEP 2: DATABASE MAP     │   │  STEP 2: DATABASE MAP     │
│                           │   │                           │
│  Input: "Acetaminophen"   │   │  Input: "Warfarin"        │
│  ↓                        │   │  ↓                        │
│  Embedding-based          │   │  Embedding-based          │
│  similarity search in     │   │  similarity search in     │
│  drug database            │   │  drug database            │
│  ↓                        │   │  ↓                        │
│  Find closest match:      │   │  Find closest match:      │
│  "acetaminophen"          │   │  "warfarin"               │
│  (score: 1.0)             │   │  (score: 1.0)             │
└───────────┬───────────────┘   └───────────┬───────────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SEARCH INTERACTION DATABASE                             │
│                                                                       │
│  Query: interaction between "acetaminophen" AND "warfarin"          │
│  ↓                                                                   │
│  Database Result:                                                    │
│  "Acetaminophen may increase anticoagulant effect of Warfarin..."   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BUILD RESPONSE                                    │
│                                                                       │
│  Drug Conversions:                                                   │
│  • Converted 'Tylenol' → 'acetaminophen'                            │
│  • Converted 'Coumadin' → 'warfarin'                                │
│                                                                       │
│  Interaction between Acetaminophen and Warfarin:                     │
│  Acetaminophen may increase anticoagulant effect of Warfarin...      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RETURN TO AGENT                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Tool Execution: map_drug_name_tool

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INPUT: "Tylenol"                                  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  STEP 1: LLM EXTRACTION                              │
│              _extract_active_ingredient()                            │
│                                                                       │
│  System Prompt:                                                      │
│  "You are a pharmaceutical expert. Given a drug name,                │
│   identify the primary active ingredient..."                         │
│                                                                       │
│  User Message:                                                       │
│  "Drug name: Tylenol"                                               │
│                                                                       │
│  ↓                                                                   │
│  LLM Response (Structured Output):                                   │
│  {                                                                   │
│    "reasoning": "Tylenol is a brand name for Acetaminophen",        │
│    "active_ingredient": "Acetaminophen",                            │
│    "confidence": "high"                                             │
│  }                                                                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  STEP 2: DATABASE MAPPING                            │
│                    map_drug_name()                                   │
│                                                                       │
│  Input: "Acetaminophen"                                             │
│  ↓                                                                   │
│  Generate embedding for "Acetaminophen"                             │
│  ↓                                                                   │
│  Compare with all drug embeddings in database                        │
│  ↓                                                                   │
│  Find top match:                                                     │
│  - Name: "acetaminophen"                                            │
│  - Similarity: 1.0 (exact match)                                    │
│  - Threshold: 0.5 (passed)                                          │
│  ↓                                                                   │
│  Return: "acetaminophen"                                            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BUILD RESPONSE                                    │
│                                                                       │
│  ✓ LLM Conversion: 'Tylenol' → 'Acetaminophen'                     │
│    Reasoning: Tylenol is a brand name for Acetaminophen             │
│  ✓ Database Mapping: 'Acetaminophen' → 'acetaminophen'             │
│                                                                       │
│  ✓ Final Name: 'acetaminophen'                                      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RETURN TO AGENT                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Final Agent Response Assembly

```
┌─────────────────────────────────────────────────────────────────────┐
│                  AGENT COLLECTS ALL RESULTS                          │
│                                                                       │
│  Results from:                                                       │
│  - map_drug_name_tool (x3) [Optional]                               │
│  - search_drug_interaction (x3) [Required]                          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   AGENT ANALYZES & REASONS                           │
│                                                                       │
│  - Reviews all interaction details                                   │
│  - Evaluates severity levels                                         │
│  - Identifies most critical interactions                             │
│  - Formulates clinical recommendations                               │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              AGENT FORMATS FINAL RESPONSE                            │
│                                                                       │
│  ### Drug Name Conversions                                           │
│  - Tylenol → Acetaminophen                                          │
│  - Coumadin → Warfarin                                              │
│  - Advil → Ibuprofen                                                │
│                                                                       │
│  ### Interactions Between Drug Pairs                                 │
│                                                                       │
│  #### Acetaminophen + Warfarin                                      │
│  **Interaction Details:** Moderate risk...                          │
│                                                                       │
│  #### Acetaminophen + Ibuprofen                                     │
│  **Interaction Details:** No significant interaction...              │
│                                                                       │
│  #### Warfarin + Ibuprofen                                          │
│  **Interaction Details:** Major risk of bleeding...                 │
│                                                                       │
│  ---                                                                 │
│                                                                       │
│  ### Final Summary                                                   │
│  **Overall Risk:** High (due to Warfarin + Ibuprofen)              │
│  **Key Interactions:** ...                                          │
│  **Clinical Recommendations:** ...                                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RETURN TO USER                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                        APPLICATION LAYER                             │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │         LangGraph Agent (graph.py)                          │   │
│  │  - Orchestrates workflow                                     │   │
│  │  - Manages conversation state                                │   │
│  │  - Decides which tools to call                               │   │
│  │  - Formats final response                                    │   │
│  └────────────────────┬────────────────────────────────────────┘   │
│                       │                                              │
└───────────────────────┼──────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                          TOOL LAYER                                  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │   EnhancedDrugInteractionTools (enhanced_tools.py)          │   │
│  │                                                              │   │
│  │  Tools:                                                      │   │
│  │  ├── search_drug_interaction()                              │   │
│  │  │    └── Automatic LLM conversion + DB search              │   │
│  │  └── map_drug_name_tool()                                   │   │
│  │       └── Explicit conversion with details                  │   │
│  │                                                              │   │
│  │  Internal Methods:                                           │   │
│  │  ├── _extract_active_ingredient()                           │   │
│  │  │    └── LLM-based extraction                              │   │
│  │  └── _map_drug_name()                                       │   │
│  │       └── Two-step conversion                               │   │
│  └────────────────────┬────────────────────────────────────────┘   │
│                       │                                              │
└───────────────────────┼──────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│   LLM SERVICE    │          │  DATABASE LAYER  │
│  (OpenAI API)    │          │                  │
│                  │          │  ┌────────────┐  │
│  - gpt-4o-mini   │          │  │ DrugMapper │  │
│  - Structured    │          │  │ (drug_     │  │
│    Output        │          │  │  mapper.py)│  │
│  - Pharmaceutical│          │  └────┬───────┘  │
│    Expert        │          │       │          │
│  - Ingredient    │          │       ▼          │
│    Extraction    │          │  ┌────────────┐  │
└──────────────────┘          │  │ Drug       │  │
                              │  │ Interaction│  │
                              │  │ Graph      │  │
                              │  │ (TWOSIDES) │  │
                              │  └────────────┘  │
                              │                  │
                              │  - Embeddings    │
                              │  - Similarity    │
                              │  - Interactions  │
                              └──────────────────┘
```

## Data Flow Example

### Input: "Tylenol"

```
"Tylenol"
    │
    ├─→ LLM Extraction
    │   ├─ System: "You are pharmaceutical expert..."
    │   ├─ Input: "Drug name: Tylenol"
    │   └─ Output: {
    │       "reasoning": "Tylenol is brand name for Acetaminophen",
    │       "active_ingredient": "Acetaminophen",
    │       "confidence": "high"
    │      }
    │
    └─→ "Acetaminophen"
        │
        ├─→ Database Mapping
        │   ├─ Generate embedding
        │   ├─ Compare with database
        │   └─ Find match: "acetaminophen" (score: 1.0)
        │
        └─→ "acetaminophen" (FINAL)
```

## Key Features

### 1. Automatic Conversion
- No user action required
- Happens within tools
- Transparent to user

### 2. Two-Stage Process
- Stage 1: LLM intelligence
- Stage 2: Database matching
- Combined accuracy

### 3. Detailed Feedback
- Shows conversion steps
- Provides reasoning
- Builds user trust

### 4. Error Resilience
- LLM fallback
- Database threshold
- Graceful degradation

### 5. Configurable
- Enable/disable mapping
- Choose LLM model
- Adjust thresholds
