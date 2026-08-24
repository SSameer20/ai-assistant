# IPC (Inter-Process Communication) Implementation Plan

## Project Analysis Summary

**Current State:**

- Electron main process: `src/electron/main.ts`
- React UI: `src/ui/App.tsx`
- **Security Issue:** `nodeIntegration: true, contextIsolation: false` (UNSAFE)
- **No IPC Bridge:** Direct node access in renderer (security risk)
- **Current Features:** Overlay window, global shortcuts, transparency

## Required IPC Bridge Architecture

### 1. Security Hardening (Critical First Step)

#### 1.1 Update webPreferences in main.ts

```typescript
webPreferences: {
  nodeIntegration: false,           // Disable direct node access
  contextIsolation: true,           // Enable context isolation
  enableRemoteModule: false,        // Disable remote module
  preload: path.join(__dirname, 'preload.js'), // Add preload script
}
```

#### 1.2 Create Preload Script

**File:** `src/electron/preload.ts`

- Acts as secure bridge between main and renderer
- Uses `contextBridge.exposeInMainWorld()` to expose APIs
- No direct access to Node.js APIs from renderer

### 2. IPC Channel Design

#### 2.1 Main Process → Renderer (main.ts)

**Channels to implement:**

- `window-state-changed` - Window visibility/focus state
- `api-status-updated` - API connection status
- `shortcuts-updated` - Global shortcut status
- `app-settings-changed` - Application settings
- `ai-response` - AI model responses
- `system-info` - System information

#### 2.2 Renderer → Main Process (App.tsx via preload)

**Channels to implement:**

- `toggle-window` - Show/hide application
- `update-settings` - Change app preferences
- `ai-query` - Send queries to AI models
- `get-api-status` - Check API connection
- `register-shortcuts` - Update global shortcuts
- `quit-app` - Close application

#### 2.3 Bidirectional Channels

**Channels to implement:**

- `file-operations` - Read/write files securely
- `clipboard-operations` - System clipboard access
- `notification-system` - OS notifications

### 3. Implementation Steps

#### Phase 1: Security Foundation

1. **Create preload script** (`src/electron/preload.ts`)
2. **Update main.ts webPreferences** (enable context isolation)
3. **Test basic IPC** (ping/pong between main and renderer)
4. **Remove all direct Node.js calls** from React components

#### Phase 2: Core IPC Channels

1. **Window Management APIs**
   - `electronAPI.toggleWindow()`
   - `electronAPI.onWindowStateChange(callback)`
2. **Application State APIs**

   - `electronAPI.getAppSettings()`
   - `electronAPI.updateSettings(settings)`
   - `electronAPI.onSettingsChange(callback)`

3. **System Integration APIs**
   - `electronAPI.registerGlobalShortcut(shortcut, action)`
   - `electronAPI.showNotification(message)`
   - `electronAPI.accessClipboard()`

#### Phase 3: AI/API Integration

1. **API Communication APIs**

   - `electronAPI.sendAIQuery(prompt)`
   - `electronAPI.onAIResponse(callback)`
   - `electronAPI.getAPIStatus()`
   - `electronAPI.onAPIStatusChange(callback)`

2. **Data Management APIs**
   - `electronAPI.saveUserData(data)`
   - `electronAPI.loadUserData()`
   - `electronAPI.exportHistory()`

#### Phase 4: Advanced Features

1. **File System APIs**

   - `electronAPI.selectFile()`
   - `electronAPI.saveFile(content, filename)`
   - `electronAPI.readFile(filepath)`

2. **External Integration APIs**
   - `electronAPI.openExternal(url)`
   - `electronAPI.getSystemInfo()`
   - `electronAPI.checkForUpdates()`

### 4. Current Components Requiring IPC

#### 4.1 App.tsx Components Needing Bridge

- **Settings Button** → `electronAPI.updateSettings()`
- **AI Query Input** → `electronAPI.sendAIQuery()`
- **Keyboard Shortcuts** → `electronAPI.registerGlobalShortcut()`
- **API Status Display** → `electronAPI.onAPIStatusChange()`
- **Window Controls** → `electronAPI.toggleWindow()`

#### 4.2 Main Process Features Needing Bridge

- **Global Shortcuts** → Send events to renderer
- **Window State Management** → Notify renderer of changes
- **API Connection Status** → Update renderer status
- **App Settings** → Sync with renderer preferences

### 5. TypeScript Definitions

#### 5.1 Create IPC Types

**File:** `src/types/electron.d.ts`

- Define all IPC channel interfaces
- Type-safe communication contracts
- Auto-completion in renderer process

#### 5.2 Preload API Interface

```typescript
interface ElectronAPI {
  // Window Management
  toggleWindow: () => Promise<void>;
  onWindowStateChange: (callback: (state: WindowState) => void) => void;

  // Settings
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  onSettingsChange: (callback: (settings: AppSettings) => void) => void;

  // AI Integration
  sendAIQuery: (prompt: string) => Promise<string>;
  onAIResponse: (callback: (response: AIResponse) => void) => void;

  // System Integration
  registerGlobalShortcut: (
    shortcut: string,
    action: string
  ) => Promise<boolean>;
  showNotification: (message: string) => Promise<void>;
  accessClipboard: (
    operation: "read" | "write",
    data?: string
  ) => Promise<string>;
}
```

### 6. Error Handling Strategy

#### 6.1 IPC Error Handling

- **Timeout handling** for async operations
- **Connection state monitoring** between processes
- **Graceful degradation** when IPC fails
- **Error logging** and user notifications

#### 6.2 Security Error Handling

- **Validation** of all IPC messages
- **Sanitization** of data from renderer
- **Rate limiting** for sensitive operations
- **Permission checks** for file system access

### 7. Testing Strategy

#### 7.1 IPC Testing

- **Unit tests** for individual IPC channels
- **Integration tests** for main ↔ renderer communication
- **Security tests** for context isolation
- **Performance tests** for large data transfers

#### 7.2 Testing Tools

- **Electron's spectron** for e2e testing
- **Jest** for unit testing IPC functions
- **Mock IPC** for renderer-only testing

### 8. Migration Path

#### 8.1 Current Unsafe Patterns to Replace

```typescript
// REMOVE: Direct Node.js access in renderer
const fs = require("fs");
const path = require("path");
```

#### 8.2 Replacement with Secure IPC

```typescript
// REPLACE WITH: Secure IPC calls
const data = await window.electronAPI.readFile(filepath);
await window.electronAPI.saveFile(content, filename);
```

### 9. Performance Considerations

#### 9.1 IPC Optimization

- **Batch operations** to reduce IPC overhead
- **Message size limits** for large data
- **Async patterns** to prevent blocking
- **Caching strategies** for frequently accessed data

#### 9.2 Memory Management

- **Proper cleanup** of IPC listeners
- **Prevent memory leaks** in long-running processes
- **Garbage collection** for large data transfers

### 10. File Structure After Implementation

```
src/
├── electron/
│   ├── main.ts          # Main process (updated)
│   ├── preload.ts       # IPC bridge (new)
│   ├── ipc-handlers.ts  # IPC channel handlers (new)
│   └── tsconfig.json
├── ui/
│   ├── App.tsx          # React app (updated)
│   ├── hooks/
│   │   └── useElectronAPI.ts  # IPC React hooks (new)
│   └── services/
│       └── electronService.ts # IPC service layer (new)
├── types/
│   ├── electron.d.ts    # IPC type definitions (new)
│   └── ipc.ts          # IPC interfaces (new)
└── shared/
    ├── constants.ts     # IPC channel names (new)
    └── types.ts        # Shared type definitions (new)
```

### 11. Implementation Priority

#### High Priority (Security Critical)

1. ✅ Remove `nodeIntegration: true`
2. ✅ Enable `contextIsolation: true`
3. ✅ Create basic preload script
4. ✅ Implement core window management IPC

#### Medium Priority (Core Features)

1. Settings management IPC
2. AI query/response IPC
3. Global shortcuts IPC
4. API status monitoring IPC

#### Low Priority (Enhancement)

1. File system operations IPC
2. External integrations IPC
3. Advanced system information IPC
4. Update mechanism IPC

### 12. Development Guidelines

#### 12.1 IPC Best Practices

- **Always validate** data from renderer process
- **Use type-safe interfaces** for all IPC calls
- **Handle errors gracefully** in both processes
- **Log IPC operations** for debugging
- **Document all IPC channels** and their purposes

#### 12.2 Security Guidelines

- **Never trust** data from renderer process
- **Sanitize all inputs** in main process
- **Use allowlists** for permitted operations
- **Audit IPC channels** regularly for security issues
- **Follow principle of least privilege**

---

**Next Steps:**

1. Review this plan with development team
2. Create detailed implementation tickets
3. Start with Phase 1 (Security Foundation)
4. Test each phase thoroughly before proceeding
5. Document all IPC APIs as they're implemented
