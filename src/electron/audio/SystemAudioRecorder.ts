import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";
import electronMain from "electron/main";
const { app } = electronMain;
import { FFmpegPathResolver } from "../lib/FFmpegPathResolver.js";
import {
  WindowsAudioCommands,
  WindowsAudioDevice,
} from "../audio/platform/WindowsAudioCommands.js";
import { MacOSAudioCommands, MacOSAudioDevice } from "../audio/platform/MacOSAudioCommands.js";
import { SystemAudioValidator } from "./SystemAudioValidator.js";

/** Union type for devices across platforms */
export type AudioDevice = WindowsAudioDevice | MacOSAudioDevice;

export interface SystemAudioRecordingOptions {
  outputDir?: string;
  filename?: string;
  quality?: "standard" | "high";
  deviceId?: string;
}

export interface RecordingStatus {
  isRecording: boolean;
  outputPath: string;
  startTime: number | null;
  duration: number;
}

export class SystemAudioRecorder {
  private ffmpeg: ChildProcessWithoutNullStreams | null = null;
  private outputPath: string = "";
  private isRecording: boolean = false;
  private startTime: number | null = null;
  private ffmpegResolver: FFmpegPathResolver;
  private validator: SystemAudioValidator;
  private cachedDevices: AudioDevice[] | null = null;
  private lastDeviceCheck: number = 0;
  private readonly DEVICE_CACHE_TTL = 30000; // 30 seconds

  constructor() {
    this.ffmpegResolver = FFmpegPathResolver.getInstance();
    this.validator = new SystemAudioValidator(this);
  }

  /**
   * Start recording system audio (macOS + Windows)
   */
  public async startRecording(options: SystemAudioRecordingOptions = {}): Promise<string> {
    try {
      // Verify FFmpeg is still needed for listAudioDevices, but not for recording to disk anymore.
      // We skip most validation as we are now just streaming via the renderer.
      await this.ffmpegResolver.verifyFFmpeg();
    } catch (error) {
      console.warn("FFmpeg check failed, but proceeding for stream-only mode:", error);
    }

    // Setup output path - disabled as per user request
    console.log("Local audio saving is disabled. Skipping FFmpeg spawn.");
    this.outputPath = "STREAM_ONLY";

    this.isRecording = true;
    this.startTime = Date.now();
    return this.outputPath;
  }

  /**
   * Build FFmpeg arguments based on platform and options
   */
  private buildFFmpegArgs(options: SystemAudioRecordingOptions): string[] {
    const platform = process.platform;

    if (platform === "darwin") {
      // macOS: use avfoundation
      if (options.quality === "high") {
        return MacOSAudioCommands.getHighQualitySystemAudioCommand(this.outputPath);
      }
      return MacOSAudioCommands.getSystemAudioCommand(this.outputPath);
    }

    // Windows: use WASAPI
    if (options.deviceId) {
      return WindowsAudioCommands.getSystemAudioCommandWithDevice(
        options.deviceId,
        this.outputPath,
      );
    }
    if (options.quality === "high") {
      return WindowsAudioCommands.getHighQualitySystemAudioCommand(this.outputPath);
    }
    return WindowsAudioCommands.getSystemAudioCommand(this.outputPath);
  }

  /**
   * Stop system audio recording cleanly
   */
  public stopRecording(): Promise<void> {
    if (this.outputPath === "STREAM_ONLY") {
      this.isRecording = false;
      this.startTime = null;
      this.outputPath = "";
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      if (!this.ffmpeg || !this.isRecording) {
        resolve();
        return;
      }
      // Graceful shutdown: SIGINT works on both macOS and Windows for FFmpeg
      // Using .kill() is more portable and less likely to be blocked by the MSIX sandbox
      // than spawning an external 'taskkill' process.
      try {
        if (process.platform === "win32") {
          // On Windows, SIGINT is the standard way to stop FFmpeg gracefully
          this.ffmpeg.kill("SIGINT");
        } else {
          this.ffmpeg.kill("SIGINT");
        }
      } catch (killError) {
        console.warn("Failed to send SIGINT to FFmpeg, trying SIGTERM:", killError);
        this.ffmpeg.kill("SIGTERM");
      }

      // For non-STREAM_ONLY, we still want to wait for FFmpeg to exit to ensure file finalization
      // and proper cleanup. The original logic for waiting on 'exit' and handling timeouts
      // is important for local file recordings.
      const timeout = setTimeout(() => {
        console.warn("FFmpeg did not exit gracefully, forcing termination");
        if (this.ffmpeg) {
          this.ffmpeg.kill("SIGKILL");
        }
        this.cleanupFailedRecording();
        reject(new Error("Recording stop timeout after 30 seconds"));
      }, 30000); // 30 second timeout for large files

      this.ffmpeg.on("exit", (code) => {
        clearTimeout(timeout);
        this.ffmpeg = null; // Clear reference after exit

        if (code === 0) {
          // Verify file was created and has content
          if (fs.existsSync(this.outputPath)) {
            const stats = fs.statSync(this.outputPath);
            if (stats.size > 0) {
              console.log(
                `Recording completed successfully: ${this.outputPath} (${stats.size} bytes)`,
              );
            } else {
              console.warn("Recording file exists but is empty");
            }
          } else {
            console.error("Recording file was not created");
          }
        } else {
          console.error(`FFmpeg exited with code: ${code}`);
        }
        this.isRecording = false;
        this.startTime = null;
        resolve();
      });
    });
  }

  /**
   * Get current recording status
   */
  public getStatus(): RecordingStatus {
    const duration = this.startTime ? Date.now() - this.startTime : 0;

    return {
      isRecording: this.isRecording,
      outputPath: this.outputPath,
      startTime: this.startTime,
      duration,
    };
  }

  /**
   * List available audio devices (cross-platform)
   */
  public async listAudioDevices(): Promise<AudioDevice[]> {
    const platform = process.platform;
    if (platform !== "win32" && platform !== "darwin") {
      throw new Error("Audio device listing is only supported on macOS and Windows");
    }

    // Return cached devices if still fresh
    const now = Date.now();
    if (this.cachedDevices && now - this.lastDeviceCheck < this.DEVICE_CACHE_TTL) {
      return this.cachedDevices;
    }

    const ffmpegPath = this.ffmpegResolver.getFFmpegPath();
    const args =
      platform === "darwin"
        ? MacOSAudioCommands.getListDevicesCommand()
        : WindowsAudioCommands.getListDevicesCommand();

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, args, { stdio: ["pipe", "pipe", "pipe"] });

      let output = "";
      let errorOutput = "";

      // FFmpeg sends device list to stderr
      ffmpeg.stderr?.on("data", (data) => {
        output += data.toString();
      });

      ffmpeg.stdout?.on("data", (data) => {
        errorOutput += data.toString();
      });

      const timeout = setTimeout(() => {
        ffmpeg.kill("SIGKILL");
        reject(new Error("Device enumeration timeout after 10 seconds"));
      }, 10000);

      ffmpeg.on("exit", (code) => {
        clearTimeout(timeout);

        // FFmpeg exits with non-zero when listing devices — that's expected
        try {
          const devices =
            platform === "darwin"
              ? MacOSAudioCommands.parseDeviceList(output)
              : WindowsAudioCommands.parseDeviceList(output);

          // Cache the results
          this.cachedDevices = devices;
          this.lastDeviceCheck = now;

          resolve(devices);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse device list: ${(error as Error).message}. Raw output: ${output}`,
            ),
          );
        }
      });

      ffmpeg.on("error", (error: Error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to list audio devices: ${error.message}`));
      });
    });
  }

  /**
   * Clean up failed or incomplete recordings
   */
  private cleanupFailedRecording(): void {
    if (this.outputPath && fs.existsSync(this.outputPath)) {
      try {
        const stats = fs.statSync(this.outputPath);
        // Remove files smaller than 1KB (likely incomplete/corrupted)
        if (stats.size < 1024) {
          fs.unlinkSync(this.outputPath);
          console.log("Removed incomplete recording file:", this.outputPath);
        }
      } catch (error) {
        console.warn("Could not clean up recording file:", error);
      }
    }
  }

  /**
   * Monitor recording file size during recording
   */
  private monitorRecordingProgress(): void {
    if (!this.isRecording || !this.outputPath) return;

    const checkFileSize = () => {
      if (!this.isRecording) return;

      try {
        if (fs.existsSync(this.outputPath)) {
          const stats = fs.statSync(this.outputPath);
          const sizeMB = stats.size / (1024 * 1024);

          // Log progress every 50MB
          if (sizeMB > 0 && Math.floor(sizeMB) % 50 === 0) {
            console.log(`Recording progress: ${Math.round(sizeMB)}MB`);
          }

          // Warn if file gets very large (over 1GB)
          if (sizeMB > 1024) {
            console.warn(`Large recording file: ${Math.round(sizeMB)}MB - consider stopping`);
          }
        }
      } catch (error) {
        console.warn("Could not check recording file size:", error);
      }

      // Continue monitoring if still recording
      if (this.isRecording) {
        setTimeout(checkFileSize, 10000); // Check every 10 seconds
      }
    };

    setTimeout(checkFileSize, 10000); // Start monitoring after 10 seconds
  }

  /**
   * Invalidate device cache to force refresh
   */
  public invalidateDeviceCache(): void {
    this.cachedDevices = null;
    this.lastDeviceCheck = 0;
  }

  /**
   * Cleanup resources
   */
  public async destroy(): Promise<void> {
    await this.stopRecording();
    // Clear device cache
    this.cachedDevices = null;
    this.lastDeviceCheck = 0;
  }
}
