import electronMain from "electron/main";
const { safeStorage } = electronMain;
import Store from "electron-store";

export type AIProvider = "openai" | "anthropic" | "gemini";

export interface ProviderSettingsInput {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  sttModel?: string;
}

export interface ProviderSettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  sttModel: string;
  updatedAt: string;
}

export interface PublicProviderSettings {
  provider: AIProvider | null;
  model: string;
  sttModel: string;
  hasApiKey: boolean;
  updatedAt: string | null;
}

interface ProviderStoreShape {
  provider?: AIProvider;
  model?: string;
  sttModel?: string;
  apiKeyEnc?: string;
  apiKeyPlain?: string;
  updatedAt?: string;
}

const DEFAULT_MODELS: Record<AIProvider, { model: string; sttModel: string }> = {
  openai: { model: "gpt-4o-mini", sttModel: "gpt-4o-mini-transcribe" },
  anthropic: { model: "claude-3-5-sonnet-latest", sttModel: "claude-3-5-sonnet-latest" },
  gemini: { model: "gemini-2.0-flash", sttModel: "gemini-2.0-flash" },
};

export class ProviderSettingsService {
  private store: Store<ProviderStoreShape>;

  constructor() {
    this.store = new Store<ProviderStoreShape>({ name: "provider-settings" });
  }

  public getDefaultModel(provider: AIProvider): string {
    return DEFAULT_MODELS[provider].model;
  }

  public getDefaultSttModel(provider: AIProvider): string {
    return DEFAULT_MODELS[provider].sttModel;
  }

  private encryptSecret(secret: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      return secret;
    }

    return safeStorage.encryptString(secret).toString("base64");
  }

  private decryptSecret(secret: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      return secret;
    }

    return safeStorage.decryptString(Buffer.from(secret, "base64"));
  }

  private readApiKey(): string | null {
    const enc = this.store.get("apiKeyEnc");
    if (enc) {
      try {
        return this.decryptSecret(enc);
      } catch (error) {
        console.error("[ProviderSettings] Failed to decrypt stored API key:", error);
      }
    }

    const plain = this.store.get("apiKeyPlain");
    return plain || null;
  }

  public getSettings(): ProviderSettings | null {
    const provider = this.store.get("provider");
    if (!provider) {
      return null;
    }

    const apiKey = this.readApiKey();
    if (!apiKey) {
      return null;
    }

    return {
      provider,
      apiKey,
      model: this.store.get("model") || this.getDefaultModel(provider),
      sttModel: this.store.get("sttModel") || this.getDefaultSttModel(provider),
      updatedAt: this.store.get("updatedAt") || new Date(0).toISOString(),
    };
  }

  public getPublicSettings(): PublicProviderSettings {
    const provider = this.store.get("provider") || null;
    const apiKey = this.readApiKey();

    return {
      provider,
      model:
        (provider && this.store.get("model")) || (provider ? this.getDefaultModel(provider) : ""),
      sttModel:
        (provider && this.store.get("sttModel")) ||
        (provider ? this.getDefaultSttModel(provider) : ""),
      hasApiKey: !!apiKey,
      updatedAt: this.store.get("updatedAt") || null,
    };
  }

  public saveSettings(input: ProviderSettingsInput): PublicProviderSettings {
    const provider = input.provider;
    const trimmedKey = input.apiKey?.trim();
    const existingKey = this.readApiKey();
    const apiKey = trimmedKey || existingKey;

    if (!apiKey) {
      throw new Error("API key is required to save provider settings");
    }

    const model = input.model?.trim() || this.store.get("model") || this.getDefaultModel(provider);
    const sttModel =
      input.sttModel?.trim() || this.store.get("sttModel") || this.getDefaultSttModel(provider);

    if (safeStorage.isEncryptionAvailable()) {
      this.store.delete("apiKeyPlain");
      this.store.set("apiKeyEnc", this.encryptSecret(apiKey));
    } else {
      this.store.delete("apiKeyEnc");
      this.store.set("apiKeyPlain", apiKey);
    }

    this.store.set("provider", provider);
    this.store.set("model", model);
    this.store.set("sttModel", sttModel);
    this.store.set("updatedAt", new Date().toISOString());

    return this.getPublicSettings();
  }

  public clearApiKey(): void {
    this.store.delete("apiKeyEnc");
    this.store.delete("apiKeyPlain");
    this.store.delete("updatedAt");
  }

  public hasValidSettings(): boolean {
    return !!this.getSettings();
  }

  public reset(): void {
    this.store.delete("provider");
    this.store.delete("model");
    this.store.delete("sttModel");
    this.clearApiKey();
  }
}
