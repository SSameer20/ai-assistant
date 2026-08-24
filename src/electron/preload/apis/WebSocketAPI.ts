import { contextBridge, ipcRenderer } from "electron";

export const WebSocketAPI = {
  onConnectionChange: (cb: (connected: boolean) => void) => {
    const handler = (_: unknown, connected: boolean) => cb(connected);
    ipcRenderer.on("ws:connection-change", handler);
    return () => ipcRenderer.removeListener("ws:connection-change", handler);
  },
};

contextBridge.exposeInMainWorld("websocket", {
  onConnectionChange: WebSocketAPI.onConnectionChange,
});
