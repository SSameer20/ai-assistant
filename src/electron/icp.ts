// navigation

import electronMain from "electron/main";
import electronCommon from "electron/common";
import { ipcMain } from "./electron-api.js";
const { app, BrowserWindow, globalShortcut, screen, systemPreferences } = electronMain;
const { shell } = electronCommon;
import path from "path";
import {
  clearUser,
  mainWindow,
  getScreenCaptureService,
  getAICommunicationService,
  getAuthenticationService,
  getProviderSettingsService,
  connectWebSocket,
  getAutoUpdaterService,
  getWebSocketManager,
  getAudioRecordingService,
  getOAuthService,
} from "./main.js";
import { PermissionService } from "./services/PermissionService.js";
import { QluelyInput } from "./types/protocol.js";

/*
 * Echo Event
 */
ipcMain.handle("qluely:echo", async (_, msg: string) => {
  return `app ${msg}`;
});

/*
 * mainWindow?.webContents.send("nav:change", "/settings");
 * Navigate from main.ts to react
 */
ipcMain.handle("nav:to", (_, route: string) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.error("Navigation failed: mainWindow is not available");
      return Promise.reject(new Error("Main window not available"));
    }

    console.log("Sending navigation event:", route);
    mainWindow.webContents.send("nav:change", route);
    return Promise.resolve();
  } catch (error) {
    console.error("Navigation error:", error);
    return Promise.reject(error);
  }
});

ipcMain.handle("overlay:set-click-through", (_, enable: boolean) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (enable) mainWindow.setIgnoreMouseEvents(enable, { forward: true });
    if (!enable) mainWindow.setIgnoreMouseEvents(enable);
  } catch (error) {
    console.error("Failed to set click through:", error);
  }
});

ipcMain.handle("window:set-content-protection", (_, enable: boolean) => {
  try {
    console.log(`[ContentProtection] Setting content protection to: ${enable}`);
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.warn("[ContentProtection] mainWindow is null or destroyed, skipping");
      return;
    }
    mainWindow.setContentProtection(enable);

    // macOS caches content protection state for active screen capture sessions.
    // Briefly hide and re-show the window to force macOS to pick up the change.
    if (process.platform === "darwin" && mainWindow.isVisible()) {
      mainWindow.hide();
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      }, 50);
    }

    console.log(`[ContentProtection] Successfully set content protection to: ${enable}`);
  } catch (error) {
    console.error("Failed to set content protection:", error);
  }
});

// Register global shortcut for Interactive Mode escape
// Call this after app is ready
export function registerInteractiveModeShortcut() {
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(false);
      mainWindow.webContents.send("interactive-mode:force-disable");
    }
  });
}

// Register the shortcut immediately (assuming app is ready)
if (app.isReady()) {
  registerInteractiveModeShortcut();
} else {
  app.whenReady().then(registerInteractiveModeShortcut);
}
// features
/*
 * AI Communication
 */
ipcMain.on("ai:start", async (event, input: QluelyInput) => {
  try {
    const aiService = getAICommunicationService();

    // Validate input
    if (!aiService.validateInput(input)) {
      const error = "Invalid input format";
      event.sender.send("ai:error", error);
      return;
    }

    if (!getProviderSettingsService().hasValidSettings()) {
      event.sender.send(
        "ai:error",
        "No API key configured. Open Settings to add your provider API key.",
      );
      event.sender.send("nav:change", "/settings");
      return;
    }

    const result = await aiService.startAIQuery(input);
    if (!result.success && result.error) {
      event.sender.send("ai:error", result.error);
    }
  } catch (error) {
    console.error("AI start handler error:", error);
    event.sender.send("ai:error", "Internal error starting AI query");
  }
});

async function transcribeAudioChunk(chunk: Buffer): Promise<void> {
  try {
    const providerSettings = getProviderSettingsService();
    const settings = providerSettings?.getSettings();
    if (!settings) {
      console.warn("Skipping audio transcription because no provider settings are saved");
      return;
    }

    if (settings.provider !== "openai") {
      console.warn(
        `Audio transcription is currently wired for OpenAI only, not ${settings.provider}`,
      );
      return;
    }

    const formData = new FormData();
    formData.append("model", settings.sttModel || providerSettings.getDefaultSttModel("openai"));
    formData.append("file", new Blob([new Uint8Array(chunk)], { type: "audio/wav" }), "chunk.wav");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Audio transcription failed:", errorText);
      return;
    }

    const payload = await response.json();
    const transcript = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (transcript) {
      mainWindow?.webContents.send("system:audio:chunk", transcript);
    }
  } catch (error) {
    console.error("Audio transcription error:", error);
  }
}

// audio: use central AudioRecordingService so chunking and watchers work
ipcMain.on("audio:start", async (event, opts = {}) => {
  try {
    const audioService = getAudioRecordingService();
    if (!audioService) {
      console.error("AudioRecordingService not initialized");
      return;
    }

    // Start recording with 5 second chunks by default when chunking is requested
    const options = { ...(opts || {}), chunkSeconds: 5 };
    const output = audioService.startRecording(options);
    console.log("Recording started, output pattern:", output);
    // Optionally inform renderer
    event?.sender?.send?.("audio:started", { output });
  } catch (error) {
    console.error("Failed to start recording:", error);
    event?.sender?.send?.("audio:error", { error: (error as Error).message });
  }
});

ipcMain.on("audio:stop", async (event) => {
  try {
    const audioService = getAudioRecordingService();
    if (!audioService) return;
    await audioService.stopRecording();
    console.log("Recording stopped");
    event?.sender?.send?.("audio:stopped");
  } catch (error) {
    console.error("Failed to stop recording:", error);
    event?.sender?.send?.("audio:error", { error: (error as Error).message });
  }
});

// Forward each audio chunk to the server via WebSocket
ipcMain.on("audio:chunk", async (_, chunk: Buffer) => {
  try {
    await transcribeAudioChunk(chunk);
  } catch (error) {
    console.error("Failed to forward audio chunk:", error);
  }
});

// Send transcription as user message
ipcMain.on("transcription:send-audio-message", async (_, transcription: string) => {
  try {
    const aiService = getAICommunicationService();
    const result = await aiService.startAIQuery({ type: "text", text: transcription });
    if (!result.success && result.error) {
      mainWindow?.webContents.send("ai:error", result.error);
    }
  } catch (error) {
    console.error("Failed to forward transcription message:", error);
  }
});

// System audio recording (cross-platform: macOS + Windows)
ipcMain.handle(
  "system-audio:start",
  async (
    _,
    options: { outputDir?: string; filename?: string; quality?: "standard" | "high" } = {},
  ) => {
    try {
      const audioService = getAudioRecordingService();
      if (!audioService) {
        return { success: false, error: "Audio recording service not initialized" };
      }
      const outputPath = await audioService.startSystemAudioRecording(options);
      return { success: true, outputPath };
    } catch (error) {
      console.error("System audio start error:", error);
      return { success: false, error: (error as Error).message };
    }
  },
);

ipcMain.handle("system-audio:stop", async () => {
  try {
    const audioService = getAudioRecordingService();
    if (!audioService) {
      return { success: false, error: "Audio recording service not initialized" };
    }
    await audioService.stopSystemAudioRecording();
    return { success: true };
  } catch (error) {
    console.error("System audio stop error:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("system-audio:status", () => {
  const audioService = getAudioRecordingService();
  if (!audioService) {
    return { isRecording: false, outputPath: "", startTime: null, duration: 0 };
  }
  return audioService.getSystemAudioStatus();
});

ipcMain.handle("system-audio:list-devices", async (_, forceRefresh = false) => {
  try {
    const audioService = getAudioRecordingService();
    if (!audioService) {
      return { success: false, error: "Audio recording service not initialized", devices: [] };
    }
    if (forceRefresh) {
      audioService.invalidateDeviceCache();
    }
    const devices = await audioService.listAudioDevices();
    return { success: true, devices };
  } catch (error) {
    console.error("System audio list devices error:", error);
    return { success: false, error: (error as Error).message, devices: [] };
  }
});

// screen capture
ipcMain.handle("capture:screen", async () => {
  try {
    const screenCaptureService = getScreenCaptureService();
    if (!screenCaptureService) {
      return { success: false, error: "Screen capture service not initialized" };
    }
    return await screenCaptureService.captureScreen();
  } catch (error) {
    console.error("Screen capture error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("capture:screen-with-options", async (_, options) => {
  try {
    const screenCaptureService = getScreenCaptureService();
    if (!screenCaptureService) {
      return { success: false, error: "Screen capture service not initialized" };
    }
    return await screenCaptureService.captureScreen(options || {});
  } catch (error) {
    console.error("Screen capture with options error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("capture:sources", async () => {
  try {
    const screenCaptureService = getScreenCaptureService();
    if (!screenCaptureService) {
      return { success: false, error: "Screen capture service not initialized" };
    }
    return await screenCaptureService.getScreenSources();
  } catch (error) {
    console.error("Get screen sources error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("capture:windows", async () => {
  try {
    const screenCaptureService = getScreenCaptureService();
    if (!screenCaptureService) {
      return { success: false, error: "Screen capture service not initialized" };
    }
    return await screenCaptureService.getWindowSources();
  } catch (error) {
    console.error("Get windows error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("capture:source", async (_, sourceId, options) => {
  try {
    // Validate sourceId parameter
    if (!sourceId) {
      return { success: false, error: "Source ID is required" };
    }
    if (typeof sourceId !== "string") {
      console.error("Invalid sourceId type:", typeof sourceId, sourceId);
      return { success: false, error: "Source ID must be a string" };
    }

    const screenCaptureService = getScreenCaptureService();
    if (!screenCaptureService) {
      return { success: false, error: "Screen capture service not initialized" };
    }

    return await screenCaptureService.captureSource(sourceId, options || {});
  } catch (error) {
    console.error("Capture source error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("capture:display-info", async () => {
  try {
    const screenCaptureService = getScreenCaptureService();
    if (!screenCaptureService) {
      return { success: false, error: "Screen capture service not initialized" };
    }
    return screenCaptureService.getDisplayInfo();
  } catch (error) {
    console.error("Get display info error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

// provider settings
ipcMain.handle("provider-settings:get", () => {
  try {
    const providerSettings = getProviderSettingsService();
    if (!providerSettings) {
      return { success: false, error: "Provider settings service not available" };
    }
    return { success: true, data: providerSettings.getPublicSettings() };
  } catch (error) {
    console.error("Provider settings get error:", error);
    return { success: false, error: "Failed to read provider settings" };
  }
});

ipcMain.handle("provider-settings:save", (_, settings) => {
  try {
    const providerSettings = getProviderSettingsService();
    if (!providerSettings) {
      return { success: false, error: "Provider settings service not available" };
    }
    const data = providerSettings.saveSettings(settings);
    return { success: true, data };
  } catch (error) {
    console.error("Provider settings save error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save provider settings",
    };
  }
});

ipcMain.on("provider-settings:clear", () => {
  try {
    const providerSettings = getProviderSettingsService();
    providerSettings?.reset();
  } catch (error) {
    console.error("Provider settings clear error:", error);
  }
});

/*
 * Auto-updater controls
 */

ipcMain.handle("update:check", async () => {
  try {
    const autoUpdaterService = getAutoUpdaterService();
    return await autoUpdaterService.checkForUpdates();
  } catch (error) {
    console.error("Update check handler error:", error);
    return { success: false, error: "Failed to check for updates" };
  }
});

ipcMain.handle("update:install", async () => {
  try {
    const autoUpdaterService = getAutoUpdaterService();
    return await autoUpdaterService.installUpdate();
  } catch (error) {
    console.error("Update install handler error:", error);
    return { success: false, error: "Failed to install update" };
  }
});

ipcMain.handle("update:download", async () => {
  try {
    const autoUpdaterService = getAutoUpdaterService();
    return await autoUpdaterService.downloadUpdate();
  } catch (error) {
    console.error("Update download handler error:", error);
    return { success: false, error: "Failed to download update" };
  }
});

/*
 * Window Controls sets to window height
 */
ipcMain.on("window:fit", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)!;
  const [w] = win.getContentSize();

  // Get screen dimensions
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  // Measure DOM content height dynamically
  win.webContents
    .executeJavaScript(
      `
      (() => {
        const root = document.getElementById('root');
        if (!root) return 400;
        
        const mainContainer = document.querySelector('[data-main-container]');
        if (!mainContainer) return document.body.scrollHeight;
        
        const styleId = 'qluely-measure-style';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        
        // Briefly force the layout to max-content to measure intrinsic structural height
        styleEl.innerHTML = "[data-main-container], [data-main-container] .h-screen, [data-main-container] .h-full, [data-main-container] .flex-1, [data-main-container] .min-h-0, [data-main-container] .overflow-hidden, [data-main-container] .overflow-y-auto, [data-main-container] .overflow-auto { height: max-content !important; min-height: max-content !important; max-height: none !important; flex: none !important; overflow: visible !important; }";
        
        const actualHeight = mainContainer.scrollHeight;
        
        styleEl.innerHTML = '';
        
        return Math.ceil(actualHeight + 20); // Add a small margin
      })()
    `,
    )

    .then((h) => {
      const parsedH = Number.isFinite(h) ? h : 400;
      // Dynamic constraints: use screen size as maximum limits
      const minWidth = 400;
      const maxWidth = Math.min(1200, screenWidth - 100); // Leave 100px margin from screen edge
      const minHeight = 200;
      const maxHeight = Math.min(parsedH + 4, screenHeight - 200); // More margin for internal scrolling

      // Calculate dynamic width based on content, with constraints
      const dynamicWidth = Math.max(minWidth, Math.min(w, maxWidth));

      // Calculate dynamic height based on content and screen size
      const dynamicHeight = Math.max(minHeight, maxHeight);

      if (Number.isFinite(dynamicWidth) && Number.isFinite(dynamicHeight)) {
        win.setContentSize(Math.round(dynamicWidth), Math.round(dynamicHeight), true);
      }
    })
    .catch((error) => {
      console.error("Failed to execute window fit script:", error);
      // Fallback to reasonable default sizing
      const fallbackHeight = Math.min(400, screenHeight - 100);
      const safeW = Number.isFinite(w) ? w : 600;
      win.setContentSize(Math.min(safeW, 600), Math.round(fallbackHeight), true);
    });
});

/*
 * App Controls
 */
ipcMain.handle("app:quit", () => {
  app.quit();
});

/*
 * Permissions API
 */
ipcMain.handle("permissions:get-status", (_, type: "microphone" | "camera" | "screen") => {
  try {
    if (process.platform !== "darwin") return "granted";
    // @ts-ignore
    return systemPreferences.getMediaAccessStatus(type as any);
  } catch (error) {
    console.error("Get permissions status error:", error);
    return "denied";
  }
});

ipcMain.handle("permissions:request", async (_, type: "microphone" | "camera") => {
  try {
    if (process.platform !== "darwin") return true;
    return await systemPreferences.askForMediaAccess(type);
  } catch (error) {
    console.error("Request permissions error:", error);
    return false;
  }
});

ipcMain.handle("permissions:open-settings", (_, type: "microphone" | "screen") => {
  try {
    if (process.platform !== "darwin") return;

    const url =
      type === "microphone"
        ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        : "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";

    shell.openExternal(url);
  } catch (error) {
    console.error("Open settings error:", error);
  }
});

/*
 * Shell / External App Controls
 */

function isUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ["https:", "qluely:", "mailto:", "x-apple.systempreferences:"];
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

ipcMain.handle("shell:open-external", async (_, url: string) => {
  try {
    if (!isUrlAllowed(url)) {
      console.warn("Blocked attempt to open disallowed URL:", url);
      return { success: false, error: "URL not allowed" };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error("Failed to open external URL:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("shell:show-item-in-folder", (_, fullPath: string) => {
  try {
    // Basic validation to ensure path is absolute and within home/desktop
    if (!path.isAbsolute(fullPath)) {
      return { success: false, error: "Invalid path" };
    }
    shell.showItemInFolder(fullPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to show item in folder:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("shell:open-path", async (_, fullPath: string) => {
  try {
    if (!path.isAbsolute(fullPath)) {
      return { success: false, error: "Invalid path" };
    }
    const error = await shell.openPath(fullPath);
    if (error) {
      return { success: false, error };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to open path:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("permissions:ensure-screen", async () => {
  return await PermissionService.ensureScreenRecordingPermission();
});
