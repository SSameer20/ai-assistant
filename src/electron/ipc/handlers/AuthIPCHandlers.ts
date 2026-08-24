import { IPCHandler } from "../IPCHandlerRegistry.js";
import { getAuthenticationService, clearUser, connectWebSocket } from "../../main.js";

export function getAuthIPCHandlers(): IPCHandler[] {
  return [
    {
      channel: "auth:login",
      type: "handle",
      handler: async (_, creds) => {
        const authService = getAuthenticationService();
        if (!authService) {
          return { success: false, error: "Authentication service not available" };
        }
        const result = await authService.login(creds);
        if (result.success) {
          connectWebSocket();
        }
        return result;
      },
    },
    {
      channel: "auth:clear",
      type: "on",
      handler: () => {
        clearUser();
      },
    },
  ];
}
