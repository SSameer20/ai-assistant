import { useLayoutEffect, useEffect, useState } from "react";
import Navigation from "./Navigation";
import { useAskState } from "../store";
import { Save, KeyRound, SlidersHorizontal } from "lucide-react";
import type { AIProvider, ProviderSettings } from "../lib/types";

const PROVIDER_OPTIONS: Array<{ value: AIProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
];

export default function Settings() {
  const { isAskMode } = useAskState();
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [sttModel, setSttModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [providerMessage, setProviderMessage] = useState("");

  useEffect(() => {
    async function loadProviderSettings() {
      setLoading(true);
      try {
        const result = await window.providerSettings.get();
        if (!result.success) {
          setProviderError(result.error || "Failed to load provider settings");
          return;
        }

        if (result.data) {
          setProviderSettings(result.data);
          if (result.data.provider) {
            setProvider(result.data.provider);
          }
          setModel(result.data.model || "");
          setSttModel(result.data.sttModel || "");
        }
      } catch (error) {
        console.error("Failed to load provider settings:", error);
        setProviderError("Failed to load provider settings");
      } finally {
        setLoading(false);
      }
    }

    loadProviderSettings();
  }, []);

  // Always enforce content protection — screen-share hiding is permanently enabled
  useEffect(() => {
    window.protection.setContentProtection(true);
  }, []);

  useLayoutEffect(() => {
    window.size.fitToContent();
  }, [isAskMode, providerSettings, provider, model, sttModel, providerMessage, providerError]);

  async function handleSaveProviderSettings() {
    setSavingProvider(true);
    setProviderError("");
    setProviderMessage("");

    try {
      const result = await window.providerSettings.save({
        provider,
        apiKey: apiKey.trim() || undefined,
        model: model.trim() || undefined,
        sttModel: sttModel.trim() || undefined,
      });

      if (!result.success) {
        setProviderError(result.error || "Failed to save provider settings");
        return;
      }

      setProviderSettings(result.data || null);
      if (result.data) {
        setProvider(result.data.provider || provider);
        setModel(result.data.model || model);
        setSttModel(result.data.sttModel || sttModel);
      }
      setApiKey("");
      setProviderMessage("Provider settings saved locally.");
    } catch (error) {
      console.error("Failed to save provider settings:", error);
      setProviderError("Failed to save provider settings");
    } finally {
      setSavingProvider(false);
    }
  }

  const keyPlaceholder = providerSettings?.hasApiKey ? "Stored securely on this device" : "Paste your API key";
  const canSave = !loading && !savingProvider && (!!apiKey.trim() || providerSettings?.hasApiKey);

  return (
    <div className="flex flex-col gap-3 p-6 bg-transparent min-w-150 items-center" data-main-container>
      <Navigation />

      <div className="w-full bg-zinc-900/65 backdrop-blur-2xl border border-white/15 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-zinc-200">
              <SlidersHorizontal size={18} />
              <h3 className="text-sm font-semibold uppercase tracking-wide">Provider Settings</h3>
            </div>

            <div className="grid gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-zinc-500">Provider</span>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as AIProvider)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                >
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-zinc-900">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-zinc-500">API Key</span>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <KeyRound size={16} className="text-zinc-500 shrink-0" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={keyPlaceholder}
                    className="w-full bg-transparent outline-none text-sm text-white placeholder:text-zinc-500"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <span className="text-[11px] text-zinc-500">
                  Stored locally in the app data folder and encrypted with OS-backed storage when available.
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-zinc-500">Model</span>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Leave blank to use the provider default"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30 placeholder:text-zinc-600"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-zinc-500">STT Model</span>
                <input
                  value={sttModel}
                  onChange={(e) => setSttModel(e.target.value)}
                  placeholder="Optional transcription model"
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30 placeholder:text-zinc-600"
                />
              </label>
            </div>

            {providerError && <p className="text-red-400 text-sm">{providerError}</p>}
            {providerMessage && <p className="text-emerald-400 text-sm">{providerMessage}</p>}

            <button
              onClick={handleSaveProviderSettings}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {loading ? "Loading..." : savingProvider ? "Saving..." : "Save Provider Settings"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
