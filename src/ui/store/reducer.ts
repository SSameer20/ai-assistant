import type { GlobalState, GlobalAction, ChatMessage } from "./types";

// Initial State
export const initialState: GlobalState = {
  auth: { isAuthenticated: false, user: null },
  app: { isLoading: false, error: null, updateAvailable: false, updateInfo: null },
  screenshot: { image: null, isCapturing: false },
  chat: {
    currentPrompt: "",
    result: "",
    isStreaming: false,
    accumulatedContent: "",
    messages: [],
    streamingMessage: null,
  },
  notifications: {
    quotaAlert: { visible: false, message: "", remainingCredits: undefined },
    quotaExhausted: { visible: false, message: "" },
  },
  ask: { isAskMode: true },
  websocket: { isConnected: false },
};

// Reducer Function
export const globalReducer = (state: GlobalState, action: GlobalAction): GlobalState => {
  switch (action.type) {
    // Auth Actions
    case "AUTH_LOGIN":
      return { ...state, auth: { isAuthenticated: true, user: action.payload } };

    case "AUTH_LOGOUT":
      return { ...state, auth: { isAuthenticated: false, user: null } };

    case "AUTH_UPDATE_USER":
      return {
        ...state,
        auth: {
          ...state.auth,
          user: state.auth.user ? { ...state.auth.user, ...action.payload } : null,
        },
      };

    // App Actions
    case "APP_SET_LOADING":
      return { ...state, app: { ...state.app, isLoading: action.payload } };

    case "APP_SET_ERROR":
      return { ...state, app: { ...state.app, error: action.payload } };

    case "APP_UPDATE_AVAILABLE":
      return {
        ...state,
        app: {
          ...state.app,
          updateAvailable: action.payload.available,
          updateInfo: action.payload.info || null,
        },
      };

    // Recorder Control Actions
    case "REQUEST_STOP_RECORDING":
      return { ...state, app: { ...state.app, shouldStopRecording: true } };

    case "RECORDING_STOPPED_ACK":
      return { ...state, app: { ...state.app, shouldStopRecording: false } };

    // Screenshot Actions
    case "SCREENSHOT_START_CAPTURE":
      return { ...state, screenshot: { ...state.screenshot, isCapturing: true } };

    case "SCREENSHOT_COMPLETE":
      return { ...state, screenshot: { image: action.payload, isCapturing: false } };

    case "SCREENSHOT_RESET":
      return { ...state, screenshot: { image: null, isCapturing: false } };

    // Chat Actions
    case "CHAT_SET_PROMPT":
      return { ...state, chat: { ...state.chat, currentPrompt: action.payload } };

    case "CHAT_SET_RESULT":
      return { ...state, chat: { ...state.chat, result: action.payload } };

    case "CHAT_START_STREAMING":
      return { ...state, chat: { ...state.chat, isStreaming: true } };

    case "CHAT_STOP_STREAMING":
      return { ...state, chat: { ...state.chat, isStreaming: false } };

    case "CHAT_APPEND_CONTENT":
      return {
        ...state,
        chat: { ...state.chat, accumulatedContent: state.chat.accumulatedContent + action.payload },
      };

    case "CHAT_CLEAR_CONTENT":
      return { ...state, chat: { ...state.chat, accumulatedContent: "" } };

    case "CHAT_RESET":
      return { ...state, chat: { ...initialState.chat } };

    case "CHAT_ADD_MESSAGE":
      return {
        ...state,
        chat: { ...state.chat, messages: [...state.chat.messages, action.payload] },
      };

    case "CHAT_UPDATE_STREAMING_MESSAGE":
      return {
        ...state,
        chat: {
          ...state.chat,
          streamingMessage: state.chat.streamingMessage
            ? { ...state.chat.streamingMessage, ...action.payload }
            : (action.payload as ChatMessage), // Cast to ChatMessage when creating new
        },
      };

    case "CHAT_FINALIZE_STREAMING_MESSAGE":
      return {
        ...state,
        chat: {
          ...state.chat,
          messages: state.chat.streamingMessage
            ? [...state.chat.messages, state.chat.streamingMessage]
            : state.chat.messages,
          streamingMessage: null,
        },
      };

    case "CHAT_CLEAR_MESSAGES":
      return { ...state, chat: { ...state.chat, messages: [], streamingMessage: null } };

    case "CHAT_PROCESS_CHUNK": {
      const { chunk, id, timestamp } = action.payload;
      const { streamingMessage, messages } = state.chat;

      // Ignore non-content chunks
      if (chunk.type === "start" || chunk.type === "end") {
        return state;
      }

      let newMessages = [...messages];
      let newStreamingMessage = streamingMessage;

      // 1. If type changed, finalize previous message
      if (streamingMessage && streamingMessage.type !== chunk.type) {
        newMessages.push(streamingMessage);
        newStreamingMessage = null;
      }

      // 2. Extract common chunk properties
      const delta = (chunk as any).delta || "";
      const isCode = chunk.type === "code";
      const language = isCode ? (chunk as any).language : undefined;
      // Assume streaming (partial: true) unless explicitly stated otherwise
      const isPartial = (chunk as any).partial !== false;

      // 3. Update existing or create new streaming message
      if (newStreamingMessage && newStreamingMessage.type === chunk.type) {
        newStreamingMessage = {
          ...newStreamingMessage,
          content: (newStreamingMessage.content || "") + delta,
          ...(isCode ? { language } : {}),
        } as ChatMessage;
      } else {
        newStreamingMessage = {
          id,
          type: chunk.type,
          content: delta,
          timestamp,
          ...(isCode ? { language } : {}),
        } as ChatMessage;
      }

      // 4. Finalize immediately if this specific chunk is marked as not partial
      if (!isPartial) {
        newMessages.push(newStreamingMessage);
        newStreamingMessage = null;
      }

      return {
        ...state,
        chat: { ...state.chat, messages: newMessages, streamingMessage: newStreamingMessage },
      };
    }

    // Notification Actions
    case "NOTIFICATION_SHOW_QUOTA_ALERT":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          quotaAlert: {
            visible: true,
            message: action.payload.message,
            remainingCredits: action.payload.remainingCredits,
          },
        },
      };

    case "NOTIFICATION_HIDE_QUOTA_ALERT":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          quotaAlert: { visible: false, message: "", remainingCredits: undefined },
        },
      };

    case "NOTIFICATION_SHOW_QUOTA_EXHAUSTED":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          quotaExhausted: { visible: true, message: action.payload.message },
        },
      };

    case "NOTIFICATION_HIDE_QUOTA_EXHAUSTED":
      return {
        ...state,
        notifications: { ...state.notifications, quotaExhausted: { visible: false, message: "" } },
      };

    // Ask Actions
    case "ASK_SET_MODE":
      return { ...state, ask: { isAskMode: action.payload } };

    // WebSocket Actions
    case "WEBSOCKET_CONNECTED":
      return { ...state, websocket: { isConnected: true } };

    case "WEBSOCKET_DISCONNECTED":
      return { ...state, websocket: { isConnected: false } };

    default:
      return state;
  }
};
