import type { QluelyInput, ProviderSettings, ProviderSettingsInput } from "./lib/types";

export { };

declare module "@tabler/icons-react";

declare global {
  interface Window {
    qluely: {
      start(payload: QluelyInput): void;
      onChunk(cb: (chunk: string) => void): () => void;
      onEnd(cb: () => void): () => void;
      onError(cb: (message: string) => void): () => void;
    };
    size: { fitToContent: () => void };
    screenAPI: { capture: () => Promise<string> };
    nav: {
      to: (route: string) => Promise<void>;
      onChange: (cb: (route: string) => void) => () => void;
    };
    auth: {
      login: (creds: {
        email: string;
        password: string;
      }) => Promise<{
        success: boolean;
        error?: string;
        user?: {
          id: string;
          email: string;
          plan?: string;
          isOnboarded?: boolean;
          onboardingSkipped?: boolean;
        };
      }>;
      logout: () => void;
      completeOnboarding: (data?: { role?: string; useCases?: string[] }) => Promise<boolean>;
      getUserDetails: () => Promise<{
        imageCredits: number | undefined;
        audioCredits: number | undefined;
        creditsRemaining: number | undefined;
        creditsUsed: number | undefined;
        period: "monthly" | "yearly" | "lifetime" | null | undefined;
        plan: "free" | "pro" | "enterprise" | undefined;
        planStartedAt: Date | null | undefined;
        planExpiresAt: Date | null | undefined;
        email: string | undefined;
      } | null>;
      /** OAuth 2.0 + PKCE — opens system browser for login */
      startOAuthFlow: (
        provider: "google" | "github",
      ) => Promise<{ success: boolean; error?: string }>;
      /** Listen for OAuth completion from the main process */
      onOAuthComplete: (cb: (result: { success: boolean; error?: string }) => void) => () => void;
    };
    providerSettings: {
      get: () => Promise<{ success: boolean; data?: ProviderSettings; error?: string }>;
      save: (
        settings: ProviderSettingsInput,
      ) => Promise<{ success: boolean; data?: ProviderSettings; error?: string }>;
      clear: () => void;
    };

    overlay: {
      enableClickThrough(): Promise<void>;
      disableClickThrough(): Promise<void>;
      onForceDisable(cb: () => void): () => void;
    };
    updater: {
      checkForUpdates: () => Promise<{ success: boolean; updateInfo?: any; error?: string }>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => Promise<{ success: boolean; error?: string }>;
      onUpdateChecking: (cb: () => void) => () => void;
      onUpdateAvailable: (cb: (info: any) => void) => () => void;
      onUpdateNotAvailable: (cb: (info: any) => void) => () => void;
      onUpdateError: (cb: (error: string) => void) => () => void;
      onDownloadProgress: (cb: (progress: any) => void) => () => void;
      onUpdateDownloaded: (cb: (info: any) => void) => () => void;
    };
    quota: {
      onAlert: (cb: (event: any) => void) => () => void;
      onExhausted: (cb: (event: any) => void) => () => void;
    };
    app: { quit: () => Promise<void> };
    protection: { setContentProtection: (enable: boolean) => Promise<void> };
    systemAudio: {
      init: () => Promise<{ success: boolean; error?: string }>;
      startRecording: (options?: {
        outputDir?: string;
        filename?: string;
        quality?: "standard" | "high";
      }) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
      stopRecording: () => Promise<{ success: boolean; error?: string }>;
      getStatus: () => Promise<{
        isRecording: boolean;
        outputPath: string;
        startTime: number | null;
        duration: number;
      }>;
      listDevices: (
        forceRefresh?: boolean,
      ) => Promise<{
        success: boolean;
        devices?: { name: string; id: string; type: string; isDefault: boolean }[];
        error?: string;
      }>;
      getPlatform: () => string;
    };
    userAudio: {
      init: () => Promise<{ success: boolean; error?: string }>;
      start: () => Promise<{ success: boolean; error?: string }>;
      stop: () => Promise<{ success: boolean; error?: string }>;
    };
    transcription: {
      onTranscript(cb: (text: string) => void): () => void;
      sendAudioMessage: (text: string) => void;
    };
    electron: {
      shell: {
        showItemInFolder: (path: string) => void;
        openPath: (path: string) => Promise<string>;
        openExternal: (url: string) => Promise<void>;
      };
    };
    permissions: {
      getStatus: (
        type: "microphone" | "camera" | "screen",
      ) => Promise<"not-determined" | "granted" | "denied" | "restricted" | "unknown">;
      request: (type: "microphone" | "camera") => Promise<boolean>;
      openSettings: (type: "microphone" | "screen") => Promise<void>;
    };
  }
}
