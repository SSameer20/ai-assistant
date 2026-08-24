import { useLayoutEffect, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "./Navigation";
import { useAuth, useAskState } from "../store";
import { LogOut, CreditCard, Crown, Eye, Mic, Save, KeyRound, SlidersHorizontal } from "lucide-react";
import type { AIProvider, ProviderSettings } from "../lib/types";

type BillingCycle = "monthly" | "yearly" | "lifetime";
type AccountTypes = "free" | "pro" | "enterprise";

interface UserDetails {
  imageCredits: number | undefined;
  audioCredits: number | undefined;
  creditsRemaining: number | undefined;
  creditsUsed: number | undefined;
  period: BillingCycle | null | undefined;
  plan: AccountTypes | undefined;
  planStartedAt: Date | null | undefined;
  planExpiresAt: Date | null | undefined;
  email: string | undefined;
}

const USER_DETAILS_KEY = "qluely_user_details";
const PROVIDER_OPTIONS: Array<{ value: AIProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
];

export default function Settings() {
  const { logout } = useAuth();
  const { isAskMode } = useAskState();
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(() => {
    const stored = localStorage.getItem(USER_DETAILS_KEY);
    return stored ? JSON.parse(stored) : null;
  });
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
    async function fetchUserDetails() {
      setLoading(true);
      try {
        const details = await window.auth.getUserDetails();
        if (details) {
          setUserDetails(details);
          localStorage.setItem(USER_DETAILS_KEY, JSON.stringify(details));
        }
      } catch (error) {
        console.error("Failed to fetch user details:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUserDetails();
  }, []);

  useEffect(() => {
    async function loadProviderSettings() {
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
  }, [isAskMode, userDetails, providerSettings, provider, model, sttModel, providerMessage, providerError]);

  function handleLogout() {
    localStorage.removeItem(USER_DETAILS_KEY);
    logout();
    navigate("/login");
  }

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
  const canSave = !savingProvider && (!!apiKey.trim() || providerSettings?.hasApiKey);

  if (!isAskMode) return null;
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
              {savingProvider ? "Saving..." : "Save Provider Settings"}
            </button>
          </section>

          <section className="border-t border-white/10 pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-zinc-200">
              <Crown size={18} />
              <h3 className="text-sm font-semibold uppercase tracking-wide">Account Info</h3>
            </div>

            <InfoRow
              icon={<Crown size={18} />}
              label="Plan"
              value={loading ? "Loading..." : userDetails?.plan || "Free"}
            />
            <InfoRow
              icon={<CreditCard size={18} />}
              label="Remaining Credits"
              value={loading ? "Loading..." : userDetails?.creditsRemaining?.toString() || "0"}
            />
            <InfoRow
              icon={<Eye size={18} />}
              label="Image Credits"
              value={loading ? "Loading..." : userDetails?.imageCredits?.toString() || "0"}
            />
            <InfoRow
              icon={<Mic size={18} />}
              label="Audio Credits"
              value={loading ? "Loading..." : userDetails?.audioCredits?.toString() || "0"}
            />
          </section>
        </div>

        <div className="border-t border-white/10 p-2 bg-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-3 text-red-500 font-medium hover:bg-red-900/20 rounded-xl transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

interface InfoRowProps {
  icon: ReactNode;
  label: string;
  value: string;
}

const InfoRow = ({ icon, label, value }: InfoRowProps) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center gap-3 text-zinc-400">
      {icon}
      <span className="text-sm">{label}</span>
    </div>
    <span className="text-sm text-white font-medium">{value}</span>
  </div>
);
