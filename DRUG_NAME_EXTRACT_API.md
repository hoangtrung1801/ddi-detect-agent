# Drug Name Extraction API

## Overview

The Drug Name Extraction API provides two endpoints to extract active ingredients and drug names from images of drug packaging or labels using a vision-capable LLM (GPT-4o-mini).

## Endpoints

### 1. Extract from Image URL or Base64

**POST** `/api/drug-name-extract`

### 2. Upload Image File (Recommended)

**POST** `/api/drug-name-extract/upload`

## Request Formats

### Endpoint 1: Image URL or Base64

**POST** `/api/drug-name-extract`

**Request Body:**

```json
{
  "image_url": "string"
}
```

**Parameters:**
- `image_url` (required): Either a URL to an image or a base64-encoded image

**Examples:**

**Using Image URL:**
```json
{
  "image_url": "https://example.com/drug-package.jpg"
}
```

**Using Base64-encoded Image:**
```json
{
  "image_url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

### Endpoint 2: File Upload (Recommended)

**POST** `/api/drug-name-extract/upload`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `file` (required): Image file (JPEG, PNG, GIF, WebP)

**Requirements:**
- Cloudinary must be configured (see [CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md))

**Note:** The uploaded image is temporarily stored on Cloudinary and automatically deleted after processing.

## Response Format

### Success Response (200 OK)

```json
{
  "result": "{\"reasoning_steps\": [...], \"active_ingredients\": [...]}",
  "timestamp": "2025-10-23T12:34:56.789Z"
}
```

**Fields:**
- `result`: JSON string containing:
  - `reasoning_steps`: Array of strings explaining how ingredients were identified
  - `active_ingredients`: Array of objects with:
    - `name`: Ingredient name
    - `strength`: Dosage/strength (e.g., "500 mg")
- `timestamp`: ISO timestamp of the response

### Example Response

```json
{
  "result": "{\"reasoning_steps\": [\"Located the section labeled 'Active Ingredient' with 'Paracetamol 500mg.'\", \"Other substances are listed separately as non-active excipients.\", \"Dosage '500mg' is explicitly associated with Paracetamol.\"], \"active_ingredients\": [{\"name\": \"Paracetamol\", \"strength\": \"500 mg\"}]}",
  "timestamp": "2025-10-23T12:34:56.789Z"
}
```

### Error Response (500)

```json
{
  "detail": "Error processing image: [error message]"
}
```

## How It Works

1. The endpoint receives an image (URL or base64)
2. Initializes a `DrugNameExtractAgent` with GPT-4o-mini
3. The agent analyzes the image to:
   - Identify text regions in the image
   - Locate active ingredient sections
   - Extract ingredient names and strengths
   - Distinguish active from inactive ingredients
   - Provide reasoning for each decision
4. Returns structured JSON with reasoning and extracted ingredients

## Usage Examples

### Python with requests

**Method 1: Upload Image File (Recommended)**

```python
import requests
import json

# Upload image file
with open('drug-package.jpg', 'rb') as f:
    files = {'file': f}
    response = requests.post(
        "http://localhost:8000/api/drug-name-extract/upload",
        files=files
    )

result = response.json()
print(f"Timestamp: {result['timestamp']}")

# Parse the result JSON
extracted_data = json.loads(result['result'])
print(f"Reasoning: {extracted_data['reasoning_steps']}")
print(f"Ingredients: {extracted_data['active_ingredients']}")
```

**Method 2: Using Image URL**

```python
import requests
import json

# Using image URL
response = requests.post(
    "http://localhost:8000/api/drug-name-extract",
    json={"image_url": "https://example.com/drug-package.jpg"}
)

result = response.json()
print(f"Timestamp: {result['timestamp']}")

# Parse the result JSON
extracted_data = json.loads(result['result'])
print(f"Reasoning: {extracted_data['reasoning_steps']}")
print(f"Ingredients: {extracted_data['active_ingredients']}")
```

### cURL

**Method 1: Upload Image File**

```bash
curl -X POST "http://localhost:8000/api/drug-name-extract/upload" \
  -H "accept: application/json" \
  -F "file=@/path/to/drug-package.jpg"
```

**Method 2: Using Image URL**

```bash
curl -X POST "http://localhost:8000/api/drug-name-extract" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://example.com/drug-package.jpg"
  }'
```

### JavaScript/TypeScript

**Method 1: Upload Image File**

```typescript
const fileInput = document.querySelector('input[type="file"]');
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:8000/api/drug-name-extract/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
const extractedData = JSON.parse(data.result);
console.log('Ingredients:', extractedData.active_ingredients);
```

**Method 2: Using Image URL**

```typescript
const response = await fetch('http://localhost:8000/api/drug-name-extract', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    image_url: 'https://example.com/drug-package.jpg'
  })
});

const data = await response.json();
const extractedData = JSON.parse(data.result);
console.log('Ingredients:', extractedData.active_ingredients);
```

## Implementation Details

### Files Modified/Created

1. **`app/agents/drug_name_extract_agent.py`**
   - Updated to accept image input instead of OCR text
   - Uses GPT-4o-mini vision model
   - Method: `extract_drug_names_from_image(image_url: str) -> str`

2. **`app/models/requests.py`**
   - Added `DrugNamesFromImageRequest` model
   - Accepts `image_url` parameter

3. **`app/models/responses.py`**
   - Added `DrugNamesFromImageResponse` model
   - Returns `result` and `timestamp`

4. **`app/api/routes/queries.py`**
   - Implemented `/drug-name-extract` endpoint (URL/base64)
   - Implemented `/drug-name-extract/upload` endpoint (file upload)
   - Integrates with `DrugNameExtractAgent` and Cloudinary

5. **`app/core/config.py`**
   - Added Cloudinary configuration settings
   - Environment variables: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

6. **`app/core/cloudinary_utils.py`** (NEW)
   - Cloudinary upload and deletion utilities
   - Automatic cleanup of temporary images
   - File type validation

7. **`app/models/__init__.py`**
   - Exported new request/response models

8. **`requirements.txt`**
   - Added `cloudinary>=1.36.0`
   - Added `python-multipart>=0.0.6`

### Testing

Run the test script:

```bash
python test_drug_name_extract_api.py
```

Make sure the FastAPI server is running:

```bash
uvicorn app.main:app --reload
```

## Notes

- The agent uses GPT-4o-mini for cost efficiency while maintaining vision capabilities
- Temperature is set to 0.3 for more consistent results
- The agent provides detailed reasoning steps for transparency
- Supports both English and non-English drug labels (with translation)
- Handles unclear or partially obscured text gracefully

## Supported Image Formats

- JPEG/JPG
- PNG
- GIF
- WebP

## Limitations

- Image quality affects extraction accuracy
- Very low-resolution images may return unclear results
- The agent focuses on active ingredients, not all text in the image
