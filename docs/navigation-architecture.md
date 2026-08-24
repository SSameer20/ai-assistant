# Navigation System Architecture

## Overview

The Qluely app implements a hybrid navigation system that bridges Electron's main process with React Router DOM in the renderer process. This allows for programmatic navigation from both the Electron backend and React frontend.

## Architecture Components

### 1. React Router Setup

#### Main Entry Point (`src/ui/main.tsx`)

```tsx
import { BrowserRouter } from "react-router-dom";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

#### App Component (`src/ui/App.tsx`)

```tsx
import { Routes, Route, useNavigate } from "react-router-dom";

export default function App() {
  const navigate = useNavigate();

  useEffect(() => {
    window.nav.onChange((route) => navigate(route));
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  );
}
```

### 2. IPC Communication Layer

#### Main Process Handler (`src/electron/main.ts`)

```typescript
// Navigation handler
ipcMain.handle("nav:to", (_, route: string) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("nav:change", route);
});
```

#### Preload Script (`src/electron/preload.ts`)

```typescript
contextBridge.exposeInMainWorld("nav", {
  to: (route: string) => ipcRenderer.invoke("nav:to", route),
  onChange: (cb: (route: string) => void) =>
    ipcRenderer.on("nav:change", (_, r) => cb(r)),
});
```

#### TypeScript Definitions (`src/ui/global.d.ts`)

```typescript
declare global {
  interface Window {
    nav: {
      to: (route: string) => Promise<void>;
      onChange: (cb: (route: string) => void) => void;
    };
  }
}
```

## Navigation Flow

### From React Component to Route

1. User clicks navigation button (e.g., Settings)
2. Component calls `window.nav.to("/settings")`
3. Preload script sends IPC message to main process
4. Main process sends navigation change to renderer
5. React Router's `useNavigate` hook updates the route

### Navigation Components

#### Navigation Component (`src/ui/components/Navigation.tsx`)

```tsx
export default function Navigation() {
  const handleSettingsClick = () => {
    window.nav.to("/settings");
  };

  return (
    <div className="navigation-bar">
      {/* Other elements */}
      <button onClick={handleSettingsClick}>
        <Settings size={18} />
      </button>
    </div>
  );
}
```

## Routes Configuration

### Current Routes

- `/` - Home component (main chat interface)
- `/settings` - Settings component (configuration)

### Route Components

#### Home Route (`/`)

- Main chat interface
- AI streaming functionality
- Audio recording controls
- Screen capture features

#### Settings Route (`/settings`)

- Currently minimal implementation
- Placeholder for configuration options

## Navigation Security

### Context Isolation

- Uses `contextBridge` for secure IPC communication
- No direct access to Node.js APIs from renderer
- All navigation calls are validated in main process

### Route Validation

- Main process checks if window exists before navigation
- Routes are predefined in React Router configuration
- Invalid routes fall back to default handling

## Usage Examples

### Navigate from React Component

```tsx
const handleNavigate = () => {
  window.nav.to("/settings");
};
```

### Navigate from Main Process

```typescript
// In main.ts - navigate programmatically
mainWindow?.webContents.send("nav:change", "/settings");
```

### Listen for Navigation Changes

```tsx
useEffect(() => {
  window.nav.onChange((route) => {
    console.log("Navigating to:", route);
    navigate(route);
  });
}, [navigate]);
```

## Potential Issues

### BrowserRouter in Electron

- File protocol (`file://`) can cause routing issues
- React Router expects standard web environment
- Hash-based routing might be more reliable for Electron

### Suggested Improvements

1. **Switch to HashRouter**

   ```tsx
   import { HashRouter } from "react-router-dom";

   <HashRouter>
     <App />
   </HashRouter>;
   ```

2. **Add Route Guards**

   ```tsx
   const ProtectedRoute = ({ children }) => {
     // Add authentication or validation logic
     return children;
   };
   ```

3. **Navigation History Management**
   ```typescript
   // Track navigation history in main process
   let navigationHistory: string[] = [];
   ```

## Testing Navigation

### Manual Testing

1. Start app with `npm run dev`
2. Click Settings button in navigation bar
3. Verify route changes to `/settings`
4. Test keyboard shortcuts for app visibility

### Debug Navigation Issues

1. Check browser console for React Router errors
2. Verify preload script is loaded correctly
3. Test IPC communication with dev tools
4. Ensure all TypeScript definitions are correct
