import { contextBridge, ipcRenderer } from "electron";

export const AuthAPI = {
  login: (creds: { email: string; password: string }) => ipcRenderer.invoke("auth:login", creds),
  logout: () => ipcRenderer.send("auth:clear"),
  /** Starts the OAuth "Continue in Browser" flow — opens system browser */
  startOAuthFlow: (provider: "google" | "github") =>
    ipcRenderer.invoke("auth:oauth-start", provider),
  /** Listen for OAuth completion event pushed from the main process */
  onOAuthComplete: (cb: (result: { success: boolean; error?: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, result: { success: boolean; error?: string }) =>
      cb(result);
    ipcRenderer.on("auth:oauth-complete", handler);
    // Return unsubscribe fn
    return () => ipcRenderer.removeListener("auth:oauth-complete", handler);
  },
};

contextBridge.exposeInMainWorld("auth", {
  login: AuthAPI.login,
  logout: AuthAPI.logout,
  startOAuthFlow: AuthAPI.startOAuthFlow,
  onOAuthComplete: AuthAPI.onOAuthComplete,
});
