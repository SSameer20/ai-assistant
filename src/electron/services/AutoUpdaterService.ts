import electronMain from "electron/main";
const { app } = electronMain;
import pkg from "electron-updater";
import type { UpdateInfo, ProgressInfo, UpdateDownloadedEvent } from "electron-updater";

const { autoUpdater } = pkg;

export interface AutoUpdaterCheckResult {
  success: boolean;
  updateInfo?: UpdateInfo;
  error?: string;
}

export interface AutoUpdaterConfig {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkInterval?: number; // in milliseconds
  allowPrerelease?: boolean;
}

export enum UpdateState {
  IDLE = "idle",
  CHECKING = "checking",
  AVAILABLE = "available",
  NOT_AVAILABLE = "not-available",
  DOWNLOADING = "downloading",
  DOWNLOADED = "downloaded",
  ERROR = "error",
}

export class AutoUpdaterService {
  private state: UpdateState = UpdateState.IDLE;
  private currentUpdateInfo?: UpdateInfo;
  private checkInterval?: NodeJS.Timeout;
  private config: AutoUpdaterConfig;
  private windowManager: any;

  constructor(windowManager: any, config: Partial<AutoUpdaterConfig> = {}) {
    this.windowManager = windowManager;
    this.config = {
      autoDownload: true,
      autoInstallOnAppQuit: true,
      checkInterval: 60 * 60 * 1000, // 1 hour default
      allowPrerelease: false,
      ...config,
    };

    this.initialize();
  }

  private initialize(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = this.config.autoDownload;
    autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit;
    autoUpdater.allowPrerelease = this.config.allowPrerelease || false;

    this.setupEventListeners();

    console.log("AutoUpdaterService initialized", {
      autoDownload: this.config.autoDownload,
      autoInstallOnAppQuit: this.config.autoInstallOnAppQuit,
      allowPrerelease: this.config.allowPrerelease,
      checkInterval: this.config.checkInterval,
    });
  }

  private setupEventListeners(): void {
    autoUpdater.on("checking-for-update", () => {
      this.state = UpdateState.CHECKING;
      this.notifyRenderer("update:checking");
      console.log("AutoUpdater: Checking for updates...");
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      this.state = UpdateState.AVAILABLE;
      this.currentUpdateInfo = info;
      this.notifyRenderer("update:available", info);
      console.log("AutoUpdater: Update available", info);
    });

    autoUpdater.on("update-not-available", (info: UpdateInfo) => {
      this.state = UpdateState.NOT_AVAILABLE;
      this.notifyRenderer("update:not-available", info);
      console.log("AutoUpdater: No updates available", info);
    });

    autoUpdater.on("error", (error: Error) => {
      this.state = UpdateState.ERROR;
      const errorMessage = error.message || "Unknown error";
      this.notifyRenderer("update:error", errorMessage);
      console.error("AutoUpdater: Error", error);
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
      this.state = UpdateState.DOWNLOADING;
      this.notifyRenderer("update:download-progress", progress);
      console.log(`AutoUpdater: Download progress - ${Math.round(progress.percent)}%`);
    });

    autoUpdater.on("update-downloaded", (event: UpdateDownloadedEvent) => {
      this.state = UpdateState.DOWNLOADED;
      this.notifyRenderer("update:downloaded", event);
      console.log("AutoUpdater: Update downloaded", event);
    });
  }

  private notifyRenderer(channel: string, data?: any): void {
    try {
      this.windowManager?.sendMessage(channel, data);
    } catch (error) {
      console.error(`Failed to send update notification to renderer:`, error);
    }
  }

  /**
   * Check for updates manually
   */
  public async checkForUpdates(): Promise<AutoUpdaterCheckResult> {
    try {
      // if (!app.isPackaged) {
      //   return { success: false, error: "Updates not available in development mode" };
      // }

      if (this.state === UpdateState.CHECKING) {
        return { success: false, error: "Update check already in progress" };
      }

      console.log("AutoUpdater: Starting manual update check");
      const result = await autoUpdater.checkForUpdates();

      return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
      console.error("AutoUpdater: Check for updates error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Download available update
   */
  public async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!app.isPackaged) {
        return { success: false, error: "Updates not available in development mode" };
      }

      if (this.state === UpdateState.DOWNLOADING) {
        return { success: false, error: "Download already in progress" };
      }

      if (this.state !== UpdateState.AVAILABLE) {
        return { success: false, error: "No update available to download" };
      }

      console.log("AutoUpdater: Starting update download");
      await autoUpdater.downloadUpdate();

      return { success: true };
    } catch (error) {
      console.error("AutoUpdater: Download update error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Install downloaded update and restart app
   */
  public installUpdate(): { success: boolean; error?: string } {
    try {
      if (this.state !== UpdateState.DOWNLOADED) {
        return { success: false, error: "No update downloaded and ready for installation" };
      }

      console.log("AutoUpdater: Installing update and restarting app");
      autoUpdater.quitAndInstall(false, true);

      return { success: true };
    } catch (error) {
      console.error("AutoUpdater: Install update error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Check for updates and notify if available
   */
  public async checkForUpdatesAndNotify(): Promise<void> {
    if (!app.isPackaged) {
      console.log("AutoUpdater: Skipping update check in development mode");
      return;
    }

    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      console.error("AutoUpdater: Check for updates and notify error:", error);
    }
  }

  /**
   * Start periodic update checks
   */
  public startPeriodicChecks(): void {
    if (this.checkInterval) {
      this.stopPeriodicChecks();
    }

    if (this.config.checkInterval && this.config.checkInterval > 0) {
      console.log(`AutoUpdater: Starting periodic checks every ${this.config.checkInterval}ms`);
      this.checkInterval = setInterval(() => {
        this.checkForUpdatesAndNotify();
      }, this.config.checkInterval);
    }
  }

  /**
   * Stop periodic update checks
   */
  public stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      console.log("AutoUpdater: Stopped periodic checks");
    }
  }

  /**
   * Configure auto-updater settings
   */
  public updateConfig(newConfig: Partial<AutoUpdaterConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Apply configuration changes
    autoUpdater.autoDownload = this.config.autoDownload;
    autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit;
    autoUpdater.allowPrerelease = this.config.allowPrerelease || false;

    // Restart periodic checks if interval changed
    if (newConfig.checkInterval !== undefined) {
      this.stopPeriodicChecks();
      this.startPeriodicChecks();
    }

    console.log("AutoUpdater: Configuration updated", this.config);
  }

  /**
   * Get current update state
   */
  public getState(): UpdateState {
    return this.state;
  }

  /**
   * Get current update info if available
   */
  public getCurrentUpdateInfo(): UpdateInfo | undefined {
    return this.currentUpdateInfo;
  }

  /**
   * Get current configuration
   */
  public getConfig(): AutoUpdaterConfig {
    return { ...this.config };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopPeriodicChecks();
    autoUpdater.removeAllListeners();
    console.log("AutoUpdaterService: Cleaned up resources");
  }
}
