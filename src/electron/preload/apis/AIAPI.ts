import { contextBridge, ipcRenderer } from "electron";
import type { QluelyInput } from "../../types/protocol.js";

export const AIAPI = {
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
};

contextBridge.exposeInMainWorld("qluely", {
  start: AIAPI.start,
  onChunk: AIAPI.onChunk,
  onEnd: AIAPI.onEnd,
  onError: AIAPI.onError,
});
