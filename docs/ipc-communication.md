# IPC Communication Documentation

## Overview

The Qluely app uses Inter-Process Communication (IPC) to enable secure communication between the Electron main process and the React renderer process. This follows Electron's security best practices with context isolation enabled.

## Architecture

### Communication Flow

```
React Component → Preload Script → Main Process → Response → Preload Script → React Component
```

### Security Layer

- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer
- **Context Bridge**: Secure API exposure

## IPC Channels

### 1. AI Chat System

#### Channel: `ai:start`

**Purpose:** Initiate AI chat streaming
**Direction:** Renderer → Main
**Implementation:**

```typescript
// Preload
start: (prompt: string) => ipcRenderer.send("ai:start", prompt);

// Main Process
ipcMain.on("ai:start", async (event, prompt) => {
  // Stream handling logic
});
```

#### Channel: `ai:chunk`

**Purpose:** Stream AI response chunks
**Direction:** Main → Renderer
**Implementation:**

```typescript
// Main Process
event.sender.send("ai:chunk", chunk);

// Preload
onChunk: (cb: (chunk: string) => void) =>
  ipcRenderer.on("ai:chunk", (_, chunk) => cb(chunk));
```

#### Channel: `ai:end`

**Purpose:** Signal streaming completion
**Direction:** Main → Renderer
**Implementation:**

```typescript
// Main Process
event.sender.send("ai:end");

// Preload
onEnd: (cb: () => void) => ipcRenderer.on("ai:end", () => cb());
```

#### Channel: `ai:error`

**Purpose:** Handle streaming errors
**Direction:** Main → Renderer
**Implementation:**

```typescript
// Main Process
event.sender.send("ai:error", String(error));

// Preload
onError: (cb: (message: string) => void) => {
  const handler = (_: unknown, message: string) => cb(message);
  ipcRenderer.on("ai:error", handler);
  return () => ipcRenderer.removeListener("ai:error", handler);
};
```

### 2. Navigation System

#### Channel: `nav:to`

**Purpose:** Navigate to specific route
**Direction:** Renderer → Main
**Implementation:**

```typescript
// Preload
to: (route: string) => ipcRenderer.invoke("nav:to", route);

// Main Process
ipcMain.handle("nav:to", (_, route: string) => {
  mainWindow.webContents.send("nav:change", route);
});
```

#### Channel: `nav:change`

**Purpose:** Notify route change
**Direction:** Main → Renderer
**Implementation:**

```typescript
// Main Process
mainWindow.webContents.send("nav:change", route);

// Preload
onChange: (cb: (route: string) => void) =>
  ipcRenderer.on("nav:change", (_, r) => cb(r));
```

### 3. Audio Recording

#### Channel: `record:start`

**Purpose:** Start audio recording
**Direction:** Renderer → Main
**Implementation:**

```typescript
// Preload
start: () => ipcRenderer.send("record:start");

// Main Process
ipcMain.on("record:start", () => {
  // FFmpeg recording logic
});
```

#### Channel: `record:stop`

**Purpose:** Stop audio recording
**Direction:** Renderer → Main
**Implementation:**

```typescript
// Preload
stop: () => ipcRenderer.send("record:stop");

// Main Process
ipcMain.on("record:stop", () => {
  ffmpeg?.kill("SIGINT");
});
```

#### Channel: `record:transcript`

**Purpose:** Receive transcription results
**Direction:** Main → Renderer
**Implementation:**

```typescript
// Main Process
event.sender.send("record:transcript", text);

// Preload
onTranscript: (cb: (text: string) => void): (() => void) => {
  const handler = (_: IpcRendererEvent, text: string) => cb(text);
  ipcRenderer.on("record:transcript", handler);
  return () => ipcRenderer.removeListener("record:transcript", handler);
};
```

### 4. Screen Capture

#### Channel: `capture:screen`

**Purpose:** Capture screen screenshot
**Direction:** Renderer → Main
**Implementation:**

```typescript
// Preload
capture: () => ipcRenderer.invoke("capture:screen");

// Main Process
ipcMain.handle("capture:screen", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width, height },
  });
  return screenSource.thumbnail.toDataURL();
});
```

### 5. Audio Streaming

#### Channel: `audio:chunk`

**Purpose:** Send audio data chunks
**Direction:** Renderer → Main
**Implementation:**

```typescript
// Preload
sendChunk: (blob: Blob) => ipcRenderer.send("audio:chunk", blob);

// Main Process (if implemented)
ipcMain.on("audio:chunk", (event, blob) => {
  // Handle audio chunk
});
```

## Context Bridge Setup

### Preload Script Structure

```typescript
// src/electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

// AI Chat API
contextBridge.exposeInMainWorld("qluely", {
  echo: (msg: string) => ipcRenderer.invoke("qluely:echo", msg),
  start: (prompt: string) => ipcRenderer.send("ai:start", prompt),
  onChunk: (cb: (chunk: string) => void) =>
    ipcRenderer.on("ai:chunk", (_, chunk) => cb(chunk)),
  onEnd: (cb: () => void) => ipcRenderer.on("ai:end", () => cb()),
  onError: (cb: (message: string) => void) => {
    const handler = (_: unknown, message: string) => cb(message);
    ipcRenderer.on("ai:error", handler);
    return () => ipcRenderer.removeListener("ai:error", handler);
  },
});

// Navigation API
contextBridge.exposeInMainWorld("nav", {
  to: (route: string) => ipcRenderer.invoke("nav:to", route),
  onChange: (cb: (route: string) => void) =>
    ipcRenderer.on("nav:change", (_, r) => cb(r)),
});

// Audio Recording API
contextBridge.exposeInMainWorld("recorder", {
  start: () => ipcRenderer.send("record:start"),
  stop: () => ipcRenderer.send("record:stop"),
  onTranscript: (cb: (text: string) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, text: string) => cb(text);
    ipcRenderer.on("record:transcript", handler);
    return () => ipcRenderer.removeListener("record:transcript", handler);
  },
});

// Screen Capture API
contextBridge.exposeInMainWorld("screenAPI", {
  capture: () => ipcRenderer.invoke("capture:screen"),
});
```

## TypeScript Definitions

### Global Window Interface

```typescript
// src/ui/global.d.ts
declare global {
  interface Window {
    qluely: {
      echo: (msg: string) => Promise<string>;
      start: (prompt: string) => void;
      onChunk: (cb: (chunk: string) => void) => void;
      onEnd: (cb: () => void) => void;
      onError: (cb: (message: string) => void) => () => void;
    };
    nav: {
      to: (route: string) => Promise<void>;
      onChange: (cb: (route: string) => void) => void;
    };
    recorder: {
      start: () => void;
      stop: () => void;
      onTranscript(cb: (text: string) => void): () => void;
    };
    screenAPI: {
      capture: () => Promise<string>;
    };
    audio: {
      captureMeeting: () => Promise<MediaStream>;
      sendChunk: (blob: Blob) => void;
      stop: () => void;
    };
  }
}
```

## Usage Patterns

### React Component Integration

#### AI Chat Usage

```tsx
useEffect(() => {
  window.qluely.onChunk((chunk: string) => {
    setCurrentChunk(chunk);
  });

  window.qluely.onEnd(() => {
    setIsLoading(false);
  });

  const cleanup = window.qluely.onError((error) => {
    setError(error);
  });

  return cleanup; // Important: cleanup listeners
}, []);

const sendMessage = () => {
  window.qluely.start(prompt);
};
```

#### Navigation Usage

```tsx
const navigate = () => {
  window.nav.to("/settings");
};

useEffect(() => {
  window.nav.onChange((route) => {
    // React Router navigation
    navigate(route);
  });
}, []);
```

### Memory Management

#### Cleanup Event Listeners

```typescript
useEffect(() => {
  const cleanup = window.qluely.onError((error) => {
    console.error(error);
  });

  // Always cleanup on unmount
  return cleanup;
}, []);
```

## Security Considerations

### Context Isolation Benefits

- Prevents renderer access to Node.js APIs
- Protects main process from malicious scripts
- Enables secure API exposure through context bridge

### Best Practices

1. **Validate all inputs** in main process handlers
2. **Sanitize data** before sending to renderer
3. **Use invoke/handle** for request-response patterns
4. **Use send/on** for one-way communication
5. **Always cleanup** event listeners in React components

### Security Checklist

- [ ] Context isolation enabled
- [ ] Node integration disabled
- [ ] All IPC channels validated
- [ ] No eval() or unsafe code execution
- [ ] Event listeners properly cleaned up

## Debugging IPC

### Enable IPC Debugging

```bash
# Set environment variable
DEBUG=electron:ipc npm run dev
```

### Test IPC in DevTools

```javascript
// Test AI chat
window.qluely.start("test message");

// Test navigation
window.nav.to("/settings");

// Test screen capture
window.screenAPI.capture().then(console.log);
```

### Common Issues

#### "window.nav is undefined"

- Preload script not loaded
- Context bridge setup incorrect
- Main window webPreferences missing preload path

#### IPC Handler Not Found

- Handler not registered in main process
- Typo in channel name
- Handler registered after window creation

#### Memory Leaks

- Event listeners not cleaned up
- Multiple listeners registered
- React components not unmounting properly

## Performance Optimization

### Efficient Data Transfer

```typescript
// Instead of sending large objects
ipcRenderer.send("data", largeObject);

// Send only necessary data
ipcRenderer.send("data", { id: largeObject.id, type: largeObject.type });
```

### Throttle Frequent Updates

```typescript
// Throttle streaming chunks
const throttledUpdate = useCallback(
  throttle((chunk: string) => updateUI(chunk), 100),
  []
);
```

### Batch Operations

```typescript
// Instead of multiple calls
window.qluely.start(prompt1);
window.qluely.start(prompt2);

// Batch if possible
window.qluely.startBatch([prompt1, prompt2]);
```
