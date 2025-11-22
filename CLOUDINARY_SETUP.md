# Cloudinary Setup for Image Upload Feature

## Overview

The drug name extraction API now supports direct image uploads using Cloudinary for temporary image storage. This guide will help you set up Cloudinary credentials.

## Prerequisites

- A Cloudinary account (free tier is sufficient)
- Python packages installed: `cloudinary>=1.36.0` and `python-multipart>=0.0.6`

## Step 1: Create a Cloudinary Account

1. Go to [Cloudinary](https://cloudinary.com/) and sign up for a free account
2. After signing up, you'll be redirected to the dashboard

## Step 2: Get Your Credentials

On your Cloudinary dashboard, you'll find:
- **Cloud Name**: Your unique cloud identifier
- **API Key**: Your API key
- **API Secret**: Your API secret (click "Reveal" to see it)

## Step 3: Configure Environment Variables

Create or update your `.env` file in the project root:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini-2024-07-18

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Data Configuration
DATA_FILE=TWOSIDES_preprocessed.csv

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true
```

## Step 4: Install Required Packages

```bash
pip install -r requirements.txt
```

This will install:
- `cloudinary>=1.36.0` - Cloudinary SDK
- `python-multipart>=0.0.6` - For handling file uploads in FastAPI

## Step 5: Test the Setup

Start your FastAPI server:

```bash
uvicorn app.main:app --reload
```

Visit the API docs at `http://localhost:8000/docs` and try the `/api/drug-name-extract/upload` endpoint.

## How It Works

1. **Upload**: Client sends an image file to `/api/drug-name-extract/upload`
2. **Temporary Storage**: Image is uploaded to Cloudinary
3. **Processing**: The vision model processes the Cloudinary URL
4. **Cleanup**: Image is automatically deleted from Cloudinary after processing

## API Endpoints

### 1. Upload Image (Recommended)

**POST** `/api/drug-name-extract/upload`

- Accepts file upload directly
- Uses Cloudinary for temporary storage
- Automatically cleans up after processing

**Example using cURL:**

```bash
curl -X POST "http://localhost:8000/api/drug-name-extract/upload" \
  -H "accept: application/json" \
  -F "file=@/path/to/drug-image.jpg"
```

**Example using Python:**

```python
import requests

with open('drug-image.jpg', 'rb') as f:
    files = {'file': f}
    response = requests.post(
        'http://localhost:8000/api/drug-name-extract/upload',
        files=files
    )
    print(response.json())
```

**Example using JavaScript/TypeScript:**

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:8000/api/drug-name-extract/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

### 2. Image URL (Alternative)

**POST** `/api/drug-name-extract`

- Accepts image URL or base64-encoded image
- No Cloudinary required

**Example:**

```bash
curl -X POST "http://localhost:8000/api/drug-name-extract" \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://example.com/drug-image.jpg"}'
```

## Cloudinary Free Tier Limits

- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month
- **Images**: Unlimited

The free tier is sufficient for most development and small production use cases. Since images are deleted after processing, storage usage stays minimal.

## Security Considerations

1. **Never commit** your `.env` file with actual credentials
2. **Rotate credentials** periodically
3. **Use environment variables** in production (not hardcoded values)
4. **Monitor usage** in the Cloudinary dashboard

## Troubleshooting

### Error: "Cloudinary is not configured"

Make sure all three environment variables are set:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Error: "Invalid file type"

Only image files are accepted (JPEG, PNG, GIF, WebP). Check the file's MIME type.

### Error: "Cloudinary upload failed"

1. Verify your credentials are correct
2. Check your Cloudinary account status
3. Ensure you haven't exceeded free tier limits

## Alternative: Without Cloudinary

If you don't want to use Cloudinary, you can still use the `/api/drug-name-extract` endpoint with:
- Public image URLs
- Base64-encoded images

```python
import requests
import base64

# Convert image to base64
with open('drug-image.jpg', 'rb') as f:
    image_data = base64.b64encode(f.read()).decode('utf-8')
    image_url = f'data:image/jpeg;base64,{image_data}'

response = requests.post(
    'http://localhost:8000/api/drug-name-extract',
    json={'image_url': image_url}
)
print(response.json())
```

## Support

For Cloudinary-specific issues:
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Cloudinary Support](https://support.cloudinary.com/)

For API issues:
- Check the FastAPI docs at `http://localhost:8000/docs`
- Review the API documentation in `DRUG_NAME_EXTRACT_API.md`
