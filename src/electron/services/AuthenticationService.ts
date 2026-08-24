import { app, safeStorage } from "electron";
import Store from "electron-store";
import { API, CONFIG_API } from "../config/api.js";
import type { OAuthService, OAuthProvider } from "./OAuthService.js";

function resolveBackendUrl(): string {
  const envUrl =
    process.env.QLUELY_BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "";

  return envUrl || CONFIG_API.prod.api;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    plan?: string;
    isOnboarded?: boolean;
    onboardingSkipped?: boolean;
  };
}

export interface AuthTokenData {
  token: string;
  userId?: string;
  plan?: string;
  isOnboarded?: boolean;
  onboardingSkipped?: boolean;
  exp?: number;
  iat?: number;
}

export interface UserSession {
  userId: string;
  email?: string;
  plan?: string;
  isOnboarded?: boolean;
  onboardingSkipped?: boolean;
  isAuthenticated: boolean;
}

export type BillingCycle = "monthly" | "yearly" | "lifetime";
export type AccountTypes = "free" | "pro" | "enterprise";

export interface UserDetails {
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

export class AuthenticationService {
  private store: Store;
  private onAuthStateChange?: (isAuthenticated: boolean, user?: UserSession) => void;
  private onTokenExpired?: () => void;
  private oauthService?: OAuthService;

  constructor(options: {
    store: Store;
    onAuthStateChange?: (isAuthenticated: boolean, user?: UserSession) => void;
    onTokenExpired?: () => void;
    oauthService?: OAuthService;
  }) {
    this.store = options.store;
    this.onAuthStateChange = options.onAuthStateChange;
    this.onTokenExpired = options.onTokenExpired;
    this.oauthService = options.oauthService;
  }

  /**
   * Injects OAuthService after construction (avoids circular dependency)
   */
  public setOAuthService(oauthService: OAuthService): void {
    this.oauthService = oauthService;
  }

  /**
   * Completes the onboarding process for the user
   * @param data Optional role and useCases preferences
   */
  public async completeOnboarding(data?: { role?: string; useCases?: string[] }): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) return false;

      const url = resolveBackendUrl();

      // Prepare request body - include role/useCases if provided
      const body =
        data?.role && data?.useCases
          ? { role: data.role, useCases: data.useCases }
          : { isOnboarded: true };

      const response = await fetch(`${url}${API.onboarding}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        this.store.set("isOnboarded", true);
        this.store.set("onboardingSkipped", false); // Clear the skipped flag
        this.updateUserSession({ isOnboarded: true, onboardingSkipped: false });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Complete onboarding error:", error);
      return false;
    }
  }

  /**
   * Fetches user details from the backend
   */
  public async getUserDetails(): Promise<UserDetails | null> {
    try {
      const token = this.getToken();
      if (!token) {
        console.log("No token found for getUserDetails");
        return null;
      }

      const url = resolveBackendUrl();
      console.log("Fetching user details from:", `${url}${API.userDetails}`);

      const response = await fetch(`${url}${API.userDetails}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      console.log("User details response status:", response.status);

      if (response.ok) {
        const responseData = await response.json();

        // Handle both wrapped ({ data: {...} }) and unwrapped responses
        const data = (responseData.data || responseData) as UserDetails;
        console.log(data);

        // Store in electron-store for persistence
        this.store.set("userDetails", data);
        return data;
      }
      return null;
    } catch (error) {
      console.error("[ERROR] Get user details error");
      return null;
    }
  }

  /**
   * Authenticates user with email and password
   */
  public async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const url = resolveBackendUrl();

      const loginPaths = [API.login];
      let lastResponse: Response | null = null;

      for (const path of loginPaths) {
        console.log("Attempting login POST:", `${url}${path}`);
        const response = await fetch(`${url}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });

        lastResponse = response;

        if (response.ok) {
          const { data } = await response.json();
          // Store authentication data
          this.storeAuthData(data);

          // Get user session info
          const userSession = this.getCurrentSession();

          // Notify about auth state change
          this.onAuthStateChange?.(true, userSession || undefined);

          return {
            success: true,
            user: userSession
              ? {
                  id: userSession.userId,
                  email: userSession.email || credentials.email,
                  plan: userSession.plan,
                  isOnboarded: userSession.isOnboarded,
                  onboardingSkipped: userSession.onboardingSkipped,
                }
              : undefined,
          };
        }

        return this.handleLoginError(response);
      }

      if (lastResponse) {
        return this.handleLoginError(lastResponse);
      }

      return { success: false, error: "No login endpoint responded" };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Unable to connect to server" };
    }
  }

  /**
   * Handles login error responses
   */
  private async handleLoginError(response: Response): Promise<LoginResponse> {
    try {
      const rawBody = await response.text();
      let parsedBody: any = null;

      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = null;
        }
      }

      console.error("Login failed:", parsedBody || rawBody || `<empty response body, status=${response.status}>`);

      if (parsedBody?.errors) {
        // Handle validation errors
        const errorMessages = Object.values(parsedBody.errors).flat() as string[];
        return { success: false, error: errorMessages.join(", ") };
      }

      const responseMessage =
        parsedBody?.message ||
        parsedBody?.error ||
        (typeof parsedBody === "string" ? parsedBody : "") ||
        rawBody.trim();

      if (response.status === 522) {
        return {
          success: false,
          error:
            responseMessage ||
            "The login server timed out while contacting its upstream service. Please try again in a moment.",
        };
      }

      return {
        success: false,
        error: responseMessage || `Server error: ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
      };
    } catch {
      return {
        success: false,
        error: `Server error: ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
      };
    }
  }

  /**
   * Stores authentication data in secure storage
   */
  private storeAuthData(data: AuthTokenData): void {
    this.store.set("jwt", data.token);

    if (data.userId) {
      this.store.set("userId", data.userId);
    }

    // Store additional user data if available
    if (data.plan) {
      this.store.set("userPlan", data.plan);
    }

    if (data.isOnboarded !== undefined) {
      this.store.set("isOnboarded", data.isOnboarded);
    }

    if (data.onboardingSkipped !== undefined) {
      this.store.set("onboardingSkipped", data.onboardingSkipped);
    }

    // Store token expiration time for validation
    const tokenData = this.parseJWTToken(data.token);
    if (tokenData?.exp) {
      this.store.set("tokenExpiry", tokenData.exp);
    }
  }

  /**
   * Stores JWT + refresh token after a successful OAuth exchange.
   * The refresh token is encrypted using OS-level safeStorage (Keychain/DPAPI).
   */
  public storeOAuthTokens(jwt: string, refreshToken?: string): void {
    this.store.set("jwt", jwt);
    const tokenData = this.parseJWTToken(jwt);
    if (tokenData) {
      if (tokenData.userId) this.store.set("userId", tokenData.userId);
      if (tokenData.plan) this.store.set("userPlan", tokenData.plan);
      if (tokenData.exp) this.store.set("tokenExpiry", tokenData.exp);
      if (tokenData.isOnboarded !== undefined) this.store.set("isOnboarded", tokenData.isOnboarded);
    }

    if (refreshToken) {
      this.storeRefreshToken(refreshToken);
    }

    const userSession = this.getCurrentSession();
    this.onAuthStateChange?.(true, userSession || undefined);
  }

  /**
   * Encrypts and stores refresh token using Electron safeStorage (OS Keychain / DPAPI).
   */
  private storeRefreshToken(refreshToken: string): void {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(refreshToken);
        this.store.set("rt_enc", encrypted.toString("base64"));
      } else {
        // Fallback: warn and store anyway (Linux without keyring)
        console.warn(
          "[AuthService] safeStorage encryption unavailable — refresh token stored without OS encryption",
        );
        this.store.set("rt_plain", refreshToken);
      }
    } catch (err) {
      console.error("[AuthService] Failed to encrypt refresh token:", err);
    }
  }

  /**
   * Decrypts and returns the stored refresh token.
   */
  public getRefreshToken(): string | null {
    try {
      const encB64 = this.store.get("rt_enc") as string | undefined;
      if (encB64 && safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(encB64, "base64");
        return safeStorage.decryptString(buf);
      }
      // Fallback for Linux without keyring
      return (this.store.get("rt_plain") as string) || null;
    } catch (err) {
      console.error("[AuthService] Failed to decrypt refresh token:", err);
      return null;
    }
  }

  /**
   * Clears the stored refresh token from both encrypted and plain stores.
   */
  public clearRefreshToken(): void {
    this.store.delete("rt_enc");
    this.store.delete("rt_plain");
  }

  /**
   * Starts the OAuth browser flow for the specified provider.
   */
  public async loginWithOAuth(
    provider: OAuthProvider,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.oauthService) {
      return { success: false, error: "OAuth service not initialized" };
    }
    try {
      await this.oauthService.startOAuthFlow(provider);
      return { success: true };
    } catch (err) {
      console.error("[AuthService] OAuth flow error:", err);
      return { success: false, error: "Failed to start OAuth flow" };
    }
  }

  /**
   * Stores jwt token only
   */
  private storeJwtToken(token: string): void {
    this.store.set("jwt", token);

    // Store token expiration time for validation
    const tokenData = this.parseJWTToken(token);
    if (tokenData?.plan) {
      this.store.set("userPlan", tokenData.plan);
    }
    if (tokenData?.exp) {
      this.store.set("tokenExpiry", tokenData.exp);
    }
  }

  /**
   * Logs out the current user
   */
  public logout(): void {
    console.log("Logging out user");

    // Clear stored authentication data
    this.clearAuthData();

    // Notify about auth state change
    this.onAuthStateChange?.(false);
  }

  /**
   * Clears all stored authentication data
   */
  public clearAuthData(): void {
    this.store.delete("jwt");
    this.store.delete("userId");
    this.store.delete("userPlan");
    this.store.delete("isOnboarded");
    this.store.delete("onboardingSkipped");
    this.store.delete("tokenExpiry");
    this.clearRefreshToken();
  }

  /**
   * Gets the current JWT token
   */
  public getToken(): string | null {
    return (this.store.get("jwt") as string) || null;
  }

  /**
   * Checks if user is currently authenticated
   */
  public isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    // Check if token is expired but don't clear it yet
    // The caller (like startup logic) might want to try refreshing it
    if (this.isTokenExpired()) {
      return false;
    }

    return true;
  }

  /**
   * Gets current user session information
   */
  public getCurrentSession(): UserSession | null {
    const token = this.getToken();
    const userId = this.store.get("userId") as string;

    if (!token || !userId) {
      return null;
    }

    const tokenData = this.parseJWTToken(token);
    const userPlan = this.store.get("userPlan") as string;
    const isOnboarded = this.store.get("isOnboarded") as boolean;
    const onboardingSkipped = this.store.get("onboardingSkipped") as boolean;

    return {
      userId,
      plan: userPlan || tokenData?.plan,
      // Default to true if not specified to prevent repeated onboarding prompts
      // in environments where the backend might not return the flag.
      isOnboarded: isOnboarded ?? true,
      onboardingSkipped: onboardingSkipped ?? false,
      isAuthenticated: this.isAuthenticated(),
    };
  }

  /**
   * Validates the current JWT token
   */
  public validateToken(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    try {
      const tokenData = this.parseJWTToken(token);
      if (!tokenData) {
        return false;
      }

      // Check expiration but don't clear yet
      if (this.isTokenExpired(tokenData.exp)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Token validation error:", error);
      return false;
    }
  }

  /**
   * Checks if token is expired
   */
  public isTokenExpired(expiry?: number): boolean {
    if (!expiry) {
      // Check stored expiry or parse from token
      const storedExpiry = this.store.get("tokenExpiry") as number;
      if (storedExpiry) {
        expiry = storedExpiry;
      } else {
        const token = this.getToken();
        if (token) {
          const tokenData = this.parseJWTToken(token);
          expiry = tokenData?.exp;
        }
      }
    }

    if (!expiry) {
      // In development, be more lenient if no expiry is found in the token
      if (!app.isPackaged) {
        return false;
      }
      return true; // Assume expired if no expiry info in production
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const leeway = 60; // 60 seconds leeway for clock skew
    return currentTime >= expiry - leeway;
  }

  /**
   * Handles token expiration
   */
  private handleTokenExpiration(): void {
    console.log("JWT token has expired");
    this.clearAuthData();
    this.onTokenExpired?.();
  }

  /**
   * Parses JWT token to extract payload data
   */
  private parseJWTToken(token: string): AuthTokenData | null {
    try {
      // JWT tokens have 3 parts separated by dots
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }

      // Decode the payload (second part)
      const payload = parts[1];
      const decodedPayload = Buffer.from(payload, "base64").toString("utf8");

      return JSON.parse(decodedPayload) as AuthTokenData;
    } catch (error) {
      console.error("Failed to parse JWT token:", error);
      return null;
    }
  }

  /**
   * Gets user ID from current session
   */
  public getUserId(): string | null {
    return (this.store.get("userId") as string) || null;
  }

  /**
   * Gets user plan from current session
   */
  public getUserPlan(): string | null {
    return (this.store.get("userPlan") as string) || null;
  }

  /**
   * Refreshes the authentication token.
   * Uses OAuth refresh token rotation if a refresh token exists;
   * otherwise falls back to the legacy JWT refresh endpoint.
   */
  public async refreshToken(): Promise<boolean> {
    try {
      const currentToken = this.getToken();
      // Prefer OAuth refresh token rotation
      const refreshToken = this.getRefreshToken();
      if (refreshToken && this.oauthService) {
        const result = await this.oauthService.refreshAccessToken(refreshToken);
        if (result.jwt) {
          this.storeOAuthTokens(result.jwt, result.refreshToken || undefined);
          return true;
        }
        // RT rotation failed (e.g. reuse detected) — force logout
        console.warn("[AuthService] OAuth refresh token rotation failed");
        this.clearAuthData();
        this.onAuthStateChange?.(false);
        return false;
      }

      // Legacy: hit the refresh endpoint with Bearer token
      if (!currentToken) {
        return false;
      }
      const url = app.isPackaged ? CONFIG_API.prod.api : CONFIG_API.dev.api;
      const response = await fetch(`${url}${API.tokenRefresh}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
      });

      if (response.ok) {
        const responseData = await response.json();
        const data = responseData.data || responseData;

        // Some backends return the new token as 'token' or 'accessToken' or 'refreshToken' (if wrongly named)
        const newToken = data.token || data.accessToken || data.refreshToken;

        if (newToken) {
          this.storeJwtToken(newToken);
          return true;
        }
      }

      console.warn("Token refresh failed or not implemented correctly on server");
      return false;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
    }
  }

  /**
   * Updates user session data
   */
  public updateUserSession(updates: Partial<UserSession>): void {
    if (updates.userId) {
      this.store.set("userId", updates.userId);
    }
    if (updates.plan) {
      this.store.set("userPlan", updates.plan);
    }
    if (updates.isOnboarded !== undefined) {
      this.store.set("isOnboarded", updates.isOnboarded);
    }
    if (updates.onboardingSkipped !== undefined) {
      this.store.set("onboardingSkipped", updates.onboardingSkipped);
    }

    // Notify about session update
    const currentSession = this.getCurrentSession();
    if (currentSession) {
      this.onAuthStateChange?.(true, { ...currentSession, ...updates });
    }
  }

  /**
   * Checks if token will expire soon (within specified minutes)
   */
  public isTokenExpiringSoon(withinMinutes: number = 10): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    const tokenData = this.parseJWTToken(token);
    if (!tokenData?.exp) {
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const expiryTime = tokenData.exp;
    const timeUntilExpiry = expiryTime - currentTime;
    const minutesUntilExpiry = timeUntilExpiry / 60;

    return minutesUntilExpiry <= withinMinutes && minutesUntilExpiry > 0;
  }

  /**
   * Gets the time remaining until token expires (in minutes)
   */
  public getTokenExpiryTime(): number | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }

    const tokenData = this.parseJWTToken(token);
    if (!tokenData?.exp) {
      return null;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const expiryTime = tokenData.exp;
    const timeUntilExpiry = expiryTime - currentTime;

    return Math.max(0, Math.floor(timeUntilExpiry / 60)); // Return minutes
  }

  /**
   * Schedules automatic token refresh if token is expiring soon
   */
  public scheduleTokenRefresh(withinMinutes: number = 15): void {
    if (this.isTokenExpiringSoon(withinMinutes)) {
      // Specified minutes before expiry
      console.log(`Token expiring within ${withinMinutes} minutes, attempting refresh...`);
      this.refreshToken().then((success) => {
        if (!success) {
          console.warn("Token refresh failed, user will need to login again");
        }
      });
    }
  }
}
