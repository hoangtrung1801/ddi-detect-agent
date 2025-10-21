# Drug Interaction Checker - Frontend

A modern React web application for detecting drug interactions from medication label images using OCR and AI.

## Features

- 📸 **Image Upload**: Drag-and-drop or click to upload medication label images
- 🔍 **OCR Processing**: Automatically extract drug names from images using Tesseract.js
- 💊 **Drug Detection**: Smart extraction of drug names from OCR text
- ⚠️ **Interaction Analysis**: Check for drug interactions using AI-powered backend
- 🎨 **Modern UI**: Beautiful, responsive interface built with Tailwind CSS and shadcn/ui
- ⚡ **Real-time Feedback**: Progress indicators and loading states

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: TanStack Query (React Query)
- **OCR**: Tesseract.js
- **HTTP Client**: Axios
- **File Upload**: React Dropzone

## Prerequisites

- Node.js 18+ or pnpm
- Backend API running on `http://localhost:8000` (see parent directory)

## Installation

```bash
# Install dependencies
pnpm install

# or with npm
npm install
```

## Development

```bash
# Start development server
pnpm dev

# or with npm
npm run dev
```

The app will be available at `http://localhost:5173`

## Building for Production

```bash
# Build the app
pnpm build

# Preview the production build
pnpm preview
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── ImageUpload.tsx # Image upload with drag-and-drop
│   ├── DrugList.tsx    # Detected drugs list
│   └── InteractionResults.tsx # Results display
├── lib/                # Utilities and services
│   ├── api.ts         # API client
│   ├── ocr.ts         # OCR processing with Tesseract.js
│   └── utils.ts       # Utility functions
├── App.tsx            # Main application component
├── main.tsx           # Application entry point
└── index.css          # Global styles
```

## How It Works

1. **Upload Image**: User uploads a photo of medication labels
2. **OCR Processing**: Tesseract.js extracts text from the image
3. **Drug Detection**: Smart algorithm identifies drug names from the text
4. **Review & Edit**: User can remove incorrectly detected drugs
5. **Check Interactions**: Query the backend AI agent for drug interactions
6. **View Results**: Display interaction warnings with severity indicators

## API Integration

The frontend communicates with the backend FastAPI server through a proxy configured in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

### API Endpoints Used

- `POST /api/query` - Query for drug interactions
- `GET /api/stats` - Get database statistics
- `GET /api/health` - Health check

## Environment Variables

No environment variables are required for the frontend. The backend URL is proxied through Vite.

## Customization

### Adding New UI Components

Use shadcn/ui CLI to add components:

```bash
npx shadcn@latest add [component-name]
```

### Styling

- Modify `tailwind.config.js` for theme customization
- Update CSS variables in `src/index.css` for color schemes
- Components use `cn()` utility for conditional classes

## OCR Accuracy

The OCR accuracy depends on:
- Image quality (higher resolution is better)
- Text clarity and contrast
- Proper lighting in the photo
- Drug name formatting (capitalized names work best)

**Tips for better results:**
- Take photos in good lighting
- Ensure text is clear and focused
- Avoid glare or shadows
- Crop to show only the medication label

## Known Limitations

- OCR may not detect all drug names correctly
- User should review detected drugs before checking interactions
- Requires backend server to be running
- Large images may take longer to process

## Troubleshooting

### OCR not working
- Check browser console for errors
- Ensure image format is supported (PNG, JPG, JPEG, GIF, BMP)
- Try a clearer, higher quality image

### API errors
- Ensure backend server is running on `http://localhost:8000`
- Check backend logs for errors
- Verify CORS is properly configured

### Build errors
- Clear `node_modules` and reinstall: `pnpm install --force`
- Check Node.js version (18+ required)
- Update dependencies: `pnpm update`

## Contributing

When adding new features:
1. Follow the existing code structure
2. Use TypeScript for type safety
3. Add proper error handling
4. Test with various image types
5. Update this README

## License

MIT License - see parent directory for details
