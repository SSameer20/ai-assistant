import { contextBridge, ipcRenderer } from "electron";

export const AudioAPI = {
  captureMeeting: () => navigator.mediaDevices.getDisplayMedia({ video: false, audio: true }),
  sendChunk: (blob: Blob) => ipcRenderer.send("audio:chunk", blob),
  stop: () => ipcRenderer.send("audio:end"),
  startRecording: () => ipcRenderer.send("audio:start"),
  stopRecording: () => ipcRenderer.send("audio:stop"),
  onTranscript: (cb: (text: string) => void) => {
    const handler = (_: unknown, text: string) => cb(text);
    ipcRenderer.on("audio:transcript", handler);
    return () => ipcRenderer.removeListener("audio:transcript", handler);
  },
};

contextBridge.exposeInMainWorld("audio", {
  captureMeeting: AudioAPI.captureMeeting,
  sendChunk: AudioAPI.sendChunk,
  stop: AudioAPI.stop,
});
contextBridge.exposeInMainWorld("recorder", {
  start: AudioAPI.startRecording,
  stop: AudioAPI.stopRecording,
  onTranscript: AudioAPI.onTranscript,
});
