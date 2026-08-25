import electronMain from "electron/main";
import type { BrowserWindow as BrowserWindowType } from "electron/main";
const { BrowserWindow, screen } = electronMain;
import path from "path";

export interface WindowManagerOptions {
  preloadPath: string;
  htmlPath: string;
  iconPath?: string;
}

export class WindowManager {
  private window: BrowserWindowType | null = null;
  private options: WindowManagerOptions;

  constructor(options: WindowManagerOptions) {
    this.options = options;
  }

  /**
   * Creates and configures the main application window
   */
  public createWindow(): BrowserWindowType {
    if (this.window && !this.window.isDestroyed()) {
      return this.window;
    }

    this.window = new BrowserWindow({
      frame: false,
      width: 720,
      height: 520,
      show: false,
      minHeight: 200,
      minWidth: 500,
      transparent: true,
      hasShadow: false, // Prevents macOS shadow artifacts with backdrop-filter
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      focusable: true, // REQUIRED
      icon:
        process.platform === "win32" || process.platform === "linux"
          ? this.options.iconPath
          : undefined,
      webPreferences: {
        preload: this.options.preloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    this.enableContentProtection();

    this.setupWindow();
    return this.window;
  }

  /**
   * Sets up window configuration and event handlers
   */
  private setupWindow(): void {
    if (!this.window) return;

    this.window.setIgnoreMouseEvents(false);
    // Enable content protection immediately — window must never appear on screen share
    this.window.setContentProtection(true);
    this.window.webContents.on("did-finish-load", () => {
      console.log("Main window finished loading");
    });
    this.window.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        console.error("Main window failed to load", { errorCode, errorDescription, validatedURL });
      },
    );
    this.window.webContents.on("render-process-gone", (_event, details) => {
      console.error("Renderer process gone", details);
    });
    this.window.loadFile(this.options.htmlPath);
    this.window.show();

    this.window.once("ready-to-show", () => {
      this.positionWindow();
      this.window?.show();
      this.window?.focus();
    });

    this.window.on("closed", () => {
      this.window = null;
    });

    this.setAlwaysOnTop(true);
  }

  /**
   * Positions the window in the center of the screen
   */
  private positionWindow(): void {
    if (!this.window) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;
    if (Number.isFinite(width)) {
      this.window.setPosition(Math.round((width - 600) / 2), 50);
    }
  }

  /**
   * Toggles window visibility
   */
  public toggleWindow(): void {
    if (!this.window || this.window.isDestroyed()) {
      this.createWindow();
      return;
    }

    if (this.window.isVisible()) {
      this.window.hide();
    } else {
      this.window.show();
      this.window.focus();
    }
  }

  /**
   * Shows the window
   */
  public showWindow(): void {
    if (!this.window || this.window.isDestroyed()) {
      this.createWindow();
      return;
    }

    this.window.show();
    this.window.focus();
  }

  /**
   * Hides the window
   */
  public hideWindow(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide();
    }
  }

  /**
   * Sets the always-on-top behavior
   */
  public setAlwaysOnTop(
    flag: boolean,
    level:
      | "normal"
      | "floating"
      | "torn-off-menu"
      | "modal-panel"
      | "main-menu"
      | "status"
      | "pop-up-menu"
      | "screen-saver" = "screen-saver",
  ): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.setAlwaysOnTop(flag, level);
    }
  }

  /**
   * Enables content protection
   */
  public enableContentProtection(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.setContentProtection(true);
    }
  }

  /**
   * Disables content protection
   */
  public disableContentProtection(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.setContentProtection(false);
    }
  }

  /**
   * Sets window position
   */
  public setPosition(x: number, y: number): void {
    if (this.window && !this.window.isDestroyed()) {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        this.window.setPosition(Math.round(x), Math.round(y));
      }
    }
  }

  /**
   * Sets window size
   */
  public setSize(width: number, height: number, animate?: boolean): void {
    if (this.window && !this.window.isDestroyed()) {
      if (Number.isFinite(width) && Number.isFinite(height)) {
        this.window.setContentSize(Math.round(width), Math.round(height), animate);
      }
    }
  }

  /**
   * Gets the current window instance
   */
  public getWindow(): BrowserWindowType | null {
    return this.window;
  }

  /**
   * Checks if window exists and is not destroyed
   */
  public isWindowValid(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }

  /**
   * Checks if window is visible
   */
  public isVisible(): boolean {
    if (!this.window || this.window.isDestroyed()) {
      return false;
    }
    return this.window.isVisible();
  }

  /**
   * Sends a message to the window's webContents
   */
  public sendMessage(channel: string, ...args: any[]): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, ...args);
    }
  }

  /**
   * Destroys the window
   */
  public destroyWindow(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
      this.window = null;
    }
  }

  /**
   * Sets ignore mouse events
   */
  public setIgnoreMouseEvents(ignore: boolean): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.setIgnoreMouseEvents(ignore);
    }
  }
}
