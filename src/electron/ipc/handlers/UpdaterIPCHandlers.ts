import { IPCHandler } from "../IPCHandlerRegistry.js";
import { getAutoUpdaterService } from "../../main.js";

export function getUpdaterIPCHandlers(): IPCHandler[] {
  return [
    {
      channel: "update:check",
      type: "handle",
      handler: async () => {
        const autoUpdaterService = getAutoUpdaterService();
        return autoUpdaterService.checkForUpdates();
      },
    },
    {
      channel: "update:install",
      type: "handle",
      handler: async () => {
        const autoUpdaterService = getAutoUpdaterService();
        return autoUpdaterService.installUpdate();
      },
    },
    {
      channel: "update:download",
      type: "handle",
      handler: async () => {
        const autoUpdaterService = getAutoUpdaterService();
        return autoUpdaterService.downloadUpdate();
      },
    },
  ];
}
