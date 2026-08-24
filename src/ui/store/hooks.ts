import { useGlobalState } from "./context";
import type { User, ChatMessage } from "./types";
import type { StreamChunk } from "../lib/types";

// Auth Hooks
export const useAuth = () => {
  const { state, dispatch } = useGlobalState();

  const login = (user: User) => dispatch({ type: "AUTH_LOGIN", payload: user });
  const logout = () => {
    dispatch({ type: "AUTH_LOGOUT" });
    // Also call electron auth logout
    if (window.auth) {
      window.auth.logout();
    }
  };
  const updateUser = (userData: Partial<User>) =>
    dispatch({ type: "AUTH_UPDATE_USER", payload: userData });

  return { ...state.auth, login, logout, updateUser };
};

// App State Hooks
export const useAppState = () => {
  const { state, dispatch } = useGlobalState();

  const setLoading = (loading: boolean) => dispatch({ type: "APP_SET_LOADING", payload: loading });
  const setError = (error: string | null) => dispatch({ type: "APP_SET_ERROR", payload: error });
  const setUpdateAvailable = (available: boolean, info?: any) =>
    dispatch({ type: "APP_UPDATE_AVAILABLE", payload: { available, info } });

  return { ...state.app, setLoading, setError, setUpdateAvailable };
};

// Screenshot Hooks
export const useScreenshotState = () => {
  const { state, dispatch } = useGlobalState();

  const startCapture = () => dispatch({ type: "SCREENSHOT_START_CAPTURE" });
  const completeCapture = (image: string) =>
    dispatch({ type: "SCREENSHOT_COMPLETE", payload: image });
  const reset = () => dispatch({ type: "SCREENSHOT_RESET" });

  return { ...state.screenshot, startCapture, completeCapture, reset };
};

// Chat Hooks
export const useChatState = () => {
  const { state, dispatch } = useGlobalState();

  const setPrompt = (prompt: string) => dispatch({ type: "CHAT_SET_PROMPT", payload: prompt });
  const setResult = (result: string) => dispatch({ type: "CHAT_SET_RESULT", payload: result });
  const startStreaming = () => dispatch({ type: "CHAT_START_STREAMING" });
  const stopStreaming = () => dispatch({ type: "CHAT_STOP_STREAMING" });
  const appendContent = (content: string) =>
    dispatch({ type: "CHAT_APPEND_CONTENT", payload: content });
  const clearContent = () => dispatch({ type: "CHAT_CLEAR_CONTENT" });
  const resetChat = () => dispatch({ type: "CHAT_RESET" });
  const addMessage = (message: ChatMessage) =>
    dispatch({ type: "CHAT_ADD_MESSAGE", payload: message });
  const updateStreamingMessage = (update: Partial<ChatMessage>) =>
    dispatch({ type: "CHAT_UPDATE_STREAMING_MESSAGE", payload: update });
  const finalizeStreamingMessage = () => dispatch({ type: "CHAT_FINALIZE_STREAMING_MESSAGE" });
  const clearMessages = () => dispatch({ type: "CHAT_CLEAR_MESSAGES" });
  const processChunk = (chunk: StreamChunk, id: string, timestamp: number) =>
    dispatch({ type: "CHAT_PROCESS_CHUNK", payload: { chunk, id, timestamp } });

  return {
    ...state.chat,
    setPrompt,
    setResult,
    startStreaming,
    stopStreaming,
    appendContent,
    clearContent,
    resetChat,
    addMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
    clearMessages,
    processChunk,
  };
};

// Notification Hooks
export const useNotifications = () => {
  const { state, dispatch } = useGlobalState();

  const showQuotaAlert = (message: string, remainingCredits?: number) =>
    dispatch({ type: "NOTIFICATION_SHOW_QUOTA_ALERT", payload: { message, remainingCredits } });

  const hideQuotaAlert = () => dispatch({ type: "NOTIFICATION_HIDE_QUOTA_ALERT" });

  const showQuotaExhausted = (message: string) =>
    dispatch({ type: "NOTIFICATION_SHOW_QUOTA_EXHAUSTED", payload: { message } });

  const hideQuotaExhausted = () => dispatch({ type: "NOTIFICATION_HIDE_QUOTA_EXHAUSTED" });

  return {
    ...state.notifications,
    showQuotaAlert,
    hideQuotaAlert,
    showQuotaExhausted,
    hideQuotaExhausted,
  };
};

// Generic dispatch hook for custom actions
export const useDispatch = () => {
  const { dispatch } = useGlobalState();
  return dispatch;
};

// Ask State Hooks
export const useAskState = () => {
  const { state, dispatch } = useGlobalState();

  const setAskMode = (isAskMode: boolean) => dispatch({ type: "ASK_SET_MODE", payload: isAskMode });

  return { ...state.ask, setAskMode };
};
