# Plan 1: Architecture Shift to Direct LLM Providers

## Goal

Move the desktop app from a backend-mediated AI flow to a direct provider-based flow where the app talks to OpenAI, Anthropic, or Gemini without a middleware server.

## Scope

- Remove the backend dependency from the AI request path.
- Add a UI for selecting `openai`, `anthropic`, or `gemini`.
- Add a UI for entering and saving the provider API key.
- Persist provider configuration securely in the user's system under this app's data location.
- Keep the rest of the product working with minimal disruption.
- Normalize provider responses into the existing markdown-oriented UI.
- Keep audio support, but route STT through provider-specific logic.

## Assumptions to confirm

- The desktop app can still use Electron main-process storage and IPC for secrets.
- The backend login flow may remain temporarily if other features still need it, but AI generation itself will no longer depend on it.
- The UI should support one active provider at a time.
- The first implementation should favor stability over feature breadth.

## Current state summary

- `AICommunicationService` forwards payloads to a websocket backend instead of calling an LLM provider.
- `AuthenticationService` and `OAuthService` still depend on backend URLs.
- `Settings` only shows account info and logout.
- The preload and IPC layers do not expose any provider settings APIs.
- The UI already renders markdown-like content, so the response normalization layer should fit into the existing renderer flow.

## Implementation phases

### Phase 1: Define provider settings model

- Create a shared provider config type with:
  - `provider: "openai" | "anthropic" | "gemini"`
  - encrypted API key storage
  - optional default model
  - optional STT model selection
- Add a single source of truth for provider defaults and validation.
- Decide the storage key namespace so it stays dedicated to this project.

### Phase 2: Secure local persistence

- Store provider metadata in `electron-store`.
- Store secrets with `safeStorage` when available.
- Expose read/write IPC methods for provider settings.
- Ensure the renderer can load current settings without leaking the raw key.

### Phase 3: UI settings flow

- Extend the Settings page with:
  - provider selector
  - API key input
  - save/update action
  - validation and success/error states
- Keep the existing account block unless the backend auth flow is removed in this iteration.
- Make the UI copy explicit that the key is stored locally on the device.

### Phase 4: Provider adapter layer

- Replace the websocket-only AI path with a provider abstraction.
- Add adapters for:
  - OpenAI
  - Anthropic
  - Gemini
- Normalize request payloads into a common internal format.
- Normalize streaming chunks into the app's existing answer/message flow.

### Phase 5: Response cleanup and rendering

- Clean raw provider output before dispatching it to the UI.
- Preserve markdown formatting for the existing renderer.
- Ensure code blocks, lists, and headings remain stable across providers.

### Phase 6: Audio/STT integration

- Add provider-specific STT selection where needed.
- Keep the implementation minimal:
  - one abstraction for transcription
  - provider-specific adapters behind it
- Avoid duplicating the full audio pipeline.

### Phase 7: Remove stale backend coupling

- Remove or bypass websocket AI transport once the direct provider path is working.
- Trim unused backend-only assumptions from AI startup logic.
- Leave non-AI backend features alone until they are explicitly migrated or removed.

## Detailed work items

1. Add Electron IPC for provider settings read/write.
2. Add secure secret storage helpers in the main process.
3. Extend the UI types and preload bridge for provider settings.
4. Build the Settings UI for provider selection and API key entry.
5. Add provider adapter interfaces and concrete provider clients.
6. Route `ai:start` through the selected provider instead of the websocket backend.
7. Normalize streamed/provider responses into the existing UI message format.
8. Add tests or runtime verification for saved settings and provider switching.

## Acceptance criteria

- User can choose OpenAI, Anthropic, or Gemini from the UI.
- User can paste an API key and save it locally.
- Saved configuration survives app restart.
- The AI flow no longer requires the backend websocket to generate a response.
- Responses render correctly as markdown in the current UI.
- Audio/transcription still works with provider-specific selection.

## Risks

- Replacing the AI transport may expose assumptions in the current chat/store reducer.
- Secure key storage behavior may differ by platform if `safeStorage` is unavailable.
- Provider streaming formats are not identical, so the adapter layer must normalize them.
- Some backend-authenticated features may need a second migration step later.

## Suggested order of execution

1. Implement storage and IPC.
2. Implement the Settings UI.
3. Add one provider end-to-end.
4. Generalize to the remaining providers.
5. Remove backend AI coupling after the new path is stable.
