import { BrowserWindow, ipcMain, screen } from "electron";
import { IPCHandler } from "../IPCHandlerRegistry.js";

export function getWindowIPCHandlers(mainWindow: BrowserWindow): IPCHandler[] {
  return [
    {
      channel: "window:fit",
      type: "on",
      handler: (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)!;
        const [w] = win.getContentSize();
        const { width: screenWidth, height: screenHeight } =
          screen.getPrimaryDisplay().workAreaSize;
        win.webContents
          .executeJavaScript(
            `
            (() => {
              const root = document.getElementById('root');
              if (!root) return 400;
              
              const mainContainer = document.querySelector('[data-main-container]');
              if (!mainContainer) return document.body.scrollHeight;
              
              const styleId = 'qluely-measure-style';
              let styleEl = document.getElementById(styleId);
              if (!styleEl) {
                  styleEl = document.createElement('style');
                  styleEl.id = styleId;
                  document.head.appendChild(styleEl);
              }
              
              styleEl.innerHTML = "[data-main-container], [data-main-container] .h-screen, [data-main-container] .h-full, [data-main-container] .flex-1, [data-main-container] .min-h-0, [data-main-container] .overflow-hidden, [data-main-container] .overflow-y-auto, [data-main-container] .overflow-auto { height: max-content !important; min-height: max-content !important; max-height: none !important; flex: none !important; overflow: visible !important; }";
              
              const actualHeight = mainContainer.scrollHeight;
              
              styleEl.innerHTML = '';
              
              return Math.ceil(actualHeight + 20);
            })()
          `,
          )
          .then((h) => {
            const parsedH = Number.isFinite(h) ? h : 420; // default height if invalid
            const minWidth = 400;
            const maxWidth = Math.min(1200, screenWidth - 100);
            const minHeight = 260; // Keep the window usable even when content is still mounting
            const maxHeight = Math.min(parsedH + 40, screenHeight - 100); // Add padding for better spacing
            const dynamicWidth = Math.max(minWidth, Math.min(w, maxWidth));
            const dynamicHeight = Math.max(minHeight, maxHeight);
            
            if (Number.isFinite(dynamicWidth) && Number.isFinite(dynamicHeight)) {
              win.setContentSize(Math.round(dynamicWidth), Math.round(dynamicHeight), true);
            }
          })
          .catch((error) => {
            const fallbackHeight = Math.min(420, screenHeight - 100);
            const safeW = Number.isFinite(w) ? w : 720;
            win.setContentSize(Math.min(safeW, 720), Math.round(fallbackHeight), true);
          });
      },
    },
    {
      channel: "window:set-content-protection",
      type: "handle",
      handler: (_, enable: boolean) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.setContentProtection(enable);
      },
    },
  ];
}
