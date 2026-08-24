function resolveDesktopBackendUrl(): string {
  return (
    process.env.QLUELY_BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    process.env.BACKEND_URL ||
    "https://api.cleverr.tech"
  );
}

function resolveDesktopWsUrl(): string {
  return (
    process.env.QLUELY_WS_URL ||
    process.env.VITE_WS_URL ||
    process.env.WS_URL ||
    "wss://api.cleverr.tech"
  );
}

const BACKEND_URL = resolveDesktopBackendUrl();
const WS_URL = resolveDesktopWsUrl();

export const CONFIG_API = {
  dev: { api: BACKEND_URL, ws: WS_URL },
  prod: {
    api: BACKEND_URL,
    ws: WS_URL,
    // Fallback options for WebSocket connection
    wsFallbacks: [
      WS_URL,
      WS_URL.replace("wss://", "ws://"), // Allow fallback to insecure if necessary for specific networks
      WS_URL.includes(":") ? WS_URL : `${WS_URL}:443`,
    ],
  },
  /** OAuth 2.0 + PKCE configuration */
  oauth: {
    clientId: "qluely-desktop",
    redirectUri: {
      dev: "qluely-dev://oauth/callback",
      prod: "qluely://oauth/callback",
    },
  },
};

export const API = {
  login: "/api/v1/auth/login",
  auth: "/auth",
  onboarding: "/api/v1/onboarding",
  userDetails: "/api/v1/user/details",
  // OAuth 2.0 + PKCE endpoints
  oauthAuthorize: "/api/v1/auth/oauth/authorize",
  oauthToken: "/api/v1/auth/oauth/token",
  oauthRevoke: "/api/v1/auth/oauth/revoke",
  tokenRefresh: "/api/v1/auth/token/refresh",
};
