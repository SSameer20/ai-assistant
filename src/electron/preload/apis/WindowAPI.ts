import { contextBridge, ipcRenderer } from "electron";

export const WindowAPI = {
  fitToContent: () => ipcRenderer.send("window:fit"),
  setContentProtection: (enable: boolean) =>
    ipcRenderer.invoke("window:set-content-protection", enable),
};

contextBridge.exposeInMainWorld("size", { fitToContent: WindowAPI.fitToContent });
contextBridge.exposeInMainWorld("protection", {
  setContentProtection: WindowAPI.setContentProtection,
});
