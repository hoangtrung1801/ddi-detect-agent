# Image Upload Feature - Implementation Summary

## Overview

The drug name extraction API now supports direct image file uploads using Cloudinary for temporary storage. This provides a more user-friendly alternative to requiring pre-hosted image URLs.

## What Was Added

### Two API Endpoints

1. **`/api/drug-name-extract`** - URL/Base64 method (no Cloudinary required)
   - Accepts image URL or base64-encoded image
   - Original functionality preserved

2. **`/api/drug-name-extract/upload`** - File upload method (requires Cloudinary)
   - Accepts direct file upload (multipart/form-data)
   - Automatically handles temporary storage and cleanup
   - **Recommended** for most use cases

### Files Created

1. **`app/core/cloudinary_utils.py`**
   - Cloudinary configuration and upload/delete utilities
   - Automatic cleanup of temporary images
   - File type validation

2. **`CLOUDINARY_SETUP.md`**
   - Complete guide for setting up Cloudinary
   - Usage examples for all methods
   - Troubleshooting tips

3. **`IMAGE_UPLOAD_FEATURE.md`** (this file)
   - Implementation summary

### Files Modified

1. **`requirements.txt`**
   - Added `cloudinary>=1.36.0`
   - Added `python-multipart>=0.0.6`

2. **`app/core/config.py`**
   - Added Cloudinary environment variables
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

3. **`app/api/routes/queries.py`**
   - Added `/drug-name-extract/upload` endpoint
   - Integrated Cloudinary utilities
   - Automatic cleanup after processing

4. **`test_drug_name_extract_api.py`**
   - Added test function for file upload endpoint

5. **`DRUG_NAME_EXTRACT_API.md`**
   - Updated with upload endpoint documentation
   - Added usage examples for both methods

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- `cloudinary>=1.36.0` - Cloudinary SDK
- `python-multipart>=0.0.6` - FastAPI file upload support

### 2. Configure Cloudinary (Required for Upload Endpoint)

**Option A: Create `.env` file**

```bash
# Create .env file in project root
cat > .env << EOF
OPENAI_API_KEY=your_openai_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EOF
```

**Option B: Export environment variables**

```bash
export CLOUDINARY_CLOUD_NAME=your_cloud_name
export CLOUDINARY_API_KEY=your_api_key
export CLOUDINARY_API_SECRET=your_api_secret
```

**Get Cloudinary credentials:**
1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier available)
2. Find credentials on your dashboard
3. See [CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md) for detailed instructions

### 3. Start the Server

```bash
uvicorn app.main:app --reload
```

### 4. Test the API

```bash
python test_drug_name_extract_api.py
```

Or visit the interactive docs: `http://localhost:8000/docs`

## How It Works

### File Upload Flow

1. **Client uploads image** → `POST /api/drug-name-extract/upload`
2. **Server validates** file type (JPEG, PNG, GIF, WebP)
3. **Upload to Cloudinary** → Get temporary URL
4. **Process image** → Vision model extracts drug names
5. **Return results** → JSON with reasoning and ingredients
6. **Cleanup** → Delete image from Cloudinary

### Advantages of Upload Method

✅ **No pre-hosting required** - Users don't need to host images elsewhere
✅ **Automatic cleanup** - Images are deleted after processing
✅ **File validation** - Server validates file types
✅ **Better UX** - Simpler for end users
✅ **Secure** - Temporary storage, auto-deletion

## Usage Examples

### Python

```python
import requests

# Upload a local image file
with open('drug-package.jpg', 'rb') as f:
    files = {'file': f}
    response = requests.post(
        'http://localhost:8000/api/drug-name-extract/upload',
        files=files
    )

result = response.json()
print(result)
```

### cURL

```bash
curl -X POST "http://localhost:8000/api/drug-name-extract/upload" \
  -F "file=@drug-package.jpg"
```

### JavaScript

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/drug-name-extract/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
```

## Testing

### Test with Sample Image

```bash
# Make sure you have a test image
# Download or create drug-image.jpg

python test_drug_name_extract_api.py
```

### Interactive Testing

Visit `http://localhost:8000/docs` and try the `/api/drug-name-extract/upload` endpoint:
1. Click "Try it out"
2. Upload an image file
3. Click "Execute"
4. View the results

## Cloudinary Free Tier

Perfect for development and small production:
- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month
- **Auto-deletion**: Keeps storage minimal

## Without Cloudinary

If you don't want to use Cloudinary, you can still use:
- `/api/drug-name-extract` with public image URLs
- `/api/drug-name-extract` with base64-encoded images

## Error Handling

### Common Errors

**"Cloudinary is not configured"**
- Solution: Set environment variables (see Setup Instructions)

**"Invalid file type"**
- Solution: Only upload image files (JPEG, PNG, GIF, WebP)

**"Cloudinary upload failed"**
- Check credentials are correct
- Verify account is active
- Check free tier limits

## Security Notes

1. **Never commit** `.env` files with real credentials
2. **Use environment variables** in production
3. **Rotate credentials** periodically
4. **Monitor usage** in Cloudinary dashboard

## Integration with Frontend

Example React component:

```typescript
import React, { useState } from 'react';

function DrugImageUpload() {
  const [result, setResult] = useState(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/drug-name-extract/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    setResult(JSON.parse(data.result));
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleUpload} />
      {result && (
        <div>
          <h3>Active Ingredients:</h3>
          <ul>
            {result.active_ingredients.map((ing, i) => (
              <li key={i}>{ing.name} - {ing.strength}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Next Steps

1. ✅ Install dependencies: `pip install -r requirements.txt`
2. ✅ Configure Cloudinary (see [CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md))
3. ✅ Start server: `uvicorn app.main:app --reload`
4. ✅ Test upload endpoint: `http://localhost:8000/docs`
5. ✅ Integrate with your frontend

## Support

- **API Documentation**: [DRUG_NAME_EXTRACT_API.md](DRUG_NAME_EXTRACT_API.md)
- **Cloudinary Setup**: [CLOUDINARY_SETUP.md](CLOUDINARY_SETUP.md)
- **FastAPI Docs**: `http://localhost:8000/docs`
- **Cloudinary Docs**: [cloudinary.com/documentation](https://cloudinary.com/documentation)

## Summary

The image upload feature provides a seamless way for users to extract drug information from photos without needing to pre-host images. Cloudinary handles temporary storage and automatic cleanup, making the API production-ready while maintaining security and efficiency.
