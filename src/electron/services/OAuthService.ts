import { shell, app } from "electron";
import * as crypto from "crypto";
import { CONFIG_API, API } from "../config/api.js";

export type OAuthProvider = "google" | "github";

export interface OAuthResult {
  success: boolean;
  error?: string;
}

interface PendingAuth {
  state: string;
  codeVerifier: string;
  provider: OAuthProvider;
  expiresAt: number;
}

type OAuthEventHandler = (result: OAuthResult) => void;

function resolveBackendUrl(): string {
  const envUrl =
    process.env.QLUELY_BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "";

  return envUrl || CONFIG_API.prod.api;
}

export class OAuthService {
  private pendingAuth: PendingAuth | null = null;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers: OAuthEventHandler[] = [];

  /** Timeout in ms for the browser auth window (5 minutes) */
  private static readonly FLOW_TIMEOUT_MS = 5 * 60 * 1000;

  // ─── PKCE Helpers ──────────────────────────────────────────────────────────

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
  }

  private generateState(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  // ─── Event Emitter ─────────────────────────────────────────────────────────

  public onResult(handler: OAuthEventHandler): void {
    this.eventHandlers.push(handler);
  }

  public offResult(handler: OAuthEventHandler): void {
    this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
  }

  private emit(result: OAuthResult): void {
    this.eventHandlers.forEach((h) => {
      try {
        h(result);
      } catch (err) {
        console.error("[OAuthService] Error in result handler:", err);
      }
    });
  }

  // ─── Flow Control ──────────────────────────────────────────────────────────

  /**
   * Starts the OAuth "Continue in Browser" flow.
   * Opens the system browser to the backend's /auth/oauth/authorize endpoint.
   */
  public async startOAuthFlow(provider: OAuthProvider): Promise<void> {
    try {
      // Cancel any previously pending flow
      this.cancelPendingFlow();

      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      const state = this.generateState();

      this.pendingAuth = {
        state,
        codeVerifier,
        provider,
        expiresAt: Date.now() + OAuthService.FLOW_TIMEOUT_MS,
      };

      const baseUrl = resolveBackendUrl();
      const redirectUri = app.isPackaged
        ? CONFIG_API.oauth.redirectUri.prod
        : CONFIG_API.oauth.redirectUri.dev;

      const params = new URLSearchParams({
        client_id: CONFIG_API.oauth.clientId,
        provider,
        redirect_uri: redirectUri,
        response_type: "code",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
      });

      const authUrl = `${baseUrl}${API.oauthAuthorize}?${params.toString()}`;
      console.log("[OAuthService] Opening browser for OAuth:", provider);

      await shell.openExternal(authUrl);

      // Set timeout — emit error if user never completes flow
      this.timeoutHandle = setTimeout(() => {
        if (this.pendingAuth?.state === state) {
          console.warn("[OAuthService] OAuth flow timed out");
          this.cancelPendingFlow();
          this.emit({ success: false, error: "timeout" });
        }
      }, OAuthService.FLOW_TIMEOUT_MS);
    } catch (error) {
      console.error("[OAuthService] Failed to start OAuth flow:", error);
      this.cancelPendingFlow();
      this.emit({ success: false, error: "Failed to open browser" });
    }
  }

  /**
   * Handles the deep-link callback from the OS (qluely://oauth/callback?code=...&state=...).
   * Called from the main process `open-url` or `second-instance` event.
   */
  public async handleCallback(rawUrl: string): Promise<void> {
    try {
      console.log("[OAuthService] Handling OAuth callback URL:", rawUrl);

      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        console.error("[OAuthService] Invalid callback URL:", rawUrl);
        this.emit({ success: false, error: "Invalid callback URL" });
        return;
      }

      const code = parsed.searchParams.get("code");
      const state = parsed.searchParams.get("state");
      const errorParam = parsed.searchParams.get("error");

      if (errorParam) {
        const desc = parsed.searchParams.get("error_description") || errorParam;
        console.warn("[OAuthService] OAuth provider returned error:", desc);
        this.cancelPendingFlow();
        this.emit({ success: false, error: desc });
        return;
      }

      if (!code || !state) {
        console.error("[OAuthService] Missing code or state in callback");
        this.cancelPendingFlow();
        this.emit({ success: false, error: "Missing code or state in callback" });
        return;
      }

      if (!this.pendingAuth) {
        console.warn("[OAuthService] Received callback with no pending auth — ignoring");
        return;
      }

      // CSRF check
      if (state !== this.pendingAuth.state) {
        console.error("[OAuthService] State mismatch — possible CSRF attack!");
        this.cancelPendingFlow();
        this.emit({ success: false, error: "Security error: state mismatch" });
        return;
      }

      // Expiry check
      if (Date.now() > this.pendingAuth.expiresAt) {
        console.warn("[OAuthService] Auth callback received after timeout");
        this.cancelPendingFlow();
        this.emit({ success: false, error: "timeout" });
        return;
      }

      const { codeVerifier } = this.pendingAuth;
      this.cancelPendingFlow(); // Clear pending state before async call

      await this.exchangeCodeForToken(code, codeVerifier);
    } catch (error) {
      console.error("[OAuthService] Callback handling error:", error);
      this.cancelPendingFlow();
      this.emit({ success: false, error: "Unexpected error during authentication" });
    }
  }

  // ─── Token Exchange ────────────────────────────────────────────────────────

  /**
   * Exchanges the authorization code + PKCE verifier for JWT + refresh token.
   * On success, calls the registered result handlers with the token data.
   */
  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<void> {
    try {
      const baseUrl = resolveBackendUrl();
      const redirectUri = app.isPackaged
        ? CONFIG_API.oauth.redirectUri.prod
        : CONFIG_API.oauth.redirectUri.dev;

      console.log("[OAuthService] Exchanging auth code for tokens...");

      const response = await fetch(`${baseUrl}${API.oauthToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          client_id: CONFIG_API.oauth.clientId,
        }),
      });

      if (!response.ok) {
        let errorMsg = `Token exchange failed: ${response.status}`;
        try {
          const errData = await response.json();
          errorMsg = errData.message || errorMsg;
        } catch {}
        console.error("[OAuthService]", errorMsg);
        this.emit({ success: false, error: errorMsg });
        return;
      }

      const data = await response.json();
      const source = data.data || data;

      const jwt = source.token || source.accessToken || source.access_token;
      const refreshToken = source.refreshToken || source.refresh_token;

      if (!jwt) {
        console.error("[OAuthService] No access token in response:", source);
        this.emit({ success: false, error: "No token received from server" });
        return;
      }

      console.log(
        "[OAuthService] Token exchange successful",
        refreshToken ? "(with refresh token)" : "(no refresh token)",
      );
      // Pass tokens back via event — AuthenticationService will store them
      this.emit({ success: true, jwt, refreshToken } as any);
    } catch (error) {
      console.error("[OAuthService] Token exchange error:", error);
      this.emit({ success: false, error: "Network error during token exchange" });
    }
  }

  /**
   * Uses the stored refresh token to get a new access token.
   * Returns the new JWT or null on failure.
   */
  public async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ jwt: string | null; refreshToken: string | null }> {
    try {
      const baseUrl = app.isPackaged ? CONFIG_API.prod.api : CONFIG_API.dev.api;

      const response = await fetch(`${baseUrl}${API.tokenRefresh}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken, client_id: CONFIG_API.oauth.clientId }),
      });

      if (response.status === 401 || response.status === 403) {
        console.error(
          "[OAuthService] Refresh token invalid or revoked — all tokens revoked:",
          response.status,
        );
        return { jwt: null, refreshToken: null };
      }

      if (!response.ok) {
        console.warn("[OAuthService] Token refresh failed:", response.status, response.statusText);
        return { jwt: null, refreshToken: null };
      }
      const data = await response.json();
      const source = data.data || data;

      const newJwt = source.token || source.accessToken || source.access_token || null;
      const newRefreshToken = source.refreshToken || source.refresh_token || null;

      return { jwt: newJwt, refreshToken: newRefreshToken };
    } catch (error) {
      console.error("[OAuthService] Token refresh error:", error);
      return { jwt: null, refreshToken: null };
    }
  }

  /**
   * Revokes the refresh token on the backend (called on logout).
   */
  public async revokeTokens(refreshToken: string, accessToken: string): Promise<void> {
    try {
      const baseUrl = app.isPackaged ? CONFIG_API.prod.api : CONFIG_API.dev.api;

      await fetch(`${baseUrl}${API.oauthRevoke}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      console.log("[OAuthService] Tokens revoked on backend");
    } catch (error) {
      // Non-fatal — tokens will expire naturally
      console.warn("[OAuthService] Token revocation failed (non-fatal):", error);
    }
  }

  // ─── Internal Helpers ──────────────────────────────────────────────────────

  private cancelPendingFlow(): void {
    this.pendingAuth = null;
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  public destroy(): void {
    this.cancelPendingFlow();
    this.eventHandlers = [];
  }
}
