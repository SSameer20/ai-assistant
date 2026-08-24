# Qluely Desktop App Documentation

## Overview

Qluely is an Electron-based desktop application with React frontend that provides AI chat capabilities, screen recording, and screen capture features. The app uses React Router DOM for navigation and implements a sophisticated IPC communication system between the main process and renderer.

## Architecture

### Technology Stack

- **Frontend**: React 19.2.0 with TypeScript
- **Backend**: Electron 39.2.7
- **Routing**: React Router DOM 7.11.0
- **Styling**: Tailwind CSS 4.1.18
- **Build Tool**: Vite 7.2.2
- **AI Integration**: Deepgram SDK for audio processing

### Project Structure

```
src/
├── electron/           # Electron main process files
│   ├── main.ts        # Main Electron process
│   ├── preload.ts     # Preload script for IPC
│   └── whisper.ts     # Audio processing
└── ui/                # React frontend
    ├── main.tsx       # React entry point
    ├── App.tsx        # Main app component with routing
    ├── components/    # React components
    └── helper/        # Utility functions
```

## Features

### 1. AI Chat Interface

- Real-time streaming chat with AI
- Markdown rendering support
- Loading states and error handling
- Keyboard shortcuts (Enter to send)

### 2. Navigation System

- React Router DOM integration
- IPC-based navigation between Electron and React
- Routes: `/` (Home) and `/settings`

### 3. Audio Recording

- System audio capture using FFmpeg
- Platform-specific audio drivers (macOS/Windows)
- Recording controls with start/stop functionality

### 4. Screen Capture

- Desktop screenshot capability
- Base64 image data return
- Integration with Electron's desktopCapturer API

### 5. Global Shortcuts

- `Cmd+/` (macOS) / `Ctrl+/` (Windows): Toggle overlay
- `Cmd+Enter` (macOS) / `Ctrl+Enter` (Windows): Quit app

## Development Setup

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- FFmpeg (for audio recording)

### Installation

```bash
npm install
```

### Development Commands

```bash
npm run dev        # Build and start Electron app
npm run dev:web    # Start Vite dev server only
npm run dev:app    # Start Electron app only
npm run build      # Build both web and app
npm run build:web  # Build React frontend
npm run build:app  # Build Electron main process
```

### Build Process

1. TypeScript compilation for React frontend
2. Vite build for optimized React bundle
3. TypeScript compilation for Electron main process
4. TypeScript compilation for preload script

## Configuration Files

### Package.json

- Main entry point: `dist-app/main.js`
- Type: `module` (ES modules)
- Scripts for development and building

### TypeScript Configuration

- `tsconfig.json`: Main TS config
- `tsconfig.app.json`: React app specific
- `tsconfig.node.json`: Node.js specific
- `src/electron/tsconfig.json`: Main process
- `src/electron/tsconfig.preload.json`: Preload script

### Vite Configuration

- React plugin integration
- Tailwind CSS support
- Build optimization for production

## Known Issues & Solutions

### App Building But Not Opening

This issue typically occurs due to:

1. **Path Resolution Issues**

   - Ensure `dist-react/index.html` exists after build
   - Check that `dist-app/main.js` and `dist-app/preload.js` are generated

2. **IPC Communication Errors**

   - Verify preload script is properly loaded
   - Check that all IPC handlers are registered before app starts

3. **React Router Conflicts**

   - BrowserRouter requires proper base URL configuration
   - File protocol issues with routing in Electron

4. **Build Dependencies**
   - Run `npm run build` before `npm run dev:app`
   - Ensure all TypeScript compilations succeed

## Next Steps

This documentation provides a foundation. Additional files will cover:

- Detailed navigation system architecture
- IPC communication patterns
- Troubleshooting guide
- API documentation
