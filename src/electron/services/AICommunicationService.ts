import type { QluelyInput, QluelyError } from "../types/protocol.js";
import type {
  ProviderSettingsService,
  AIProvider,
  ProviderSettings,
} from "./ProviderSettingsService.js";

export interface AICommunicationConfig {
  requestTimeout?: number;
  defaultOpenAIModel?: string;
  defaultAnthropicModel?: string;
  defaultGeminiModel?: string;
}

type ProviderChunk = { type: "answer"; delta: string } | { type: "start" } | { type: "end" };

interface ProviderMessageResult {
  success: boolean;
  error?: string;
}

interface LLMMessagePart {
  type: "text" | "image";
  text?: string;
  mimeType?: string;
  base64?: string;
}

export class AICommunicationService {
  private windowManager: any;
  private providerSettingsService: ProviderSettingsService;
  private config: AICommunicationConfig;

  constructor(
    windowManager: any,
    providerSettingsService: ProviderSettingsService,
    config: Partial<AICommunicationConfig> = {},
  ) {
    this.windowManager = windowManager;
    this.providerSettingsService = providerSettingsService;
    this.config = {
      requestTimeout: 60000,
      defaultOpenAIModel: "gpt-4o-mini",
      defaultAnthropicModel: "claude-3-5-sonnet-latest",
      defaultGeminiModel: "gemini-2.0-flash",
      ...config,
    };

    console.log("AICommunicationService initialized", this.config);
  }

  public async startAIQuery(input: QluelyInput): Promise<ProviderMessageResult> {
    try {
      if (!this.validateInput(input)) {
        const error = "Invalid input format";
        this.notifyError(error);
        return { success: false, error };
      }

      const settings = this.providerSettingsService.getSettings();
      if (!settings) {
        const error = "No provider configuration saved. Open Settings and add your API key.";
        this.notifyError(error);
        return { success: false, error };
      }

      this.emitChunk({ type: "start" });

      const result = await this.queryProvider(settings, input);

      if (!result.success && result.error) {
        this.notifyError(result.error);
        return result;
      }

      this.emitChunk({ type: "end" });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("AI query failed:", error);
      this.notifyError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  private async queryProvider(
    settings: ProviderSettings,
    input: QluelyInput,
  ): Promise<ProviderMessageResult> {
    switch (settings.provider) {
      case "openai":
        return this.queryOpenAI(settings, input);
      case "anthropic":
        return this.queryAnthropic(settings, input);
      case "gemini":
        return this.queryGemini(settings, input);
      default:
        return { success: false, error: `Unsupported provider: ${(settings as any).provider}` };
    }
  }

  private buildPrompt(input: QluelyInput): string {
    return `${input.text.trim()}\n\nAnswer concisely and clearly. Use Markdown headings and lists only when they improve readability; avoid repeating the prompt or adding unnecessary detail.`;
  }

  private buildMultimodalParts(input: QluelyInput): LLMMessagePart[] {
    const parts: LLMMessagePart[] = [{ type: "text", text: this.buildPrompt(input) }];

    if (input.type === "image" || input.type === "mixed") {
      parts.push({ type: "image", mimeType: input.image.mimeType, base64: input.image.base64 });
    }

    return parts;
  }

  private async queryOpenAI(
    settings: ProviderSettings,
    input: QluelyInput,
  ): Promise<ProviderMessageResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const model = settings.model || this.config.defaultOpenAIModel || "gpt-4o-mini";
      const messages: any[] = [{ role: "user", content: this.buildOpenAIContent(input) }];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({ model, messages, stream: true }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        return {
          success: false,
          error: await this.readErrorResponse(response, "OpenAI request failed"),
        };
      }

      return await this.consumeSseStream(response, (eventName, data) => {
        if (data === "[DONE]") {
          return;
        }

        try {
          const payload = JSON.parse(data);
          const delta = payload?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            this.emitChunk({ type: "answer", delta });
          }
        } catch (error) {
          console.warn("[AICommunicationService] Failed to parse OpenAI chunk:", eventName, error);
        }
      });
    } catch (error) {
      return { success: false, error: this.normalizeError(error, "OpenAI request failed") };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildOpenAIContent(input: QluelyInput): any[] | string {
    if (input.type === "text") {
      return this.buildPrompt(input);
    }

    const content: any[] = [{ type: "text", text: this.buildPrompt(input) }];
    content.push({
      type: "image_url",
      image_url: { url: `data:${input.image.mimeType};base64,${input.image.base64}` },
    });
    return content;
  }

  private async queryAnthropic(
    settings: ProviderSettings,
    input: QluelyInput,
  ): Promise<ProviderMessageResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const model =
        settings.model || this.config.defaultAnthropicModel || "claude-3-5-sonnet-latest";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
          "anthropic-version": "2023-06-01",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          messages: [{ role: "user", content: this.buildAnthropicContent(input) }],
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        return {
          success: false,
          error: await this.readErrorResponse(response, "Anthropic request failed"),
        };
      }

      return await this.consumeSseStream(response, (_eventName, data) => {
        try {
          const payload = JSON.parse(data);
          if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta") {
            const delta = payload.delta?.text;
            if (typeof delta === "string" && delta.length > 0) {
              this.emitChunk({ type: "answer", delta });
            }
          }
        } catch (error) {
          if (data !== "[DONE]") {
            console.warn("[AICommunicationService] Failed to parse Anthropic chunk:", error);
          }
        }
      });
    } catch (error) {
      return { success: false, error: this.normalizeError(error, "Anthropic request failed") };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildAnthropicContent(input: QluelyInput): any[] {
    const parts = this.buildMultimodalParts(input);
    const imageInput = input.type === "text" ? null : input.image;

    return parts.map((part) => {
      if (part.type === "text") {
        return { type: "text", text: part.text || "" };
      }

      if (!imageInput) {
        return { type: "text", text: part.text || "" };
      }

      return {
        type: "image",
        source: {
          type: "base64",
          media_type: part.mimeType || imageInput.mimeType,
          data: part.base64 || imageInput.base64,
        },
      };
    });
  }

  private async queryGemini(
    settings: ProviderSettings,
    input: QluelyInput,
  ): Promise<ProviderMessageResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeout);

    try {
      const model = settings.model || this.config.defaultGeminiModel || "gemini-2.0-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: this.buildGeminiParts(input) }],
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        return {
          success: false,
          error: await this.readErrorResponse(response, "Gemini request failed"),
        };
      }

      const payload = await response.json();
      const text = this.extractGeminiText(payload);
      if (text) {
        this.emitChunk({ type: "answer", delta: text });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: this.normalizeError(error, "Gemini request failed") };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildGeminiParts(input: QluelyInput): any[] {
    const parts: any[] = [{ text: this.buildPrompt(input) }];
    const imageInput = input.type === "text" ? null : input.image;

    if (imageInput) {
      parts.push({ inlineData: { mimeType: imageInput.mimeType, data: imageInput.base64 } });
    }

    return parts;
  }

  private extractGeminiText(payload: any): string {
    const candidates = payload?.candidates || [];
    const firstCandidate = candidates[0];
    const parts = firstCandidate?.content?.parts || [];

    return parts
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  private async consumeSseStream(
    response: Response,
    onEvent: (eventName: string, data: string) => void,
  ): Promise<ProviderMessageResult> {
    const reader = response.body?.getReader();
    if (!reader) {
      return { success: false, error: "Streaming response body unavailable" };
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let eventName = "message";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let separatorIndex = buffer.indexOf("\n\n");

      while (separatorIndex !== -1) {
        const eventBlock = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const lines = eventBlock.split(/\r?\n/);
        let data = "";
        eventName = "message";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            data += `${line.slice(5).trim()}\n`;
          }
        }

        if (data.trim().length > 0) {
          onEvent(eventName, data.trim());
        }

        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    return { success: true };
  }

  private async readErrorResponse(response: Response, fallback: string): Promise<string> {
    try {
      const text = await response.text();
      if (!text) {
        return `${fallback} (${response.status})`;
      }

      try {
        const parsed = JSON.parse(text);
        return parsed?.error?.message || parsed?.message || parsed?.error || text;
      } catch {
        return text;
      }
    } catch {
      return `${fallback} (${response.status})`;
    }
  }

  private emitChunk(chunk: ProviderChunk): void {
    try {
      this.windowManager?.sendMessage("ai:chunk", JSON.stringify(chunk));
    } catch (error) {
      console.error("Failed to send AI chunk:", error);
    }
  }

  private notifyError(error: string): void {
    try {
      this.windowManager?.sendMessage("ai:error", error);
    } catch (err) {
      console.error("Failed to send AI error notification:", err);
    }
  }

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

  public formatError(error: unknown): QluelyError {
    if (error instanceof Error) {
      return { message: error.message };
    }

    if (typeof error === "string") {
      return { message: error };
    }

    return { message: "Unknown error occurred" };
  }

  public isReady(): boolean {
    return this.providerSettingsService.hasValidSettings();
  }

  public getStatus(): { ready: boolean; providerConfigured: boolean; provider: AIProvider | null } {
    const settings = this.providerSettingsService.getPublicSettings();
    return {
      ready: !!settings.provider && settings.hasApiKey,
      providerConfigured: settings.hasApiKey,
      provider: settings.provider,
    };
  }

  public getConfig(): AICommunicationConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<AICommunicationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("AICommunicationService configuration updated", this.config);
  }

  public destroy(): void {
    console.log("AICommunicationService: Cleaned up resources");
  }

  private normalizeError(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return `${fallback} timed out`;
      }
      return error.message || fallback;
    }

    if (typeof error === "string") {
      return error;
    }

    return fallback;
  }
}
