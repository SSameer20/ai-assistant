import { IpcMain, IpcMainInvokeEvent, IpcMainEvent } from "electron";

export type IPCHandler = {
  channel: string;
  handler: (...args: any[]) => any;
  type?: "handle" | "on";
};

export class IPCHandlerRegistry {
  private ipcMain: IpcMain;
  private registered: Set<string> = new Set();

  constructor(ipcMain: IpcMain) {
    this.ipcMain = ipcMain;
  }

  /**
   * Register a list of IPC handlers with error boundaries
   */
  public registerHandlers(handlers: IPCHandler[]): void {
    for (const { channel, handler, type = "handle" } of handlers) {
      if (this.registered.has(channel)) {
        console.warn(`[IPCHandlerRegistry] Channel already registered: ${channel}`);
        continue;
      }
      if (type === "handle") {
        this.ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: any[]) => {
          try {
            return await handler(event, ...args);
          } catch (error) {
            console.error(`[IPCHandlerRegistry] Error in handler for ${channel}:`, error);
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });
      } else {
        this.ipcMain.on(channel, async (event: IpcMainEvent, ...args: any[]) => {
          try {
            await handler(event, ...args);
          } catch (error) {
            console.error(`[IPCHandlerRegistry] Error in handler for ${channel}:`, error);
            // Optionally send error to renderer
            event.sender.send(
              `${channel}:error`,
              error instanceof Error ? error.message : String(error),
            );
          }
        });
      }
      this.registered.add(channel);
    }
  }

  /**
   * Unregister all handlers (for hot reload or cleanup)
   */
  public unregisterAll(): void {
    for (const channel of this.registered) {
      this.ipcMain.removeHandler(channel);
      this.ipcMain.removeAllListeners(channel);
    }
    this.registered.clear();
  }
}
