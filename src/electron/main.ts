import { app, BrowserWindow, globalShortcut, screen } from "electron";
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
import { initMain } from "electron-audio-loopback";

// Initialize electron-audio-loopback before app is ready
// This sets Chromium feature flags for system audio loopback capture
initMain();

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

export const store = new Store();

// WindowManager instance
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
export let mainWindow: BrowserWindow | null = null;
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

// Register custom protocol for deep linking
if (process.defaultApp && process.argv.length >= 2) {
  // If running in development with 'electron .', register qluely-dev
  // and manually point the registry back to the electron executable with the app path
  app.setAsDefaultProtocolClient("qluely-dev", process.execPath, [path.resolve(process.argv[1])]);
} else {
  // In production, just register qluely
  app.setAsDefaultProtocolClient("qluely");
}

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
  aiService = new AICommunicationService(webSocketManager, authService, windowManager, {
    maxRetries: 3,
    retryDelay: 1000,
    requestTimeout: 30000,
  });
}

// Initialize ScreenCaptureService
function initializeScreenCaptureService(): void {
  screenCaptureService = new ScreenCaptureService(windowManager);
}

// Initialize WindowManager
function initializeWindowManager(): void {
  windowManager = new WindowManager({
    preloadPath: path.join(__dirname, "preload.js"),
    htmlPath: path.join(__dirname, "../dist-react/index.html"),
    iconPath: path.join(__dirname, "../assets/logo.png"),
  });
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
        // Handle logout - redirect to login page
        windowManager?.sendMessage("nav:change", "/login");
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
      // Connect WebSocket after successful OAuth login
      connectWebSocket();
      // Notify renderer: OAuth complete
      windowManager?.sendMessage("auth:oauth-complete", { success: true });
      // Navigate to home
      const session = authService.getCurrentSession();
      if (session?.isOnboarded === false) {
        windowManager?.sendMessage("nav:change", "/onboarding");
      } else {
        windowManager?.sendMessage("nav:change", "/");
      }
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
    initializeWindowManager();
    initializeWebSocketManager();
    initializeAuthenticationService();
    initializeOAuthService();
    initializeAutoUpdaterService();
    initializeAICommunicationService();
    initializeScreenCaptureService();
    // Initialize NavigationService after services are ready
    navigationService = new NavigationService(mainWindow);
    audioRecordingService = new AudioRecordingService();

    if (process.platform === "darwin") {
      app.dock?.hide();
      // Check permissions before creating the main window
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

    // Initialize auto-updates
    if (!app.isPackaged) {
      console.log("App is in development mode, skipping auto-update setup");
    } else {
      console.log("Setting up auto-updates...");
      // Start initial check 3 seconds after app start
      setTimeout(() => {
        autoUpdaterService?.checkForUpdatesAndNotify();
      }, 3000);

      // Start periodic checks
      autoUpdaterService?.startPeriodicChecks();
    }

    const token = authService?.getToken();
    const hasRefreshToken = !!authService?.getRefreshToken();

    // Decide if we should try to start normally or go to login
    if (!token && !hasRefreshToken) {
      console.log("No token or refresh token found, directing to login");
      mainWindow?.webContents.once("did-finish-load", () => {
        windowManager?.sendMessage("nav:change", "/login");
      });
    } else {
      // Simple validation: if expired or expiring soon, try to refresh
      const isExpired = authService?.isTokenExpired();
      const isExpiringSoon = authService?.isTokenExpiringSoon(10); // 10 minutes window

      if ((isExpired || isExpiringSoon) && hasRefreshToken) {
        console.log(
          `${isExpired ? "Access token expired" : "Token expiring soon"}, attempting refresh...`,
        );
        authService
          ?.refreshToken()
          .then((success) => {
            if (success) {
              console.log("Token refreshed successfully on app start");
              handleAuthenticatedStart();
            } else {
              console.log("Token refresh failed, directing to login");
              windowManager?.sendMessage("nav:change", "/login");
            }
          })
          .catch((err) => {
            console.error("Token refresh error during startup:", err);
            windowManager?.sendMessage("nav:change", "/login");
          });
      } else if (!isExpired && token) {
        console.log("Existing token is still valid, proceeding...");
        handleAuthenticatedStart();
      } else {
        // Fallback: something is wrong with the session data
        console.log("Incomplete or invalid session, directing to login");
        windowManager?.sendMessage("nav:change", "/login");
      }
    }

    // Common logic for starting once authenticated
    function handleAuthenticatedStart() {
      const session = authService?.getCurrentSession();

      // Ensure we have a valid session before connecting WebSocket
      if (!session) {
        windowManager?.sendMessage("nav:change", "/login");
        return;
      }

      // Show onboarding screen only if user hasn't onboarded at all (isOnboarded: false)
      if (session?.isOnboarded === false) {
        console.log("User needs to complete onboarding, redirecting...");
        mainWindow?.webContents.once("did-finish-load", () => {
          windowManager?.sendMessage("nav:change", "/onboarding");
        });
      }

      // Connect WebSocket now that we have a valid token
      connectWebSocket();
    }
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

  mainWindow?.webContents.send("nav:change", "/login");
  // Alternative: windowManager.sendMessage("nav:change", "/login");

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
