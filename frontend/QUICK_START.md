# Quick Start Guide

Get the Drug Interaction Checker frontend up and running in minutes!

## Prerequisites

- Node.js 18+ or pnpm installed
- Backend API running (see parent directory setup)

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Start Development Server

```bash
pnpm dev
```

The app will open at `http://localhost:5173`

## 3. Ensure Backend is Running

In a separate terminal, from the parent directory:

```bash
# Make sure you have .env configured with OPENAI_API_KEY
cd ..
python app/main.py
```

Backend should be running at `http://localhost:8000`

## 4. Test the Application

1. Open `http://localhost:5173` in your browser
2. Upload an image of medication labels (or use a sample image)
3. Wait for OCR processing to detect drug names
4. Review and remove any incorrect detections
5. Click "Check Interactions" to see results

## Sample Test

You can test with a simple text image containing drug names like:
- Warfarin
- Aspirin
- Metformin

Or use your phone to take a photo of actual medication labels.

## Common Issues

### Port Already in Use

If port 5173 is busy:
```bash
pnpm dev -- --port 3000
```

### Backend Connection Failed

Ensure the backend is running on `http://localhost:8000`:
```bash
curl http://localhost:8000/health
```

### OCR Not Working

Check browser console for errors. OCR runs in the browser using WebAssembly.

## Production Build

```bash
# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Environment Setup

No environment variables required! The frontend proxies to the backend automatically.

To change the backend URL, edit `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000', // Change this if needed
      ...
    }
  }
}
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Customize the UI components in `src/components/`
- Modify the OCR drug detection logic in `src/lib/ocr.ts`
- Add more UI components from shadcn/ui

## Tech Stack

- ⚡ Vite - Lightning fast build tool
- ⚛️ React 18 - UI framework
- 🎨 Tailwind CSS - Utility-first styling
- 🧩 shadcn/ui - Beautiful components
- 🔍 Tesseract.js - OCR in the browser
- 📊 TanStack Query - Data fetching
- 📤 React Dropzone - File uploads

Enjoy building! 🚀
