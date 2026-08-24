import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { QluelyInput } from "./types/protocol.js";

contextBridge.exposeInMainWorld("qluely", {
  start: (payload: QluelyInput) => ipcRenderer.send("ai:start", payload),

  onChunk: (cb: (chunk: string) => void) => {
    const handler = (_: unknown, chunk: string) => cb(chunk);
    ipcRenderer.on("ai:chunk", handler);
    return () => ipcRenderer.removeListener("ai:chunk", handler);
  },

  onEnd: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("ai:end", handler);
    return () => ipcRenderer.removeListener("ai:end", handler);
  },

  onError: (cb: (message: string) => void) => {
    const handler = (_: unknown, message: string) => cb(message);
    ipcRenderer.on("ai:error", handler);
    return () => ipcRenderer.removeListener("ai:error", handler);
  },
});
contextBridge.exposeInMainWorld("overlay", {
  enableClickThrough: () => ipcRenderer.invoke("overlay:set-click-through", true),
  disableClickThrough: () => ipcRenderer.invoke("overlay:set-click-through", false),
  onForceDisable: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("interactive-mode:force-disable", handler);
    return () => ipcRenderer.removeListener("interactive-mode:force-disable", handler);
  },
});

contextBridge.exposeInMainWorld("protection", {
  setContentProtection: (enable: boolean) =>
    ipcRenderer.invoke("window:set-content-protection", enable),
});

contextBridge.exposeInMainWorld("size", { fitToContent: () => ipcRenderer.send("window:fit") });
contextBridge.exposeInMainWorld("audio", {
  captureMeeting: () => navigator.mediaDevices.getDisplayMedia({ video: false, audio: true }),
  sendChunk: (blob: Blob) => ipcRenderer.send("audio:chunk", blob),
  stop: () => ipcRenderer.send("audio:end"),
});
type TranscriptCallback = (text: string) => void;

// Screen capture API
contextBridge.exposeInMainWorld("screenAPI", {
  capture: async () => {
    const result = await ipcRenderer.invoke("capture:screen");
    if (result && result.success && typeof result.dataUrl === "string") {
      return result.dataUrl;
    } else {
      throw new Error(result?.error || "Screen capture failed");
    }
  },
  captureWithOptions: async (options: any) => {
    const result = await ipcRenderer.invoke("capture:screen-with-options", options);
    if (result && result.success && typeof result.dataUrl === "string") {
      return result.dataUrl;
    } else {
      throw new Error(result?.error || "Screen capture failed");
    }
  },
  getSources: () => ipcRenderer.invoke("capture:sources"),
  getWindows: () => ipcRenderer.invoke("capture:windows"),
  captureSource: (sourceId: string, options?: any) =>
    ipcRenderer.invoke("capture:source", sourceId, options),
  getDisplayInfo: () => ipcRenderer.invoke("capture:display-info"),

  onCaptureError: (cb: (error: string) => void) => {
    const handler = (_: unknown, error: string) => cb(error);
    ipcRenderer.on("capture:error", handler);
    return () => ipcRenderer.removeListener("capture:error", handler);
  },
});

// navigation
contextBridge.exposeInMainWorld("nav", {
  to: (route: string) => ipcRenderer.invoke("nav:to", route),
  onChange: (cb: (route: string) => void) => {
    const handler = (_: unknown, r: string) => cb(r);
    ipcRenderer.on("nav:change", handler);
    return () => ipcRenderer.removeListener("nav:change", handler);
  },
});

contextBridge.exposeInMainWorld("auth", {
  login: (creds: { email: string; password: string }) => ipcRenderer.invoke("auth:login", creds),
  logout: () => ipcRenderer.send("auth:clear"),
  completeOnboarding: (data?: { role?: string; useCases?: string[] }) =>
    ipcRenderer.invoke("auth:complete-onboarding", data),
  getUserDetails: () => ipcRenderer.invoke("auth:get-user-details"),

  // OAuth 2.0 + PKCE
  startOAuthFlow: (provider: "google" | "github") =>
    ipcRenderer.invoke("auth:oauth-start", provider),

  onOAuthComplete: (cb: (result: { success: boolean; error?: string }) => void) => {
    const handler = (_: unknown, result: { success: boolean; error?: string }) => cb(result);
    ipcRenderer.on("auth:oauth-complete", handler);
    return () => ipcRenderer.removeListener("auth:oauth-complete", handler);
  },
});
// Quota Events API
contextBridge.exposeInMainWorld("quota", {
  onAlert: (cb: (event: any) => void) => {
    const handler = (_: unknown, event: any) => cb(event);
    ipcRenderer.on("quota:alert", handler);
    return () => ipcRenderer.removeListener("quota:alert", handler);
  },
  onExhausted: (cb: (event: any) => void) => {
    const handler = (_: unknown, event: any) => cb(event);
    ipcRenderer.on("quota:exhausted", handler);
    return () => ipcRenderer.removeListener("quota:exhausted", handler);
  },
});

// Auto-updater API
contextBridge.exposeInMainWorld("updater", {
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),

  onUpdateChecking: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("update:checking", handler);
    return () => ipcRenderer.removeListener("update:checking", handler);
  },

  onUpdateAvailable: (cb: (info: any) => void) => {
    const handler = (_: unknown, info: any) => cb(info);
    ipcRenderer.on("update:available", handler);
    return () => ipcRenderer.removeListener("update:available", handler);
  },

  onUpdateNotAvailable: (cb: (info: any) => void) => {
    const handler = (_: unknown, info: any) => cb(info);
    ipcRenderer.on("update:not-available", handler);
    return () => ipcRenderer.removeListener("update:not-available", handler);
  },

  onUpdateError: (cb: (error: string) => void) => {
    const handler = (_: unknown, error: string) => cb(error);
    ipcRenderer.on("update:error", handler);
    return () => ipcRenderer.removeListener("update:error", handler);
  },

  onDownloadProgress: (cb: (progress: any) => void) => {
    const handler = (_: unknown, progress: any) => cb(progress);
    ipcRenderer.on("update:download-progress", handler);
    return () => ipcRenderer.removeListener("update:download-progress", handler);
  },

  onUpdateDownloaded: (cb: (info: any) => void) => {
    const handler = (_: unknown, info: any) => cb(info);
    ipcRenderer.on("update:downloaded", handler);
    return () => ipcRenderer.removeListener("update:downloaded", handler);
  },
});

contextBridge.exposeInMainWorld("permissions", {
  getStatus: (type: "microphone" | "camera" | "screen") =>
    ipcRenderer.invoke("permissions:get-status", type),
  request: (type: "microphone" | "camera") => ipcRenderer.invoke("permissions:request", type),
  openSettings: (type: "microphone" | "screen") =>
    ipcRenderer.invoke("permissions:open-settings", type),
});

// System audio loopback recording (uses electron-audio-loopback)
let loopbackRecorder: MediaRecorder | null = null;
let loopbackChunks: Blob[] = [];
let loopbackStream: MediaStream | null = null;
let recordingStartTime: number | null = null;
let wavAudioContext: AudioContext | null = null;
let wavSourceNode: MediaStreamAudioSourceNode | null = null;
let wavProcessorNode: ScriptProcessorNode | null = null;
const SILENCE_THRESHOLD = 0.01; // RMS threshold
let isSystemAudioInitialized = false;
let isSystemRecordingActive = false;

/**
 * Calculate Root Mean Square (RMS) of PCM samples to detect silence.
 */
function isSilent(pcm: Float32Array): boolean {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    sum += pcm[i] * pcm[i];
  }
  const rms = Math.sqrt(sum / pcm.length);
  return rms < SILENCE_THRESHOLD;
}

/**
 * Convert Float32 PCM samples to a WAV ArrayBuffer (16-bit, mono).
 */
function pcmToWav(pcm: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = pcm.length * bytesPerSample;
  const bufferLength = 44 + dataLength;

  const ab = new ArrayBuffer(bufferLength);
  const view = new DataView(ab);

  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, bufferLength - 8, true);
  writeStr(view, 8, "WAVE");

  // fmt sub-chunk
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeStr(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Write PCM samples as int16
  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return ab;
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function doSystemAudioInit() {
  if (isSystemAudioInitialized) return { success: true };
  try {
    const hasPermission = await ipcRenderer.invoke("permissions:ensure-screen");
    if (!hasPermission) {
      return {
        success: false,
        error: "Permission denied: Screen recording (system audio) access is required.",
      };
    }

    await ipcRenderer.invoke("enable-loopback-audio");
    const stream: MediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    stream.getVideoTracks().forEach((track) => {
      track.stop();
      stream.removeTrack(track);
    });
    await ipcRenderer.invoke("disable-loopback-audio");
    loopbackStream = stream;

    const WAV_SAMPLE_RATE = 16000;
    wavAudioContext = new AudioContext({ sampleRate: WAV_SAMPLE_RATE });
    wavSourceNode = wavAudioContext.createMediaStreamSource(stream);
    wavProcessorNode = wavAudioContext.createScriptProcessor(4096, 1, 1);

    await wavAudioContext.suspend();

    let pcmBuffers: Float32Array[] = [];
    let lastSendTime = Date.now();

    wavProcessorNode.onaudioprocess = (e) => {
      if (!isSystemRecordingActive) return;
      const inputData = e.inputBuffer.getChannelData(0);
      pcmBuffers.push(new Float32Array(inputData));

      const now = Date.now();
      if (now - lastSendTime >= 1200) {
        const totalLen = pcmBuffers.reduce((a, c) => a + c.length, 0);
        const combined = new Float32Array(totalLen);
        let off = 0;
        for (const buf of pcmBuffers) {
          combined.set(buf, off);
          off += buf.length;
        }
        pcmBuffers = [];
        lastSendTime = now;

        if (!isSilent(combined)) {
          const wavArrayBuffer = pcmToWav(combined, WAV_SAMPLE_RATE);
          const wavBuffer = Buffer.from(wavArrayBuffer);
          ipcRenderer.send("audio:chunk", wavBuffer);
        } else {
          console.log("Skipping silent audio chunk");
        }
      }
    };

    wavSourceNode.connect(wavProcessorNode);
    wavProcessorNode.connect(wavAudioContext.destination);

    isSystemAudioInitialized = true;
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to init loopback recording";
    console.error("Loopback init error:", error);
    return { success: false, error: message };
  }
}

contextBridge.exposeInMainWorld("systemAudio", {
  init: () => doSystemAudioInit(),
  startRecording: async (options?: {
    outputDir?: string;
    filename?: string;
    quality?: "standard" | "high";
  }) => {
    try {
      if (!isSystemAudioInitialized) {
        const res = await doSystemAudioInit();
        if (!res.success) return res;
      }
      if (wavAudioContext && (wavAudioContext as any).state === "suspended") {
        await (wavAudioContext as any).resume();
      }
      isSystemRecordingActive = true;
      recordingStartTime = Date.now();
      return { success: true, outputPath: "Recording in progress..." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start loopback recording";
      console.error("Loopback recording error:", error);
      return { success: false, error: message };
    }
  },

  stopRecording: async () => {
    try {
      isSystemRecordingActive = false;
      recordingStartTime = null;
      if (wavAudioContext && (wavAudioContext as any).state === "running") {
        await (wavAudioContext as any).suspend();
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to stop recording";
      return { success: false, error: message };
    }
  },

  getStatus: () => {
    const isRecording = isSystemRecordingActive;
    return {
      isRecording,
      outputPath: "",
      startTime: recordingStartTime,
      duration: recordingStartTime ? Date.now() - recordingStartTime : 0,
    };
  },

  listDevices: (forceRefresh?: boolean) =>
    ipcRenderer.invoke("system-audio:list-devices", forceRefresh),

  getPlatform: () => process.platform,
});

// Transcription API — receive live transcriptions from the server
contextBridge.exposeInMainWorld("transcription", {
  onTranscript: (cb: (text: string) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, text: string) => cb(text);
    ipcRenderer.on("system:audio:chunk", handler);
    return () => {
      ipcRenderer.removeListener("system:audio:chunk", handler);
    };
  },
  sendAudioMessage: (text: string) => ipcRenderer.send("transcription:send-audio-message", text),
});

contextBridge.exposeInMainWorld("electron", {
  shell: {
    showItemInFolder: (path: string) => ipcRenderer.invoke("shell:show-item-in-folder", path),
    openPath: (path: string) => ipcRenderer.invoke("shell:open-path", path),
    openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  },
});

contextBridge.exposeInMainWorld("app", { quit: () => ipcRenderer.invoke("app:quit") });

// User microphone audio recording
let userAudioStream: MediaStream | null = null;
let userAudioContext: AudioContext | null = null;
let userSourceNode: MediaStreamAudioSourceNode | null = null;
let userProcessorNode: ScriptProcessorNode | null = null;
let isUserAudioInitialized = false;
let isUserRecordingActive = false;

async function doUserAudioInit() {
  if (isUserAudioInitialized) return { success: true };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    userAudioStream = stream;

    const WAV_SAMPLE_RATE = 16000;
    userAudioContext = new AudioContext({ sampleRate: WAV_SAMPLE_RATE });
    userSourceNode = userAudioContext.createMediaStreamSource(stream);
    userProcessorNode = userAudioContext.createScriptProcessor(4096, 1, 1);

    await (userAudioContext as any).suspend();

    let pcmBuffers: Float32Array[] = [];
    let lastSendTime = Date.now();

    userProcessorNode.onaudioprocess = (e: any) => {
      if (!isUserRecordingActive) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      pcmBuffers.push(new Float32Array(inputData));

      const now = Date.now();
      if (now - lastSendTime >= 1200) {
        const totalLen = pcmBuffers.reduce((a: any, c: any) => a + c.length, 0);
        const combined = new Float32Array(totalLen);
        let off = 0;
        for (const buf of pcmBuffers) {
          combined.set(buf, off);
          off += buf.length;
        }
        pcmBuffers = [];
        lastSendTime = now;

        if (!isSilent(combined)) {
          const wavArrayBuffer = pcmToWav(combined, WAV_SAMPLE_RATE);
          const wavBuffer = Buffer.from(wavArrayBuffer);
          ipcRenderer.send("audio:chunk", wavBuffer);
        } else {
          console.log("Skipping silent user microphone chunk");
        }
      }
    };

    userSourceNode.connect(userProcessorNode);
    userProcessorNode.connect(userAudioContext.destination);

    isUserAudioInitialized = true;
    return { success: true };
  } catch (error) {
    console.error("User audio init error:", error);
    return { success: false, error: (error as Error).message };
  }
}

contextBridge.exposeInMainWorld("userAudio", {
  init: () => doUserAudioInit(),
  start: async () => {
    try {
      if (!isUserAudioInitialized) {
        const res = await doUserAudioInit();
        if (!res.success) return res;
      }
      if (userAudioContext && (userAudioContext as any).state === "suspended") {
        await (userAudioContext as any).resume();
      }
      isUserRecordingActive = true;
      return { success: true };
    } catch (error) {
      console.error("User audio recording error:", error);
      return { success: false, error: (error as Error).message };
    }
  },

  stop: async () => {
    try {
      isUserRecordingActive = false;
      if (userAudioContext && (userAudioContext as any).state === "running") {
        await (userAudioContext as any).suspend();
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
});
