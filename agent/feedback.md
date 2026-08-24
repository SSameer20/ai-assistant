## Architecture Feedback

The requested shift is valid, but the current codebase is still strongly centered on backend-authenticated flows. The rewrite is not just the AI transport layer; it also affects login, token storage, websocket usage, and the settings surface.

### What is currently coupled to the backend

- `src/electron/services/AuthenticationService.ts` still logs in against backend URLs, stores JWT/refresh token state, and uses backend-backed onboarding and user details APIs.
- `src/electron/services/OAuthService.ts` opens backend OAuth authorization URLs and exchanges the code at backend endpoints.
- `src/electron/services/WebSocketManager.ts` is part of the AI response path, so the assistant currently relies on a websocket backend to deliver chunks.
- `src/electron/services/AICommunicationService.ts` only validates the payload and forwards it to the websocket layer. It does not talk to an LLM provider directly.
- `src/ui/components/Settings.tsx` has account details and logout, but no provider selection, API key entry, or local model configuration.

### Main gap against the new requirement

- The app does not yet have a provider-aware local AI configuration model.
- There is no secure local storage flow for API keys tied to the desktop app/project name.
- The renderer API does not expose any settings endpoints for saving provider credentials.
- The current AI flow assumes authenticated backend transport, which conflicts with the requested direct-to-provider architecture.

### Important design constraint

- API keys should not be stored in `localStorage` or plaintext `electron-store`.
- The implementation should use OS-backed encrypted storage where possible, or at minimum `safeStorage` plus `electron-store` for metadata.

### Recommendation

- Keep the existing product behavior intact where possible, but isolate the backend-dependent auth flow from the new provider-based AI flow.
- Introduce a small provider settings module first, then move AI transport behind a provider adapter layer.
- Defer larger auth cleanup until the direct provider path is working, unless auth is proven unnecessary for the new desktop-only model.

### Risks to resolve early

- Whether the backend login flow remains required for app access after this architecture shift.
- Whether the AI request path should run from the main process or renderer process.
- How streaming responses and markdown rendering will be normalized across OpenAI, Anthropic, and Gemini.
- How model-specific STT will be selected for audio features without reintroducing server dependency.
