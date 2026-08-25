import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";
import electronMain from "electron/main";
const { app } = electronMain;
import { SystemAudioRecorder } from "../audio/SystemAudioRecorder.js";
import { FFmpegPathResolver } from "../lib/FFmpegPathResolver.js";

export interface AudioRecordingOptions {
  outputDir?: string;
  filename?: string;
  ffmpegArgs?: string[];
  chunkSeconds?: number;
}

export class AudioRecordingService {
  private ffmpeg: ChildProcessWithoutNullStreams | null = null;
  private outputPath: string = "";
  private isRecording: boolean = false;
  private chunkWatcher: fs.FSWatcher | null = null;
  private createdChunks: Set<string> = new Set();
  private systemAudioRecorder: SystemAudioRecorder;

  constructor() {
    this.systemAudioRecorder = new SystemAudioRecorder();
  }

  /**
   * Start audio recording session
   */
  public startRecording(options: AudioRecordingOptions = {}): string {
    if (this.isRecording) {
      throw new Error("Recording already in progress");
    }

    console.log("Local audio saving is disabled for meeting recording.");
    this.outputPath = "STREAM_ONLY";
    this.isRecording = true;

    return this.outputPath;
  }

  /**
   * Stop audio recording session
   */
  public stopRecording(): void {
    if (this.outputPath === "STREAM_ONLY") {
      this.isRecording = false;
      this.outputPath = "";
      return;
    }

    if (this.ffmpeg && this.isRecording) {
      this.ffmpeg.kill("SIGINT");
      this.ffmpeg = null;
      this.isRecording = false;
      // close any chunk watcher
      if (this.chunkWatcher) {
        try {
          this.chunkWatcher.close();
        } catch (e) {}
        this.chunkWatcher = null;
      }
      this.createdChunks.clear();
    }
  }

  /**
   * Process audio chunk (stub for future chunked streaming)
   */
  public processChunk(chunk: Buffer): void {
    console.log("recieved chunks");
    console.log(chunk);
    // Implement chunk processing logic if needed
    // e.g., send to AI, save to file, etc.
  }

  /**
   * Get current recording status
   */
  public getStatus(): { isRecording: boolean; outputPath: string } {
    return { isRecording: this.isRecording, outputPath: this.outputPath };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopRecording();
    this.systemAudioRecorder.destroy();
  }

  /**
   * Start recording system audio (Windows only)
   */
  public async startSystemAudioRecording(
    options: { outputDir?: string; filename?: string; quality?: "standard" | "high" } = {},
  ): Promise<string> {
    return this.systemAudioRecorder.startRecording(options);
  }

  /**
   * Stop recording system audio
   */
  public async stopSystemAudioRecording(): Promise<void> {
    return this.systemAudioRecorder.stopRecording();
  }

  /**
   * Get system audio recording status
   */
  public getSystemAudioStatus() {
    return this.systemAudioRecorder.getStatus();
  }

  /**
   * List available Windows audio devices
   */
  public async listAudioDevices() {
    return this.systemAudioRecorder.listAudioDevices();
  }

  /**
   * Invalidate device cache for forced refresh
   */
  public invalidateDeviceCache() {
    // Force cache invalidation in SystemAudioRecorder
    this.systemAudioRecorder.invalidateDeviceCache();
  }
}
