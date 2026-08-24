import { useEffect, useLayoutEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOAuthLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useLayoutEffect(() => {
    window.size.fitToContent();
  }, []);

  // Listen for OAuth completion pushed from the main process
  useEffect(() => {
    const unsubscribe = window.auth.onOAuthComplete((result) => {
      setOAuthLoading(false);
      if (!result.success) {
        if (result.error === "timeout") {
          setError("Authentication window expired. Please try again.");
        } else if (result.error === "Security error: state mismatch") {
          setError("Security error detected. Please try again.");
        } else {
          setError(result.error || "Authentication failed. Please try again.");
        }
      }
      // On success, main process fires nav:change → navigation is handled there
    });
    return unsubscribe;
  }, []);

  async function handleLogin() {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await window.auth.login({ email, password });
      if (res.success) {
        if (res.user?.isOnboarded === false) {
          navigate("/onboarding");
          window.nav.to("/onboarding").catch(console.error);
        } else {
          navigate("/");
          window.nav.to("/").catch(console.error);
        }
      } else {
        setError(res.error || "Login failed");
      }
    } catch {
      setError("Error! Please try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleOAuth() {
    setError("");
    setOAuthLoading(true);
    try {
      await window.auth.startOAuthFlow("google");
      // Browser is now open — wait for auth:oauth-complete IPC event
    } catch {
      setOAuthLoading(false);
      setError("Failed to open browser. Please try again.");
    }
  }

  const busy = loading || oauthLoading;

  return (
    <div className="flex flex-col gap-3 p-6 bg-transparent">
      <div className="w-150 p-5 bg-zinc-900/65 backdrop-blur-2xl border border-white/15 rounded-2xl text-white flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-white">Sign In</h2>

        {/* Email */}
        <input
          className="w-full py-1.5 px-4 bg-black/20 border border-white/10 rounded-full outline-none focus:border-white/30 transition-all text-sm placeholder:text-zinc-500 disabled:opacity-50"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          disabled={busy}
        />

        {/* Password */}
        <input
          type="password"
          className="w-full py-1.5 px-4 bg-black/20 border border-white/10 rounded-full outline-none focus:border-white/30 transition-all text-sm placeholder:text-zinc-500 disabled:opacity-50"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={busy}
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Sign In */}
        <button
          id="email-login-btn"
          onClick={handleLogin}
          disabled={busy}
          className="bg-indigo-600 hover:bg-indigo-500 transition rounded-lg p-3 text-white disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-zinc-500">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Continue with Google */}
        <button
          id="oauth-btn-google"
          onClick={handleGoogleOAuth}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2.5 py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {oauthLoading ? (
            <svg
              className="animate-spin"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <GoogleIcon />
          )}
          {oauthLoading ? "Opening browser..." : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
