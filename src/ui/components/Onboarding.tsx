import { useState, useEffect } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PermissionStep from "./PermissionStep";

// Role options matching backend enum
const ROLES = [
  { id: "DEVELOPER", label: "Developer", desc: "Build and code applications" },
  { id: "PRODUCT_MANAGER", label: "Product Manager", desc: "Manage product strategy" },
  { id: "STUDENT", label: "Student", desc: "Learning and studying" },
  { id: "BUSINESS_ANALYST", label: "Business Analyst", desc: "Analyze business processes" },
  { id: "FOUNDER", label: "Founder", desc: "Start and lead companies" },
  { id: "ENGINEER", label: "Engineer", desc: "Technical engineering roles" },
  { id: "RECRUITER", label: "Recruiter", desc: "Talent acquisition" },
  { id: "SALES_MARKETING", label: "Sales & Marketing", desc: "Drive growth and sales" },
  { id: "OTHER", label: "Other", desc: "Something else" },
];

// Use case options matching backend enum
const USE_CASES = [
  { id: "CODE_GENERATION", label: "Code Generation", desc: "Generate code snippets" },
  { id: "CODE_REVIEW", label: "Code Review", desc: "Review and improve code" },
  { id: "MEETINGS_SUMMARIES", label: "Meeting Summaries", desc: "Summarize meetings" },
  { id: "INTERVIEWS", label: "Interviews", desc: "Conduct and analyze interviews" },
  { id: "SALES_CALLS", label: "Sales Calls", desc: "Support sales conversations" },
  { id: "TEAM_STANDUPS", label: "Team Standups", desc: "Daily team updates" },
  { id: "CLIENT_CALLS", label: "Client Calls", desc: "Client communication" },
  { id: "OTHER", label: "Other", desc: "Something else" },
];

export default function Onboarding() {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"permissions" | "personalize">("permissions");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();

  // Re-fit window every time the step changes so Electron resizes to the
  // new content height (PermissionStep vs. the much taller personalize step).
  useEffect(() => {
    const timer = setTimeout(() => {
      window.size.fitToContent();
    }, 100); // small delay lets React finish painting before we measure
    return () => clearTimeout(timer);
  }, [step]);

  const toggleUseCase = (useCaseId: string) => {
    setSelectedUseCases((prev) => {
      if (prev.includes(useCaseId)) {
        return prev.filter((id) => id !== useCaseId);
      } else {
        // Limit to 5 use cases
        if (prev.length >= 5) {
          setError("Maximum 5 use cases allowed");
          setTimeout(() => setError(""), 3000);
          return prev;
        }
        return [...prev, useCaseId];
      }
    });
  };

  const handleComplete = async () => {
    setError("");

    // Validate selections
    if (!selectedRole) {
      setError("Please select your role");
      return;
    }
    if (selectedUseCases.length === 0) {
      setError("Please select at least one use case");
      return;
    }

    setLoading(true);
    try {
      // Call backend with role and useCases through the auth API
      const success = await window.auth.completeOnboarding({
        role: selectedRole,
        useCases: selectedUseCases,
      });

      if (!success) {
        throw new Error("Failed to complete onboarding");
      }

      navigate("/");
      window.nav.to("/").catch(console.error);
    } catch (error) {
      console.error("Onboarding error:", error);
      setError(error instanceof Error ? error.message : "Failed to complete onboarding");
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await window.auth.completeOnboarding();
      navigate("/");
      window.nav.to("/").catch(console.error);
    } catch (error) {
      console.error("Skip onboarding error:", error);
      // Navigate anyway to avoid locking the user out
      navigate("/");
      window.nav.to("/").catch(console.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-main-container className="flex flex-col gap-3 p-6 bg-transparent">
      {/*
       * The card uses flex-col + max-h so it never overflows the Electron window.
       * Header and footer are flex-shrink-0 (sticky), the middle content scrolls.
       */}
      <div
        className="relative w-150 bg-zinc-900/80 backdrop-blur-2xl border border-white/15 rounded-2xl text-white flex flex-col overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 48px)" }}
      >
        {step === "permissions" ? (
          /* PermissionStep — simple, short content, just pad it */
          <div className="p-8 overflow-y-auto flex-1 scrollbar-none">
            <PermissionStep onComplete={() => setStep("personalize")} />
          </div>
        ) : (
          <div className="flex flex-col h-full py-5">
            {/* ── Sticky Header ── */}
            <div className="flex-shrink-0 px-8 pt-8 pb-4">
              <h1 className="text-2xl font-bold bg-linear-to-r from-white to-white/70 bg-clip-text text-transparent">
                Welcome to Clever AI
              </h1>
              <p className="text-zinc-400 mt-1 text-sm">Let's personalize your experience</p>

              {error && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* ── Scrollable Middle — roles + use cases ── */}
            <div className="flex-1 overflow-y-auto min-h-0 px-8 pb-4 scrollbar-none flex flex-col gap-4">
              {/* Role Selection */}
              <div>
                <h2 className="text-sm font-medium text-zinc-300 mb-2">What's your role?</h2>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role.id)}
                      className={`p-3 rounded-lg border transition-all text-left ${selectedRole === role.id
                        ? "bg-indigo-600/20 border-indigo-500/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white text-sm truncate">{role.label}</h3>
                          <p className="text-zinc-400 text-xs mt-0.5 truncate">{role.desc}</p>
                        </div>
                        {selectedRole === role.id && (
                          <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Use Cases Selection */}
              <div>
                <h2 className="text-sm font-medium text-zinc-300 mb-2">
                  What will you use Clever AI for?{" "}
                  <span className="text-zinc-500">(Select up to 5)</span>
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {USE_CASES.map((useCase) => (
                    <button
                      key={useCase.id}
                      onClick={() => toggleUseCase(useCase.id)}
                      className={`p-3 rounded-lg border transition-all text-left ${selectedUseCases.includes(useCase.id)
                        ? "bg-purple-600/20 border-purple-500/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white text-sm truncate">{useCase.label}</h3>
                          <p className="text-zinc-400 text-xs mt-0.5 truncate">{useCase.desc}</p>
                        </div>
                        {selectedUseCases.includes(useCase.id) && (
                          <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {selectedUseCases.length > 0 && (
                  <p className="text-xs text-zinc-500 mt-2">{selectedUseCases.length} of 5 selected</p>
                )}
              </div>

            </div>
            {/* ── action buttons always visible ── */}
            <div className="p-2 m-2 border-t border-white/10 flex gap-3">
              <button
                onClick={handleSkip}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-xl text-sm font-medium text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip for now
              </button>
              <button
                onClick={handleComplete}
                disabled={loading || !selectedRole || selectedUseCases.length === 0}
                className="flex-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 border border-white/10 rounded-xl text-sm font-medium text-white transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  "Setting up..."
                ) : (
                  <>
                    Get Started
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
