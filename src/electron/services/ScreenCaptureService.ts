import electronMain from "electron/main";
import electronCommon from "electron/common";
const { desktopCapturer, screen } = electronMain;
const { nativeImage } = electronCommon;

export interface ScreenCaptureOptions {
  format?: "png" | "jpeg";
  quality?: number; // 0-100 for JPEG
  scaleFactor?: number; // Scale factor for the capture
  x?: number; // X coordinate for partial capture
  y?: number; // Y coordinate for partial capture
  width?: number; // Width for partial capture
  height?: number; // Height for partial capture
}

export interface CaptureResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
  metadata?: { width: number; height: number; format: string; timestamp: string };
}

export interface ScreenSource {
  id: string;
  name: string;
  display_id: string;
  appIcon?: string;
}

export enum CaptureType {
  SCREEN = "screen",
  WINDOW = "window",
}

export class ScreenCaptureService {
  private windowManager: any;

  constructor(windowManager: any) {
    this.windowManager = windowManager;
    console.log("ScreenCaptureService initialized");
  }

  /**
   * Capture the primary screen
   */
  public async captureScreen(options: ScreenCaptureOptions = {}): Promise<CaptureResult> {
    try {
      console.log("Starting screen capture with options:", options);

      const display = screen.getPrimaryDisplay();
      const { width, height } = display.size;

      // Calculate thumbnail size based on options
      const thumbnailSize = {
        width: Math.floor(width * (options.scaleFactor || 1)),
        height: Math.floor(height * (options.scaleFactor || 1)),
      };

      const sources = await desktopCapturer.getSources({
        types: [CaptureType.SCREEN],
        thumbnailSize,
      });

      if (!sources || sources.length === 0) {
        return { success: false, error: "No screen sources available" };
      }

      const screenSource = sources[0];
      let image = screenSource.thumbnail;

      // Process the image based on options
      if (
        options.x !== undefined ||
        options.y !== undefined ||
        options.width !== undefined ||
        options.height !== undefined
      ) {
        image = this.cropImage(image, options);
      }

      // Convert to the desired format
      let dataUrl: string;
      if (options.format === "jpeg") {
        const jpegBuffer = image.toJPEG(options.quality || 80);
        dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
      } else {
        dataUrl = image.toDataURL();
      }

      console.log("Screen capture completed successfully");

      return {
        success: true,
        dataUrl,
        metadata: {
          width: image.getSize().width,
          height: image.getSize().height,
          format: options.format || "png",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown capture error";
      console.error("Screen capture failed:", error);

      this.notifyError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get available screen sources
   */
  public async getScreenSources(): Promise<{
    success: boolean;
    sources?: ScreenSource[];
    error?: string;
  }> {
    try {
      console.log("Getting available screen sources");

      const sources = await desktopCapturer.getSources({ types: [CaptureType.SCREEN] });
      console.log("Raw sources from desktopCapturer:", sources?.length || 0);

      if (!sources || !Array.isArray(sources)) {
        return { success: false, error: "No sources returned from desktopCapturer" };
      }

      const screenSources: ScreenSource[] = [];
      for (const source of sources) {
        if (source && typeof source.id === "string") {
          try {
            screenSources.push({
              id: source.id,
              name: source.name || "Unknown",
              display_id: source.display_id || "",
              appIcon: source.appIcon?.toDataURL(),
            });
          } catch (error) {
            console.error("Error processing source:", source, error);
          }
        }
      }

      console.log(`Found ${screenSources.length} valid screen sources`);

      return { success: true, sources: screenSources };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get screen sources";
      console.error("Get screen sources failed:", error);

      this.notifyError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get available window sources
   */
  public async getWindowSources(): Promise<{
    success: boolean;
    sources?: ScreenSource[];
    error?: string;
  }> {
    try {
      console.log("Getting available window sources");

      const sources = await desktopCapturer.getSources({ types: [CaptureType.WINDOW] });
      console.log("Raw window sources from desktopCapturer:", sources?.length || 0);

      if (!sources || !Array.isArray(sources)) {
        return { success: false, error: "No window sources returned from desktopCapturer" };
      }

      const windowSources: ScreenSource[] = [];
      for (const source of sources) {
        if (source && typeof source.id === "string") {
          try {
            windowSources.push({
              id: source.id,
              name: source.name || "Unknown Window",
              display_id: source.display_id || "",
              appIcon: source.appIcon?.toDataURL(),
            });
          } catch (error) {
            console.error("Error processing window source:", source, error);
          }
        }
      }

      console.log(`Found ${windowSources.length} valid window sources`);

      return { success: true, sources: windowSources };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get window sources";
      console.error("Get window sources failed:", error);

      this.notifyError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Capture a specific source by ID
   */
  public async captureSource(
    sourceId: string,
    options: ScreenCaptureOptions = {},
  ): Promise<CaptureResult> {
    try {
      console.log(`Starting capture for source: ${sourceId}`);

      const display = screen.getPrimaryDisplay();
      const { width, height } = display.size;

      // Calculate thumbnail size based on options
      const thumbnailSize = {
        width: Math.floor(width * (options.scaleFactor || 1)),
        height: Math.floor(height * (options.scaleFactor || 1)),
      };

      const sources = await desktopCapturer.getSources({
        types: [CaptureType.SCREEN, CaptureType.WINDOW],
        thumbnailSize,
      });

      console.log(`Looking for source ${sourceId} in ${sources?.length || 0} sources`);

      if (!sources || !Array.isArray(sources)) {
        return { success: false, error: "No sources returned from desktopCapturer" };
      }

      // Debug: log all source IDs to help troubleshoot
      console.log("Available source IDs:", sources.map((s) => s?.id).filter(Boolean));

      const source = sources.find((s) => s && s.id === sourceId);
      if (!source) {
        return {
          success: false,
          error: `Source with ID ${sourceId} not found. Available sources: ${sources.map((s) => s?.id).join(", ")}`,
        };
      }

      let image = source.thumbnail;

      // Process the image based on options
      if (
        options.x !== undefined ||
        options.y !== undefined ||
        options.width !== undefined ||
        options.height !== undefined
      ) {
        image = this.cropImage(image, options);
      }

      // Convert to the desired format
      let dataUrl: string;
      if (options.format === "jpeg") {
        const jpegBuffer = image.toJPEG(options.quality || 80);
        dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
      } else {
        dataUrl = image.toDataURL();
      }

      console.log(`Source capture completed successfully: ${sourceId}`);

      return {
        success: true,
        dataUrl,
        metadata: {
          width: image.getSize().width,
          height: image.getSize().height,
          format: options.format || "png",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown capture error";
      console.error(`Source capture failed for ${sourceId}:`, error);

      this.notifyError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get display information
   */
  public getDisplayInfo(): {
    primary: { width: number; height: number; scaleFactor: number };
    all: Array<{ width: number; height: number; scaleFactor: number; bounds: any }>;
  } {
    const primaryDisplay = screen.getPrimaryDisplay();
    const allDisplays = screen.getAllDisplays();

    return {
      primary: {
        width: primaryDisplay.size.width,
        height: primaryDisplay.size.height,
        scaleFactor: primaryDisplay.scaleFactor,
      },
      all: allDisplays.map((display) => ({
        width: display.size.width,
        height: display.size.height,
        scaleFactor: display.scaleFactor,
        bounds: display.bounds,
      })),
    };
  }

  /**
   * Crop an image based on options
   */
  private cropImage(
    image: Electron.NativeImage,
    options: ScreenCaptureOptions,
  ): Electron.NativeImage {
    const { width: imgWidth, height: imgHeight } = image.getSize();

    const x = Math.max(0, options.x || 0);
    const y = Math.max(0, options.y || 0);
    const width = Math.min(imgWidth - x, options.width || imgWidth);
    const height = Math.min(imgHeight - y, options.height || imgHeight);

    const rect = { x, y, width, height };
    return image.crop(rect);
  }

  /**
   * Notify renderer of capture errors
   */
  private notifyError(error: string): void {
    try {
      this.windowManager?.sendMessage("capture:error", error);
    } catch (err) {
      console.error("Failed to notify renderer of capture error:", err);
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    console.log("ScreenCaptureService: Cleaned up resources");
  }
}
