import { IPCHandler } from "../IPCHandlerRegistry.js";
import { getAudioRecordingService, getWebSocketManager } from "../../main.js";
import path from "path";
import fs from "fs";
import { app } from "electron";

export function getAudioIPCHandlers(): IPCHandler[] {
  return [
    {
      channel: "record:start",
      type: "on",
      handler: () => {
        const audioService = getAudioRecordingService();
        try {
          audioService.startRecording();
        } catch (err) {
          // Optionally send error to renderer
        }
      },
    },
    {
      channel: "record:stop",
      type: "on",
      handler: () => {
        const audioService = getAudioRecordingService();
        audioService.stopRecording();
      },
    },
    {
      channel: "audio:chunk",
      type: "on",
      handler: (_, chunk: Buffer) => {
        const audioService = getAudioRecordingService();
        audioService.processChunk(chunk);
      },
    },
    {
      channel: "user-audio:chunk",
      type: "on",
      handler: (_, chunk: Buffer) => {
        const wsManager = getWebSocketManager();
        if (wsManager) {
          wsManager.sendUserAudioChunk(chunk);
        }
      },
    },
    // Save system audio recorded via loopback in renderer
    {
      channel: "system-audio:save",
      type: "handle",
      handler: async (
        _,
        buffer: Buffer,
        options?: { outputDir?: string; filename?: string; quality?: "standard" | "high" },
      ) => {
        try {
          const outputDir =
            options?.outputDir || path.join(app.getPath("downloads"), "SystemAudio");
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const filename = options?.filename || `system-audio-${timestamp}.webm`;
          const outputPath = path.join(outputDir, filename);

          fs.writeFileSync(outputPath, buffer);
          console.log(`System audio saved: ${outputPath} (${buffer.length} bytes)`);

          return { success: true, outputPath };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },
    // System audio recording handlers (legacy FFmpeg-based)
    {
      channel: "system-audio:start",
      type: "handle",
      handler: async (
        _,
        options: { outputDir?: string; filename?: string; quality?: "standard" | "high" },
      ) => {
        const audioService = getAudioRecordingService();
        try {
          const outputPath = await audioService.startSystemAudioRecording(options);
          return { success: true, outputPath };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },
    {
      channel: "system-audio:stop",
      type: "handle",
      handler: async () => {
        const audioService = getAudioRecordingService();
        try {
          await audioService.stopSystemAudioRecording();
          return { success: true };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      },
    },
    {
      channel: "system-audio:status",
      type: "handle",
      handler: () => {
        const audioService = getAudioRecordingService();
        return audioService.getSystemAudioStatus();
      },
    },
    {
      channel: "system-audio:list-devices",
      type: "handle",
      handler: async (_, forceRefresh = false) => {
        const audioService = getAudioRecordingService();
        try {
          // If force refresh, invalidate cache first
          if (forceRefresh) {
            audioService.invalidateDeviceCache();
          }
          const devices = await audioService.listAudioDevices();
          return { success: true, devices };
        } catch (error) {
          return { success: false, error: (error as Error).message, devices: [] };
        }
      },
    },
  ];
}
