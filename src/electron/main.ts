import electronMain from "electron/main";
import type { BrowserWindow as BrowserWindowType } from "electron";
const { app, BrowserWindow, globalShortcut } = electronMain;
import fs from "fs";
import path from "path";
import WebSocket from "ws";
import { fileURLToPath } from "url";
import Store from "electron-store";
import "./icp.js";
import { WindowManager } from "./services/WindowManager.js";
import { WebSocketManager } from "./services/WebSocketManager.js";
import { AuthenticationService } from "./services/AuthenticationService.js";
import { AutoUpdaterService } from "./services/AutoUpdaterService.js";
import { AICommunicationService } from "./services/AICommunicationService.js";
import { ScreenCaptureService } from "./services/ScreenCaptureService.js";
import { NavigationService } from "./services/NavigationService.js";
import { AudioRecordingService } from "./services/AudioRecordingService.js";
import { PermissionService } from "./services/PermissionService.js";
import { OAuthService } from "./services/OAuthService.js";
import { ProviderSettingsService } from "./services/ProviderSettingsService.js";
import { registerDisplayMediaHandler } from "./services/DisplayMediaService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global Error Handlers to prevent visible error dialogs on screen
process.on("uncaughtException", (error) => {
  console.error("CRITICAL: Uncaught Exception in Main Process:", error);
  // Optional: send to logging service
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL: Unhandled Rejection in Main Process:", reason);
  // Optional: send to logging service
});
// WindowManager instance
export let store: Store;
let windowManager: WindowManager;
// WebSocketManager instance
let webSocketManager: WebSocketManager;
// AuthenticationService instance
let authService: AuthenticationService;
// AutoUpdaterService instance
let autoUpdaterService: AutoUpdaterService;
// AICommunicationService instance
let aiService: AICommunicationService;
// ScreenCaptureService instance
let screenCaptureService: ScreenCaptureService;
// OAuthService instance
let oauthService: OAuthService;
// ProviderSettingsService instance
let providerSettingsService: ProviderSettingsService;
export let mainWindow: BrowserWindowType | null = null;
let navigationService: NavigationService;
let audioRecordingService: AudioRecordingService;
// Export AudioRecordingService getter for IPC handlers
export function getAudioRecordingService(): AudioRecordingService {
  return audioRecordingService;
}
// Export NavigationService getter for IPC handlers
export function getNavigationService(): NavigationService {
  return navigationService;
}
export let isVisible: boolean = false;
export let socket: WebSocket | null = null;
let isLoggingOut = false; // Flag to prevent auto-reconnect during logout
let audioLoopbackInitialized = false;

function initializeAudioLoopback(): void {
  if (process.platform !== "darwin") {
    return;
  }

  // Keep dev startup minimal. The loopback package is only needed for
  // macOS audio capture, and it can abort Electron before the window exists.
  if (!app.isPackaged && process.env.QLUELY_ENABLE_AUDIO_LOOPBACK !== "1") {
    console.log("Skipping audio loopback initialization in development");
    return;
  }

  if (audioLoopbackInitialized) {
    return;
  }

  audioLoopbackInitialized = true;
  void import("electron-audio-loopback")
    .then(({ initMain }) => {
      initMain();
      console.log("electron-audio-loopback initialized");
    })
    .catch((error) => {
      audioLoopbackInitialized = false;
      console.error("Failed to initialize electron-audio-loopback:", error);
    });
}

initializeAudioLoopback();

// Register custom protocols for deep linking. Both schemes are declared in
// electron-builder.json, so both need to be claimed at runtime.
const DEEP_LINK_SCHEMES = ["qluely", "qluely-dev"];

function registerProtocolClients(): void {
  if (app.isPackaged) {
    // Only touch LaunchServices in packaged builds. Keeping dev startup minimal
    // avoids macOS launch-time aborts and keeps `npm run dev` focused on the UI.
    DEEP_LINK_SCHEMES.forEach((scheme) => app.setAsDefaultProtocolClient(scheme));
    return;
  }

  // On Windows an unpackaged app must register electron.exe plus the entry script,
  // otherwise the OS has nothing to launch for the scheme.
  if (process.platform === "win32" && process.argv.length >= 2) {
    const entry = path.resolve(process.argv[1]);
    DEEP_LINK_SCHEMES.forEach((scheme) =>
      app.setAsDefaultProtocolClient(scheme, process.execPath, [entry]),
    );
  }
}

registerProtocolClients();

// Export WindowManager getter for IPC handlers
export function getWindowManager(): WindowManager {
  return windowManager;
}

// Export WebSocketManager getter for IPC handlers
export function getWebSocketManager(): WebSocketManager {
  return webSocketManager;
}

// Export AuthenticationService getter for IPC handlers
export function getAuthenticationService(): AuthenticationService {
  return authService;
}

// Export AutoUpdaterService getter for IPC handlers
export function getAutoUpdaterService(): AutoUpdaterService {
  return autoUpdaterService;
}

// Export AICommunicationService getter for IPC handlers
export function getAICommunicationService(): AICommunicationService {
  return aiService;
}

// Export ScreenCaptureService getter for IPC handlers
export function getScreenCaptureService(): ScreenCaptureService {
  return screenCaptureService;
}

// Export OAuthService getter for IPC handlers
export function getOAuthService(): OAuthService {
  return oauthService;
}

// Export ProviderSettingsService getter for IPC handlers
export function getProviderSettingsService(): ProviderSettingsService {
  return providerSettingsService;
}

// Initialize AutoUpdaterService
function initializeAutoUpdaterService(): void {
  autoUpdaterService = new AutoUpdaterService(windowManager, {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    checkInterval: 60 * 60 * 1000, // Check every hour
    allowPrerelease: false,
  });
}

// Initialize AICommunicationService
function initializeAICommunicationService(): void {
  aiService = new AICommunicationService(windowManager, providerSettingsService, {
    requestTimeout: 30000,
  });
}

// Initialize ProviderSettingsService
function initializeProviderSettingsService(): void {
  providerSettingsService = new ProviderSettingsService();
}

function initializeStore(): void {
  store = new Store();
}

// Initialize ScreenCaptureService
function initializeScreenCaptureService(): void {
  screenCaptureService = new ScreenCaptureService(windowManager);
}

// Initialize WindowManager
function initializeWindowManager(): void {
  const preloadCandidates = [
    path.join(__dirname, "preload.js"),
    path.join(__dirname, "../preload.js"),
  ];
  const htmlCandidates = [
    path.join(__dirname, "../dist-react/index.html"),
    path.join(__dirname, "../../dist-react/index.html"),
  ];

  // __dirname is dist-app/electron, so assets/ lives two levels up in dev and inside
  // the asar root once packaged.
  const iconCandidates = [
    path.join(app.getAppPath(), "assets", "logo.png"),
    path.join(__dirname, "../../assets/logo.png"),
    path.join(process.resourcesPath ?? "", "assets", "logo.png"),
  ];

  const preloadPath =
    preloadCandidates.find((candidate) => fs.existsSync(candidate)) ?? preloadCandidates[0];
  const htmlPath =
    htmlCandidates.find((candidate) => fs.existsSync(candidate)) ?? htmlCandidates[0];
  const iconPath = iconCandidates.find((candidate) => fs.existsSync(candidate));

  if (!iconPath) {
    console.warn("App icon not found; falling back to the Electron default", iconCandidates);
  }

  windowManager = new WindowManager({ preloadPath, htmlPath, iconPath });
}
// Initialize WebSocketManager
function initializeWebSocketManager(): void {
  webSocketManager = new WebSocketManager({
    store,
    onMessage: (channel: string, ...args: any[]) => {
      windowManager?.sendMessage(channel, ...args);
    },
    onAuthExpired: () => {
      console.log("WebSocket reported authentication expired, attempting to refresh token...");
      authService
        ?.refreshToken()
        .then((success) => {
          if (success) {
            console.log("Token refreshed successfully after expiration, reconnecting WebSocket...");
            connectWebSocket();
          } else {
            console.log("Token refresh failed after expiration, logging out user");
            clearUser();
          }
        })
        .catch((err) => {
          console.error("Error refreshing token after WebSocket expiry:", err);
          clearUser();
        });
    },
    onConnectionStateChange: (connected: boolean) => {
      console.log(`WebSocket connection state: ${connected ? "connected" : "disconnected"}`);
      // Update global socket reference for backward compatibility
      socket = connected ? webSocketManager.getSocket() : null;
    },
  });
}

// Initialize AuthenticationService
function initializeAuthenticationService(): void {
  authService = new AuthenticationService({
    store,
    onAuthStateChange: (isAuthenticated: boolean, user) => {
      console.log(`Auth state changed: ${isAuthenticated ? "authenticated" : "unauthenticated"}`);
      if (user) {
        console.log(`User: ${user.userId}, Plan: ${user.plan}`);
      }

      if (!isAuthenticated) {
        console.log("Auth is disabled for startup access; keeping the current view");
      }
    },
    onTokenExpired: () => {
      console.log("JWT token expired, logging out user");
      clearUser();
    },
  });

  // Start periodic token refresh check
  setInterval(
    () => {
      if (authService?.isAuthenticated()) {
        authService.scheduleTokenRefresh(15); // refresh if expires in 15 mins
      }
    },
    5 * 60 * 1000,
  ); // Check every 5 minutes
}

// Initialize OAuthService and wire it to AuthenticationService
function initializeOAuthService(): void {
  oauthService = new OAuthService();
  authService.setOAuthService(oauthService);

  // Listen for OAuth results from OAuthService
  oauthService.onResult((result: any) => {
    if (result.success && result.jwt) {
      // Store tokens securely
      authService.storeOAuthTokens(result.jwt, result.refreshToken);
      // Direct-provider path no longer requires websocket login wiring
      connectWebSocket();
      // Notify renderer: OAuth complete
      windowManager?.sendMessage("auth:oauth-complete", { success: true });
      // Navigate to home
      const session = authService.getCurrentSession();
      windowManager?.sendMessage("nav:change", "/");
    } else {
      // Notify renderer with error
      windowManager?.sendMessage("auth:oauth-complete", {
        success: false,
        error: result.error || "Authentication failed",
      });
    }
  });
}
function createWindow(): void {
  if (!windowManager) {
    console.error("createWindow called before windowManager was initialized");
    return;
  }
  mainWindow = windowManager.createWindow();

  // Set up window closed handler to update global state
  mainWindow.on("closed", () => {
    mainWindow = null;
    isVisible = false;
    if (navigationService) navigationService.setMainWindow(null);
  });

  // Handle renderer process crashes without showing default error dialogs
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error(`Renderer process gone: ${details.reason} (${details.exitCode})`);
    if (details.reason !== "killed" && details.reason !== "clean-exit") {
      // Potentially reload or notify the user gracefully
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow();
        } else {
          mainWindow.reload();
        }
      }, 1000);
    }
  });

  // Set mainWindow in NavigationService
  if (navigationService) navigationService.setMainWindow(mainWindow);
}

function toggleOverlay() {
  if (!windowManager) {
    console.error("toggleOverlay called before windowManager was initialized");
    return;
  }
  windowManager.toggleWindow();

  // Update global state
  mainWindow = windowManager.getWindow();
  isVisible = windowManager.isVisible();
}

app.whenReady().then(async () => {
  try {
    // ── Single-instance lock (required for deep-link on Windows/Linux) ──
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
      // Another instance is already running — it will receive the deep-link
      app.quit();
      return;
    }

    // ── Handle deep-link from second instance (Windows / Linux) ──
    app.on("second-instance", (_event, argv) => {
      const deepLink = argv.find(
        (arg) => arg.startsWith("qluely://") || arg.startsWith("qluely-dev://"),
      );
      if (deepLink && oauthService) {
        oauthService.handleCallback(deepLink).catch(console.error);
      }
      // Focus the existing window
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    // Initialize services early to prevent race conditions with activate event or shortcuts
    initializeStore();
    initializeWindowManager();
    // Must run before the first getDisplayMedia() call from the preload script.
    registerDisplayMediaHandler();
    initializeProviderSettingsService();
    initializeAutoUpdaterService();
    initializeAICommunicationService();
    initializeScreenCaptureService();
    // Initialize NavigationService after services are ready
    navigationService = new NavigationService(mainWindow, ["/", "/settings"]);
    audioRecordingService = new AudioRecordingService();

    if (process.platform === "darwin") {
      if (app.isPackaged) {
        app.dock?.hide();
      } else {
        app.dock?.show();
      }
      const hasMicPermission = await PermissionService.ensureMicrophonePermission();
      const hasScreenPermission = await PermissionService.ensureScreenRecordingPermission();
      if (!hasMicPermission || !hasScreenPermission) {
        console.warn(
          "Starting app with missing permissions. Some audio features will be disabled.",
        );
      }
    }

    const toggleKey = process.platform === "darwin" ? "Command+/" : "Control+/";
    const quitKey = process.platform === "darwin" ? "Command+x" : "Control+x";

    globalShortcut.register(toggleKey, toggleOverlay);
    globalShortcut.register(quitKey, () => app.quit());

    createWindow();

    if (!app.isPackaged) {
      console.log("App is in development mode, skipping auto-update setup");
    } else {
      console.log("Setting up auto-updates...");
      setTimeout(() => {
        autoUpdaterService?.checkForUpdatesAndNotify();
      }, 3000);

      autoUpdaterService?.startPeriodicChecks();
    }

    mainWindow?.webContents.once("did-finish-load", () => {
      windowManager?.sendMessage("nav:change", "/");
    });
  } catch (error) {
    console.error("FATAL: Failed to initialize application:", error);
  }
});

app.on("activate", () => {
  if (!mainWindow) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// ── macOS: handle custom URI scheme deep-link (qluely://oauth/callback) ──
app.on("open-url", (event, url) => {
  event.preventDefault();
  if (oauthService && (url.startsWith("qluely://") || url.startsWith("qluely-dev://"))) {
    oauthService.handleCallback(url).catch(console.error);
  }
});

app.on("before-quit", (event) => {
  // Clean up resources before quitting
  autoUpdaterService?.destroy();
  aiService?.destroy();
  screenCaptureService?.destroy();
  audioRecordingService?.destroy();
  oauthService?.destroy();
  webSocketManager?.disconnect();
  socket = null;

  // Allow the quit to proceed
  // Don't call event.preventDefault() unless you have a specific reason
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

export function clearUser() {
  isLoggingOut = true; // Prevent auto-reconnect

  // Reset connection tracking
  webSocketManager?.resetLogoutState();

  // Use AuthenticationService to handle logout
  authService?.logout();

  // Disconnect WebSocket
  webSocketManager?.disconnect();
  socket = null;

  mainWindow?.webContents.send("nav:change", "/");
  // Alternative: windowManager.sendMessage("nav:change", "/settings");

  // Reset logout flag after navigation
  setTimeout(() => {
    isLoggingOut = false;
    webSocketManager?.resetLogoutState();
  }, 1000);
}

// Connect WebSocket using WebSocketManager
export function connectWebSocket() {
  webSocketManager?.connect();
}
