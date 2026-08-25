import WebSocket from "ws";
import { app } from "electron";
import Store from "electron-store";
import { WsEventType } from "../types/helper.js";
import { API, CONFIG_API } from "../config/api.js";

export interface WebSocketManagerOptions {
  store: Store;
  onMessage?: (channel: string, ...args: any[]) => void;
  onAuthExpired?: () => void;
  onConnectionStateChange?: (connected: boolean) => void;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  metadata?: { userId?: string; meetingId: string; [key: string]: any };
}

export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private store: Store;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 5;
  private currentUrlIndex: number = 0;
  private isLoggingOut: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private onMessage?: (channel: string, ...args: any[]) => void;
  private onAuthExpired?: () => void;
  private onConnectionStateChange?: (connected: boolean) => void;

  constructor(options: WebSocketManagerOptions) {
    this.store = options.store;
    this.onMessage = options.onMessage;
    this.onAuthExpired = options.onAuthExpired;
    this.onConnectionStateChange = options.onConnectionStateChange;
  }

  /**
   * Gets available WebSocket URLs (main + fallbacks)
   */
  private getWebSocketUrls(): string[] {
    const config = app.isPackaged ? CONFIG_API.prod : CONFIG_API.dev;
    const urls = [config.ws];

    // Add fallback URLs if available (for production)
    if (app.isPackaged && (CONFIG_API.prod as any).wsFallbacks) {
      urls.push(...(CONFIG_API.prod as any).wsFallbacks);
    }

    return urls;
  }

  public connect(): void {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)
    ) {
      console.log("WebSocket already connected or connecting");
      return;
    }

    // Check if we've exceeded maximum connection attempts
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.log("Maximum connection attempts reached");
      this.setConnectionState(ConnectionState.FAILED);
      this.onMessage?.("connection:failed", "Unable to connect to server");
      return;
    }

    const token = this.store.get("jwt") as string;
    if (!token) {
      console.log("No JWT token found, skipping WebSocket connection");
      this.setConnectionState(ConnectionState.DISCONNECTED);
      this.onConnectionStateChange?.(false);
      return;
    }

    this.closeExistingConnection();

    const urls = this.getWebSocketUrls();
    const currentUrl = urls[this.currentUrlIndex] || urls[0];

    this.connectionAttempts++;
    console.log(
      `WebSocket connection attempt ${this.connectionAttempts}/${this.maxConnectionAttempts} to ${currentUrl}`,
    );

    try {
      this.setConnectionState(ConnectionState.CONNECTING);
      const url = `${currentUrl}${API.auth}?token=${token}`;
      console.log("Connecting to WebSocket URL:", url);

      this.socket = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.handleConnectionError();
    }
  }

  /**
   * Sets up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("open", this.handleOpen.bind(this));
    this.socket.on("message", this.handleMessage.bind(this));
    this.socket.on("close", this.handleClose.bind(this));
    this.socket.on("error", this.handleError.bind(this));
  }

  /**
   * Handles WebSocket open event
   */
  private handleOpen(): void {
    console.log("WebSocket connected successfully");
    this.setConnectionState(ConnectionState.CONNECTED);

    // Reset connection tracking on successful connection
    this.connectionAttempts = 0;
    this.currentUrlIndex = 0;

    // Send a ping to test the connection
    this.sendPing();

    this.onConnectionStateChange?.(true);
  }

  /**
   * Handles incoming WebSocket messages
   */
  private handleMessage(raw: WebSocket.RawData): void {
    try {
      const message: WebSocketMessage = JSON.parse(raw.toString());
      this.routeMessage(message);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
      this.onMessage?.("ai:error", "Failed to parse server response");
    }
  }

  /**
   * Routes incoming messages to appropriate handlers
   */
  private routeMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case WsEventType.SYSTEM_MESSAGE:
        this.handleSystemMessage(message);
        break;

      case WsEventType.SYSTEM_MESSAGE_START:
        // Stream starting
        break;

      case WsEventType.SYSTEM_MESSAGE_CHUNK:
        if (message.data?.chunk) {
          this.onMessage?.("ai:chunk", message.data.chunk);
        }
        break;

      case WsEventType.SYSTEM_MESSAGE_END:
        this.onMessage?.("ai:end");
        break;

      case WsEventType.SYSTEM_ERROR:
        this.onMessage?.("ai:error", message.data?.error || "Unknown error");
        break;

      case WsEventType.AUTH_EXPIRED:
        this.handleAuthExpired();
        break;

      case WsEventType.SYSTEM_PING:
        // Handle ping if needed
        break;

      case WsEventType.SYSTEM_QUOTA_ALERT:
        this.onMessage?.("quota:alert", { type: message.type, data: message.data });
        break;

      case WsEventType.SYSTEM_QUOTA_EXHAUSTED:
        this.onMessage?.("quota:exhausted", { type: message.type, data: message.data });
        break;


      case WsEventType.SYSTEM_AUDIO_CHUNK:
        if (message.data?.chunk) {
          console.log(`[AUDIO_TRANSCRIPTION] ${message.data?.chunk}`)
          this.onMessage?.("system:audio:chunk", message.data.chunk);
        }
        break;

      default:
        console.log("Unhandled WebSocket message:", message.type);
    }
  }

  /**
   * Handles system messages
   */
  private handleSystemMessage(message: WebSocketMessage): void {
    // Store userId from welcome message
    if (message.metadata?.userId) {
      this.store.set("userId", message.metadata.userId);
    }

    if (message.data?.text === "welcome") {
      const meetingId = message?.metadata?.meetingId;

      // Persist meetingId to store and notify renderer
      try {
        const currentMeetingId = (this.store.get("meetingId") as string) || undefined;

        if (typeof meetingId === "string" && meetingId.length > 0) {
          if (currentMeetingId && currentMeetingId !== meetingId) {
            try {
              this.store.delete("meetingId");
            } catch (err) {
              console.warn("Failed to delete previous meetingId from store:", err);
            }
          }

          this.store.set("meetingId", meetingId);
          this.onMessage?.("meeting:update", { meetingId, previousMeetingId: currentMeetingId });
        }
      } catch (err) {
        console.error("Failed to persist meetingId:", err);
      }

      console.log("Received welcome message");
    }
  }

  /**
   * Handles authentication expiration
   */
  private handleAuthExpired(): void {
    console.log("Authentication expired");
    this.onAuthExpired?.();
  }

  /**
   * Handles WebSocket close event
   */
  private handleClose(code: number, reason: Buffer): void {
    console.log("WebSocket closed:", { code, reason: reason?.toString() });

    this.logCloseCode(code);
    // Remove meetingId from store on connection close and notify renderer
    try {
      const currentMeetingId = (this.store.get("meetingId") as string) || undefined;
      if (currentMeetingId) {
        try {
          this.store.delete("meetingId");
        } catch (err) {
          console.warn("Failed to delete meetingId from store on close:", err);
        }
        this.onMessage?.("meeting:update", { meetingId: "", previousMeetingId: currentMeetingId });
      }
    } catch (err) {
      console.warn("Error while removing meetingId on WebSocket close:", err);
    }

    this.socket = null;
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.onConnectionStateChange?.(false);

    // Handle different close codes appropriately
    if (code === 1000) {
      console.log("WebSocket closed normally, not auto-reconnecting");
      return;
    }

    // If unauthorized, handle authentication failure
    if (code === 4001 || code === 1003) {
      console.log("Authentication failed");
      this.handleAuthExpired();
      return;
    }

    // Auto-reconnect for unexpected closures
    this.scheduleReconnect(code);
  }

  /**
   * Logs the meaning of close codes
   */
  private logCloseCode(code: number): void {
    const codes: { [key: number]: string } = {
      1000: "Normal closure",
      1001: "Going away",
      1002: "Protocol error",
      1003: "Unsupported data type",
      1005: "No status received (abnormal closure)",
      1006: "Abnormal closure",
      1011: "Internal server error",
      4001: "Unauthorized (invalid token)",
    };

    const meaning = codes[code] || "Unknown";
    console.log(`Close code ${code}: ${meaning}`);
  }

  /**
   * Schedules a reconnection attempt
   */
  private scheduleReconnect(code: number): void {
    if (this.isLoggingOut || !this.store.get("jwt")) {
      return;
    }

    const delay = code === 1005 ? 2000 : 5000; // Shorter delay for no-status closures
    console.log(
      `WebSocket closed unexpectedly (code: ${code}), auto-reconnecting in ${delay / 1000} seconds...`,
    );

    this.setConnectionState(ConnectionState.RECONNECTING);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Handles WebSocket error event
   */
  private handleError(error: Error): void {
    console.error("WebSocket error:", error);

    // Check if this is a connection refused error
    if ((error as any).code === "ECONNREFUSED") {
      console.log("Connection refused, trying next WebSocket URL...");
      this.tryNextUrl();
      return;
    }

    // General error handling with reconnection
    if (!this.isLoggingOut && this.store.get("jwt")) {
      console.log("WebSocket error - will retry connection in 10 seconds...");

      setTimeout(() => {
        if (
          !this.isLoggingOut &&
          this.store.get("jwt") &&
          (!this.socket || this.socket.readyState === WebSocket.CLOSED)
        ) {
          this.connect();
        }
      }, 10000);
    }
  }

  /**
   * Tries the next URL in the fallback list
   */
  private tryNextUrl(): void {
    const urls = this.getWebSocketUrls();
    this.currentUrlIndex = (this.currentUrlIndex + 1) % urls.length;

    // If we've tried all URLs, reset and increment attempt counter
    if (this.currentUrlIndex === 0) {
      this.connectionAttempts++;
    }

    // Add a small delay before trying the next URL
    setTimeout(() => {
      if (!this.isLoggingOut && this.store.get("jwt")) {
        this.connect();
      }
    }, 1000);
  }

  /**
   * Handles connection errors
   */
  private handleConnectionError(): void {
    this.setConnectionState(ConnectionState.DISCONNECTED);

    if (!this.isLoggingOut && this.store.get("jwt")) {
      setTimeout(() => this.connect(), 5000);
    }
  }

  /**
   * Closes existing WebSocket connection
   */
  private closeExistingConnection(): void {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        if (
          this.socket.readyState !== WebSocket.CLOSED &&
          this.socket.readyState !== WebSocket.CLOSING
        ) {
          this.socket.close();
        }
      } catch (error) {
        console.error("Error closing existing WebSocket:", error);
      }
      this.socket = null;
    }
  }

  /**
   * Sends a message through the WebSocket
   */
  public sendMessage(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        let toSend = message;

        // If message is an object, ensure metadata includes meetingId
        if (typeof message !== "string" && message !== null && typeof message === "object") {
          try {
            const meetingId = (this.store.get("meetingId") as string) || undefined;
            const existingMetadata =
              message.metadata && typeof message.metadata === "object"
                ? { ...message.metadata }
                : {};
            toSend = {
              ...message,
              metadata: { ...existingMetadata, ...(meetingId ? { meetingId } : {}) },
            };
          } catch (err) {
            console.warn("Failed to attach meetingId to outgoing message:", err);
            toSend = message;
          }
        }

        const payload = typeof toSend === "string" ? toSend : JSON.stringify(toSend);
        this.socket.send(payload);
      } catch (error) {
        console.error("Failed to send WebSocket message:", error);
      }
    } else {
      console.warn("Cannot send message: WebSocket not connected");
    }
  }

  /**
   * Sends a ping message
   */
  public sendPing(): void {
    this.sendMessage({ type: "ping" });
  }

  /**
   * Send an audio chunk as a single binary envelope:
   * [4-byte BE header length][header JSON utf8][raw audio bytes]
   * Header will contain: { type: WsEventType.USER_AUDIO_CHUNK, data: { audio: { byteLength } }, metadata }
   */
  public sendAudioChunk(metadata: { [key: string]: any } = {}, chunk: Buffer | Uint8Array): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send audio chunk: WebSocket not connected");
      return;
    }

    try {
      const header = {
        type: WsEventType.USER_AUDIO_CHUNK,
        data: { audio: { byteLength: (chunk as any)?.length ?? 0 } },
        metadata: {
          ...(metadata || {}),
          userId: this.store.get("userId"),
          meetingId: (this.store.get("meetingId") as string) || undefined,
        },
      };

      const headerJson = JSON.stringify(header);
      const headerBuf = Buffer.from(headerJson, "utf8");
      const headerLenBuf = Buffer.allocUnsafe(4);
      headerLenBuf.writeUInt32BE(headerBuf.length, 0);

      const audioBuf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const payload = Buffer.concat([headerLenBuf, headerBuf, audioBuf]);

      console.log("Sending audio chunk", {
        type: header.type,
        userId: header.metadata.userId,
        headerBytes: headerBuf.length,
        audioBytes: audioBuf.length,
      });

      // Provide a callback to log send result
      this.socket.send(payload, (err?: Error) => {
        if (err) {
          console.error("WebSocket send error for audio chunk:", err);
        } else {
          console.log("Audio chunk sent", { audioBytes: audioBuf.length });
        }
      });
    } catch (error) {
      console.error("Failed to send audio chunk:", error);
    }
  }

  /**
   * Send user audio chunk as JSON with base64 encoded audio
   */
  public sendUserAudioChunk(chunk: Buffer | Uint8Array): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send user audio chunk: WebSocket not connected");
      return;
    }

    try {
      const audioBuf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const base64Audio = audioBuf.toString("base64");

      const message = {
        type: WsEventType.USER_AUDIO_CHUNK,
        data: {
          chunk: base64Audio,
          type: "audio/wav",
        },
      };

      this.sendMessage(message);
    } catch (error) {
      console.error("Failed to send user audio chunk:", error);
    }
  }

  /**
   * Send user transcription message
   */
  public sendUserTranscriptionMessage(transcription: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send user transcription: WebSocket not connected");
      return;
    }

    try {
      const message = {
        type: WsEventType.USER_TRANSCRIPTION,
        data: {
          transcription,
        },
      };

      this.sendMessage(message);
    } catch (error) {
      console.error("Failed to send user transcription:", error);
    }
  }

  /**
   * Disconnects the WebSocket
   */
  public disconnect(): void {
    this.isLoggingOut = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.closeExistingConnection();
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.onConnectionStateChange?.(false);
  }

  /**
   * Resets the logout state to allow reconnections
   */
  public resetLogoutState(): void {
    this.isLoggingOut = false;
    this.connectionAttempts = 0;
    this.currentUrlIndex = 0;
  }

  /**
   * Gets the current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Checks if WebSocket is connected
   */
  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Gets the current WebSocket instance
   */
  public getSocket(): WebSocket | null {
    return this.socket;
  }

  /**
   * Sets the connection state and notifies listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      console.log(`WebSocket state changed: ${state}`);
    }
  }
}
