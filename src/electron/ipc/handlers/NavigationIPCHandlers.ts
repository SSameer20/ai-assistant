import { IPCHandler } from "../IPCHandlerRegistry.js";
import { getNavigationService } from "../../main.js";

export function getNavigationIPCHandlers(): IPCHandler[] {
  return [
    {
      channel: "nav:to",
      type: "handle",
      handler: (_, route: string) => {
        const navService = getNavigationService();
        if (!navService) {
          return { success: false, error: "Navigation service not available" };
        }
        const ok = navService.navigate(route);
        return ok ? { success: true } : { success: false, error: "Navigation failed" };
      },
    },
  ];
}
