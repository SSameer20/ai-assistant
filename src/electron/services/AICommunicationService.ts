import { QluelyInput, QluelyChunk, QluelyError } from "../types/protocol.js";
import WebSocket from "ws";

export interface AIMessagePayload {
  type: string;
  data: any;
  metadata: { userId: string; idempotencyKey: string; timestamp: string };
}

export interface AIStreamChunk {
  chunk: string;
}

export interface AIError {
  error: string;
  code?: string;
}

export interface AICommunicationConfig {
  maxRetries?: number;
  retryDelay?: number;
  requestTimeout?: number;
}

export class AICommunicationService {
  private webSocketManager: any;
  private authService: any;
  private windowManager: any;
  private config: AICommunicationConfig;

  constructor(
    webSocketManager: any,
    authService: any,
    windowManager: any,
    config: Partial<AICommunicationConfig> = {},
  ) {
    this.webSocketManager = webSocketManager;
    this.authService = authService;
    this.windowManager = windowManager;
    this.config = { maxRetries: 3, retryDelay: 1000, requestTimeout: 30000, ...config };

    console.log("AICommunicationService initialized", this.config);
  }

  /**
   * Start an AI conversation with the provided input
   */
  public async startAIQuery(input: QluelyInput): Promise<{ success: boolean; error?: string }> {
    try {
      // Check authentication
      if (!this.authService.isAuthenticated()) {
        const error = "User not authenticated";
        this.notifyError(error);
        return { success: false, error };
      }

      // Check WebSocket connection
      const socket = this.webSocketManager?.getSocket();
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        const error = "WebSocket not connected";
        this.notifyError(error);
        return { success: false, error };
      }

      // Create payload based on input type
      const payload = this.createPayload(input);
      if (!payload) {
        const error = "Invalid input type";
        this.notifyError(error);
        return { success: false, error };
      }

      // Create envelope with metadata
      const envelope = this.createEnvelope(payload);

      // Send message via WebSocketManager so meetingId metadata is attached
      this.webSocketManager?.sendMessage(envelope);

      console.log("AI query started successfully", {
        type: input.type,
        hasText: !!input.text,
        hasImage: !!(input as any).image,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("AI query failed:", error);
      this.notifyError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create message payload based on input type
   */
  private createPayload(input: QluelyInput): any {
    switch (input.type) {
      case "text":
        return { type: "user:message", data: { text: input.text } };

      case "image":
        return {
          type: "user:image",
          data: {
            text: input.text,
            image: { mimeType: input.image.mimeType, base64: input.image.base64 },
          },
        };

      case "mixed":
        return {
          type: "user:media",
          data: {
            text: input.text,
            image: { mimeType: input.image.mimeType, base64: input.image.base64 },
          },
        };

      default:
        console.error("Unknown input type:", (input as any).type);
        return null;
    }
  }

  /**
   * Create message envelope with metadata
   */
  private createEnvelope(payload: any): AIMessagePayload {
    const user = this.authService?.getCurrentSession();

    return {
      ...payload,
      metadata: {
        userId: user?.userId || "",
        idempotencyKey: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Notify renderer of AI error
   */
  private notifyError(error: string): void {
    try {
      this.windowManager?.sendMessage("ai:error", error);
    } catch (err) {
      console.error("Failed to send AI error notification:", err);
    }
  }

  /**
   * Validate input format
   */
  public validateInput(input: any): input is QluelyInput {
    if (!input || typeof input !== "object") {
      return false;
    }

    if (!input.type || !input.text) {
      return false;
    }

    switch (input.type) {
      case "text":
        return typeof input.text === "string";

      case "image":
      case "mixed":
        return (
          typeof input.text === "string" &&
          input.image &&
          typeof input.image.mimeType === "string" &&
          typeof input.image.base64 === "string"
        );

      default:
        return false;
    }
  }

  /**
   * Format error for frontend consumption
   */
  public formatError(error: unknown): QluelyError {
    if (error instanceof Error) {
      return { message: error.message };
    }

    if (typeof error === "string") {
      return { message: error };
    }

    return { message: "Unknown error occurred" };
  }

  /**
   * Check if AI service is ready
   */
  public isReady(): boolean {
    const isAuthenticated = this.authService?.isAuthenticated();
    const socket = this.webSocketManager?.getSocket();
    const isConnected = socket && socket.readyState === WebSocket.OPEN;

    return isAuthenticated && isConnected;
  }

  /**
   * Get current service status
   */
  public getStatus(): { authenticated: boolean; connected: boolean; ready: boolean } {
    const authenticated = this.authService?.isAuthenticated() || false;
    const socket = this.webSocketManager?.getSocket();
    const connected = socket && socket.readyState === WebSocket.OPEN;

    return { authenticated, connected: !!connected, ready: authenticated && !!connected };
  }

  /**
   * Get configuration
   */
  public getConfig(): AICommunicationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<AICommunicationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("AICommunicationService configuration updated", this.config);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    // No resources to cleanup currently
    console.log("AICommunicationService: Cleaned up resources");
  }
}
