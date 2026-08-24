import { contextBridge, ipcRenderer } from "electron";

export const NavigationAPI = {
  to: (route: string) => ipcRenderer.invoke("nav:to", route),
  onChange: (cb: (route: string) => void) => {
    const handler = (_: unknown, r: string) => cb(r);
    ipcRenderer.on("nav:change", handler);
    return () => ipcRenderer.removeListener("nav:change", handler);
  },
};

contextBridge.exposeInMainWorld("nav", { to: NavigationAPI.to, onChange: NavigationAPI.onChange });
