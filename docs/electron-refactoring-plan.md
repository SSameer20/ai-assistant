# Electron Codebase Refactoring Plan

## Converting to Singular Functionality Classes

### Current State Analysis

#### Current File Structure:

```
src/electron/
├── main.ts          # 429 lines - Mixed responsibilities (window, websocket, auth, auto-updater)
├── icp.ts           # 350+ lines - All IPC handlers mixed together
├── preload.ts       # 150+ lines - All context bridges in one file
├── socket.ts        # Simple utility function
├── config/
│   └── api.ts       # API configuration
└── types/
    ├── helper.ts    # WebSocket event enums
    └── protocol.ts  # Protocol types
```

#### Current Problems:

1. **main.ts** contains window management, WebSocket connection, authentication, auto-updates, and app lifecycle
2. **icp.ts** mixes all IPC handlers (navigation, auth, AI, recording, window controls, auto-updater)
3. **preload.ts** exposes all APIs in one large file
4. No separation of concerns or single responsibility principle
5. Hard to test, maintain, and scale
6. No proper error handling boundaries

---

## Refactoring Strategy

### Phase 1: Core Infrastructure Classes

#### 1.1 Window Management Service

**File:** `src/electron/services/WindowManager.ts`
**Responsibilities:**

- Window creation and configuration
- Window state management (show/hide/toggle)
- Window positioning and sizing
- Always-on-top behavior
- Content protection

**Current Code Location:** `main.ts` lines 78-103 (createWindow, toggleOverlay)

#### 1.2 WebSocket Connection Manager

**File:** `src/electron/services/WebSocketManager.ts`
**Responsibilities:**

- WebSocket connection lifecycle
- Connection retry logic with fallback URLs
- Message parsing and routing
- Connection state tracking
- Authentication token handling

**Current Code Location:** `main.ts` lines 221-429 (connectWebSocket function)

#### 1.3 Authentication Service

**File:** `src/electron/services/AuthenticationService.ts`
**Responsibilities:**

- JWT token storage and validation
- Login/logout operations
- Token refresh logic
- User session management

**Current Code Location:** `icp.ts` lines 200-250 (auth handlers), `main.ts` clearUser function

#### 1.4 Auto-Updater Service

**File:** `src/electron/services/AutoUpdaterService.ts`
**Responsibilities:**

- Update checking and downloading
- Update installation
- Progress tracking
- Update event handling

**Current Code Location:** `main.ts` lines 26-71, `icp.ts` lines 260-291

---

### Phase 2: Feature-Specific Services

#### 2.1 AI Communication Service

**File:** `src/electron/services/AICommunicationService.ts`
**Responsibilities:**

- AI query processing
- Streaming response handling
- Error management for AI operations
- Message formatting and validation

**Current Code Location:** `icp.ts` lines 100-150 (ai:start handler), WebSocket message handling in main.ts

#### 2.2 Audio Recording Service

**File:** `src/electron/services/AudioRecordingService.ts`
**Responsibilities:**

- Audio capture and recording
- Audio chunk processing
- Recording session management
- FFmpeg process management

**Current Code Location:** `icp.ts` lines 150-190 (record handlers)

#### 2.3 Screen Capture Service

**File:** `src/electron/services/ScreenCaptureService.ts`
**Responsibilities:**

- Screen capture functionality
- Image processing and encoding
- Capture source management

**Current Code Location:** `icp.ts` lines 40-80 (capture handlers)

#### 2.4 Navigation Service

**File:** `src/electron/services/NavigationService.ts`
**Responsibilities:**

- Route management
- Navigation event handling
- Route validation and security

**Current Code Location:** `icp.ts` lines 20-40 (nav handlers)

---

### Phase 3: IPC Layer Reorganization

#### 3.1 IPC Handler Registry

**File:** `src/electron/ipc/IPCHandlerRegistry.ts`
**Responsibilities:**

- Centralized IPC handler registration
- Handler lifecycle management
- Error boundary for IPC calls

#### 3.2 Service-Specific IPC Handlers

**Files:**

- `src/electron/ipc/handlers/WindowIPCHandlers.ts`
- `src/electron/ipc/handlers/AuthIPCHandlers.ts`
- `src/electron/ipc/handlers/AIIPCHandlers.ts`
- `src/electron/ipc/handlers/AudioIPCHandlers.ts`
- `src/electron/ipc/handlers/NavigationIPCHandlers.ts`
- `src/electron/ipc/handlers/UpdaterIPCHandlers.ts`

#### 3.3 Preload API Modules

**Files:**

- `src/electron/preload/apis/WindowAPI.ts`
- `src/electron/preload/apis/AuthAPI.ts`
- `src/electron/preload/apis/AIAPI.ts`
- `src/electron/preload/apis/AudioAPI.ts`
- `src/electron/preload/apis/NavigationAPI.ts`
- `src/electron/preload/apis/UpdaterAPI.ts`

---

### Phase 4: Supporting Infrastructure

#### 4.1 Event Management System

**File:** `src/electron/core/EventManager.ts`
**Responsibilities:**

- Type-safe event emission and listening
- Event routing between services
- Event lifecycle management

#### 4.2 Error Handling System

**File:** `src/electron/core/ErrorHandler.ts`
**Responsibilities:**

- Centralized error handling
- Error logging and reporting
- Graceful degradation strategies

#### 4.3 Configuration Manager

**File:** `src/electron/core/ConfigurationManager.ts`
**Responsibilities:**

- Environment-based configuration
- Settings persistence
- Configuration validation

#### 4.4 Storage Service

**File:** `src/electron/services/StorageService.ts`
**Responsibilities:**

- Electron-store wrapper
- Data persistence and retrieval
- Storage encryption for sensitive data

---

## Implementation Plan

### Step 1: Extract Window Management (Week 1)

1. Create `WindowManager.ts` class
2. Move window-related functionality from `main.ts`
3. Update window-related IPC handlers
4. Test window operations

### Step 2: Extract WebSocket Management (Week 1)

1. Create `WebSocketManager.ts` class
2. Move WebSocket logic from `main.ts`
3. Implement proper connection state management
4. Add comprehensive error handling

### Step 3: Extract Authentication Service (Week 2)

1. Create `AuthenticationService.ts` class
2. Move auth logic from `icp.ts` and `main.ts`
3. Implement token validation and refresh
4. Update auth-related IPC handlers

### Step 4: Extract Remaining Services (Week 2-3)

1. Create AI, Audio, Screen, Navigation services
2. Move corresponding logic from `icp.ts`
3. Update related IPC handlers
4. Test service isolation

### Step 5: Reorganize IPC Layer (Week 3)

1. Create IPC handler registry
2. Split IPC handlers by service
3. Reorganize preload APIs
4. Implement type-safe IPC communication

### Step 6: Add Supporting Infrastructure (Week 4)

1. Implement event management system
2. Add centralized error handling
3. Create configuration manager
4. Add comprehensive logging

---

## Benefits After Refactoring

### 1. Maintainability

- Single responsibility principle
- Clear separation of concerns
- Easier to locate and fix bugs
- Simplified testing strategies

### 2. Scalability

- Easy to add new features
- Modular architecture
- Plugin-like service system
- Independent service evolution

### 3. Code Quality

- Type safety improvements
- Better error boundaries
- Consistent patterns
- Reduced code duplication

### 4. Developer Experience

- Clear service boundaries
- Easier onboarding
- Better IDE support
- Improved debugging

---

## File Structure After Refactoring

```
src/electron/
├── main.ts                 # App lifecycle and service orchestration only
├── preload.ts             # Main preload entry point
├── core/
│   ├── Application.ts     # Main application class
│   ├── ServiceContainer.ts # Dependency injection
│   ├── EventManager.ts    # Event system
│   ├── ErrorHandler.ts    # Error handling
│   └── ConfigurationManager.ts
├── services/
│   ├── WindowManager.ts
│   ├── WebSocketManager.ts
│   ├── AuthenticationService.ts
│   ├── AutoUpdaterService.ts
│   ├── AICommunicationService.ts
│   ├── AudioRecordingService.ts
│   ├── ScreenCaptureService.ts
│   ├── NavigationService.ts
│   └── StorageService.ts
├── ipc/
│   ├── IPCHandlerRegistry.ts
│   └── handlers/
│       ├── WindowIPCHandlers.ts
│       ├── AuthIPCHandlers.ts
│       ├── AIIPCHandlers.ts
│       ├── AudioIPCHandlers.ts
│       ├── NavigationIPCHandlers.ts
│       └── UpdaterIPCHandlers.ts
├── preload/
│   ├── apis/
│   │   ├── WindowAPI.ts
│   │   ├── AuthAPI.ts
│   │   ├── AIAPI.ts
│   │   ├── AudioAPI.ts
│   │   ├── NavigationAPI.ts
│   │   └── UpdaterAPI.ts
│   └── index.ts           # Combines all APIs
├── types/
│   ├── events.ts          # Event type definitions
│   ├── services.ts        # Service interfaces
│   ├── ipc.ts            # IPC type definitions
│   ├── helper.ts         # Existing enums
│   └── protocol.ts       # Existing protocol types
└── config/
    └── api.ts            # Existing API config
```

---

## Risk Mitigation

### 1. Gradual Migration

- Implement one service at a time
- Maintain backward compatibility during transition
- Use feature flags for new implementations

### 2. Testing Strategy

- Unit tests for each service
- Integration tests for service interactions
- IPC communication tests
- End-to-end functionality tests

### 3. Rollback Plan

- Keep original code in backup branches
- Implement feature toggles
- Monitor for regressions
- Quick revert capability

---

## Success Metrics

### 1. Code Quality Metrics

- Reduced cyclomatic complexity
- Improved test coverage
- Decreased code duplication
- Better type safety

### 2. Developer Metrics

- Faster development of new features
- Reduced bug count
- Faster debugging time
- Improved code review efficiency

### 3. Performance Metrics

- No degradation in app startup time
- Maintained WebSocket performance
- No memory leaks in service management
- Efficient IPC communication
