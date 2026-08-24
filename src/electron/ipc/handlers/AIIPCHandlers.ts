import { IPCHandler } from "../IPCHandlerRegistry.js";
import { getAICommunicationService } from "../../main.js";
import type { QluelyInput } from "../../types/protocol.js";

export function getAIIPCHandlers(): IPCHandler[] {
  return [
    {
      channel: "ai:start",
      type: "on",
      handler: async (event, input: QluelyInput) => {
        const aiService = getAICommunicationService();
        if (!aiService.validateInput(input)) {
          event.sender.send("ai:error", "Invalid input format");
          return;
        }
        const result = await aiService.startAIQuery(input);
        if (!result.success && result.error) {
          event.sender.send("ai:error", result.error);
        }
      },
    },
  ];
}
