import type { StreamChunk } from "../lib/types";
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}

export interface User {
  id: string;
  email?: string;
  credits?: number;
  imageCredits?: number;
  audioCredits?: number;
  creditsRemaining?: number;
}

export interface AppState {
  isLoading: boolean;
  error: string | null;
  updateAvailable: boolean;
  updateInfo: any | null;
  shouldStopRecording?: boolean;
}

export interface ScreenshotState {
  image: string | null;
  isCapturing: boolean;
}

// Message Types for React Components
export interface BaseMessage {
  id: string;
  timestamp: number;
}

export interface TopicMessage extends BaseMessage {
  type: "topic";
  content: string;
}

export interface AnswerMessage extends BaseMessage {
  type: "answer";
  content: string;
}

export interface CodeMessage extends BaseMessage {
  type: "code";
  content: string;
  language?: string;
}

export interface SuggestionMessage extends BaseMessage {
  type: "suggestion";
  content: string;
}

export interface MermaidMessage extends BaseMessage {
  type: "mermaid";
  content: string;
}

export interface ThoughtMessage extends BaseMessage {
  type: "thought";
  content: string;
}

export type ChatMessage =
  | TopicMessage
  | AnswerMessage
  | CodeMessage
  | SuggestionMessage
  | MermaidMessage
  | ThoughtMessage;

export interface ChatState {
  currentPrompt: string;
  result: string;
  isStreaming: boolean;
  accumulatedContent: string;
  messages: ChatMessage[];
  streamingMessage: ChatMessage | null;
}

export interface NotificationState {
  quotaAlert: { visible: boolean; message: string; remainingCredits?: number };
  quotaExhausted: { visible: boolean; message: string };
}

export interface AskState {
  isAskMode: boolean;
}

export interface WebSocketState {
  isConnected: boolean;
}

// Root State Interface
export interface GlobalState {
  auth: AuthState;
  app: AppState;
  screenshot: ScreenshotState;
  chat: ChatState;
  notifications: NotificationState;
  ask: AskState;
  websocket: WebSocketState;
}

// Action Types
export type GlobalAction =
  // Auth Actions
  | { type: "AUTH_LOGIN"; payload: User }
  | { type: "AUTH_LOGOUT" }
  | { type: "AUTH_UPDATE_USER"; payload: Partial<User> }

  // App Actions
  | { type: "APP_SET_LOADING"; payload: boolean }
  | { type: "APP_SET_ERROR"; payload: string | null }
  | { type: "APP_UPDATE_AVAILABLE"; payload: { available: boolean; info?: any } }
  | { type: "REQUEST_STOP_RECORDING" }
  | { type: "RECORDING_STOPPED_ACK" }

  // Screenshot Actions
  | { type: "SCREENSHOT_START_CAPTURE" }
  | { type: "SCREENSHOT_COMPLETE"; payload: string }
  | { type: "SCREENSHOT_RESET" }

  // Chat Actions
  | { type: "CHAT_SET_PROMPT"; payload: string }
  | { type: "CHAT_SET_RESULT"; payload: string }
  | { type: "CHAT_START_STREAMING" }
  | { type: "CHAT_STOP_STREAMING" }
  | { type: "CHAT_APPEND_CONTENT"; payload: string }
  | { type: "CHAT_CLEAR_CONTENT" }
  | { type: "CHAT_RESET" }
  | { type: "CHAT_ADD_MESSAGE"; payload: ChatMessage }
  | { type: "CHAT_UPDATE_STREAMING_MESSAGE"; payload: Partial<ChatMessage> }
  | { type: "CHAT_FINALIZE_STREAMING_MESSAGE" }
  | { type: "CHAT_CLEAR_MESSAGES" }
  | { type: "CHAT_PROCESS_CHUNK"; payload: { chunk: StreamChunk; id: string; timestamp: number } }

  // Notification Actions
  | {
      type: "NOTIFICATION_SHOW_QUOTA_ALERT";
      payload: { message: string; remainingCredits?: number };
    }
  | { type: "NOTIFICATION_HIDE_QUOTA_ALERT" }
  | { type: "NOTIFICATION_SHOW_QUOTA_EXHAUSTED"; payload: { message: string } }
  | { type: "NOTIFICATION_HIDE_QUOTA_EXHAUSTED" }

  // Ask Actions
  | { type: "ASK_SET_MODE"; payload: boolean }

  // WebSocket Actions
  | { type: "WEBSOCKET_CONNECTED" }
  | { type: "WEBSOCKET_DISCONNECTED" };
