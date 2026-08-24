export const WsEventType = {
  SYSTEM_MESSAGE: "system:message",
  SYSTEM_MESSAGE_START: "system:message:start",
  SYSTEM_MESSAGE_CHUNK: "system:message:chunk",
  SYSTEM_MESSAGE_END: "system:message:end",
  SYSTEM_QUOTA_ALERT: "system:exhausted:alert",
  SYSTEM_QUOTA_EXHAUSTED: "system:exhausted:exhaust",
  SYSTEM_PING: "system:ping",
  SYSTEM_ERROR: "system:error",
  AUTH_EXPIRED: "auth:expired",
  USER_MESSAGE: "user:message",
  USER_IMAGE: "user:image",
  USER_TRANSCRIPTION: "user:transcription",
  USER_AUDIO_CHUNK: "user:audio",
  USER_MEDIA: "user:media",
  USER_SESSION_UPDATE: "user:session:update",
} as const;

export type WsEvent = (typeof WsEventType)[keyof typeof WsEventType];
export type AIProvider = "openai" | "anthropic" | "gemini";

export interface ProviderSettings {
  provider: AIProvider | null;
  model: string;
  sttModel: string;
  hasApiKey: boolean;
  updatedAt: string | null;
}

export interface ProviderSettingsInput {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  sttModel?: string;
}

export interface BaseMessage {
  type: WsEvent;
  metadata: { userId: string; idempotencyKey: string; timestamp?: string };
}

export interface UserTextMessage extends BaseMessage {
  type: typeof WsEventType.USER_MESSAGE;
  data: { text: string };
}

export interface UserImageMessage extends BaseMessage {
  type: typeof WsEventType.USER_IMAGE;
  data: { text: string; image: string };
}

export interface UserAudioMessage extends BaseMessage {
  type: typeof WsEventType.USER_TRANSCRIPTION;
  data: { transcription: string };
}

export interface SystemChunkMessage extends BaseMessage {
  type: typeof WsEventType.SYSTEM_MESSAGE_CHUNK;
  data: { chunk: string };
}

export interface SystemEndMessage extends BaseMessage {
  type: typeof WsEventType.SYSTEM_MESSAGE_END;
}

export interface SystemQuotaAlertMessage extends BaseMessage {
  type: typeof WsEventType.SYSTEM_QUOTA_ALERT;
  data: { message: string; remainingCredits?: number };
}

export interface SystemQuotaExhaustedMessage extends BaseMessage {
  type: typeof WsEventType.SYSTEM_QUOTA_EXHAUSTED;
  data: { message: string };
}

export type WebSocketMessage =
  | UserTextMessage
  | UserImageMessage
  | SystemChunkMessage
  | SystemEndMessage
  | SystemQuotaAlertMessage
  | SystemQuotaExhaustedMessage;

export type QluelyInput =
  | { type: "text"; text: string }
  | { type: "image"; text: string; image: { mimeType: string; base64: string } }
  | { type: "mixed"; text: string; image: { mimeType: string; base64: string } };

export type StreamChunk =
  | { type: "start" }
  | { type: "topic"; delta: string }
  | { type: "answer"; delta: string }
  | { type: "thought"; delta: string }
  | { type: "mermaid"; delta: string }
  | { type: "code"; delta: string; language: string; partial?: boolean }
  | { type: "suggestion"; delta: string }
  | { type: "end" };

// Helper function to parse markdown bold (**text**) to HTML
export const parseMarkdownBold = (text: string): string => {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
};
