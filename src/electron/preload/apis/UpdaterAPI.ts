import { contextBridge, ipcRenderer } from "electron";

export const UpdaterAPI = {
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateChecking: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("update:checking", handler);
    return () => ipcRenderer.removeListener("update:checking", handler);
  },
};

contextBridge.exposeInMainWorld("updater", {
  checkForUpdates: UpdaterAPI.checkForUpdates,
  downloadUpdate: UpdaterAPI.downloadUpdate,
  installUpdate: UpdaterAPI.installUpdate,
  onUpdateChecking: UpdaterAPI.onUpdateChecking,
});
