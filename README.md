# AI Assistant (Qluely / "Clever AI")

A desktop AI assistant built with React, TypeScript, Vite, and Electron. Provides an
always-on-top overlay with AI chat, screen capture and image analysis, and live system
audio transcription — while staying hidden from screen sharing.

## Features

- 🤖 AI-powered chat interface with streaming responses
- 📸 Screen capture and image analysis
- 🎙️ System audio capture with live transcription
- 🫥 Hidden from screen share (content protection) and from the taskbar / Alt-Tab
- 🌐 Windows, macOS and Linux desktop builds
- ⚡ Fast development with Vite

## Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js 20+ | 22+ recommended — `electron-builder` and some transitive deps warn below 22.12 |
| npm | Lockfile is npm; `package-lock.json` is committed |
| Git | |
| `curl` | Used by the FFmpeg setup script. Preinstalled on macOS and Windows 10 1803+ |

## Setup

```bash
npm install
npm run setup    # downloads the FFmpeg binary for your platform
npm run dev      # builds web + main process, then launches Electron
```

`npm run setup` places the binary where both dev mode and the packager expect it:

```
resources/ffmpeg/win32/ffmpeg.exe     # Windows
resources/ffmpeg/darwin/ffmpeg        # macOS
```

The directory is gitignored, so this step must be re-run on a fresh clone and in CI.
It is idempotent — it exits immediately if the binary is already present.

### Configuration

The provider API key is entered in the app's **Settings** screen and stored via
`electron-store`. It is not read from a `.env` file.

Backend endpoints can be overridden with real environment variables (nothing loads
`.env` automatically — there is no `dotenv` dependency):

| Variable | Default |
| --- | --- |
| `QLUELY_BACKEND_URL` | `https://api.cleverr.tech` |
| `QLUELY_WS_URL` | `wss://api.cleverr.tech` |
| `QLUELY_ENABLE_AUDIO_LOOPBACK` | unset — set to `1` to enable macOS loopback in dev |

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Full loop: build renderer (dev mode) → compile main/preload → launch Electron |
| `npm run dev:web` | Vite dev server for the renderer only (no Electron shell) |
| `npm run dev:app` | Launch Electron against the last build |
| `npm run build` | Production build of renderer + main process |
| `npm run lint` | ESLint |

Build outputs: `dist-react/` (renderer), `dist-app/` (main + preload).

## Building installers

Release builds use **electron-builder**, configured in `electron-builder.json`.
Output lands in `release/`.

Always run `npm run build` (and `npm run setup`) first — the packager bundles
`dist-app/`, `dist-react/`, `assets/**` and the staged FFmpeg binary, it does not
compile anything itself.

```bash
npm run build
npm run win-app      # Windows  → release/*.exe   (NSIS installer, x64)
npm run mac-app      # macOS    → release/*.dmg   (x64 + arm64)
npm run linux-app    # Linux    → release/*.AppImage and *.deb
npm run app          # current platform, default targets
```

### Windows

- Target: NSIS installer, x64, `requestedExecutionLevel: asInvoker` (no admin prompt).
- Install mode is per-user with a selectable install directory (`oneClick: false`).
- Bundles `resources/ffmpeg/win32/ffmpeg.exe` → `resources/ffmpeg/ffmpeg.exe` in the
  installed app.
- Registers the `qluely://` and `qluely-dev://` URI schemes for OAuth deep links.
- Builds are **unsigned** (`verifyUpdateCodeSignature: false`), so SmartScreen will warn
  on first run and auto-update signatures are not verified. Add a code-signing
  certificate before shipping to end users.

To cross-build from macOS or Linux you must stage the Windows FFmpeg binary first:

```bash
node scripts/setup-ffmpeg.mjs --platform=win32
npm run build && npm run win-app
```

### macOS

- Target: DMG for both `x64` and `arm64`.
- Bundles `resources/ffmpeg/darwin/ffmpeg`. The setup script pulls a binary matching the
  host architecture; on Apple Silicon an x86_64 binary needs Rosetta 2.
- Requires macOS to build (DMG creation uses macOS-only tooling).
- Builds are **unsigned and un-notarized** (`identity: null`, `hardenedRuntime: false`),
  so Gatekeeper quarantines the download. Users must right-click → Open, or run
  `xattr -dr com.apple.quarantine "/Applications/Clever AI.app"`.
- Entitlements for microphone and screen recording are declared in `extendInfo`.
  System audio capture needs **Screen & System Audio Recording** permission, which macOS
  prompts for on first use.

### Linux

- Targets: AppImage and `.deb`.
- `.deb` packaging needs `dpkg` and `fakeroot` on the build machine — easiest on Linux
  or in a container.
- FFmpeg is **not** bundled for Linux (`electron-builder.json` declares `extraResources`
  for Windows and macOS only), and the setup script covers those two platforms.
  System audio capture is unsupported on Linux.

### Auto-update publishing

`electron-builder.json` publishes to the S3 bucket `qluely-desktop-bin`
(`ap-south-1`, path `win`). Publishing requires AWS credentials in the environment:

```bash
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... npx electron-builder --win --publish always
```

### A note on electron-forge

`forge.config.cjs` and the `start` / `package` / `make` scripts are a second, parallel
packaging setup. It does **not** bundle the FFmpeg binary and does not share
`electron-builder.json`'s targets or protocol registration. Use the electron-builder
scripts above for anything you intend to ship.

## Platform support matrix

| Feature | Windows | macOS | Linux |
| --- | --- | --- | --- |
| AI chat, screenshots | ✅ | ✅ | ✅ |
| System audio capture | ✅ WASAPI loopback via `getDisplayMedia` | ✅ via `electron-audio-loopback` | ❌ |
| Hidden from screen share | ✅ Windows 10 2004+ | ✅ | ⚠️ compositor-dependent |
| Hidden from taskbar / Alt-Tab | ✅ | ✅ (dock hidden when packaged) | ⚠️ WM-dependent |
| Bundled FFmpeg | ✅ | ✅ | ❌ |

Speech-to-text is currently wired for OpenAI only; audio is captured but not transcribed
when another provider is configured.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` / `Cmd` + `/` | Show / hide the overlay |
| `Ctrl` / `Cmd` + `X` | Quit |
| `Ctrl` / `Cmd` + `Shift` + `I` | Escape interactive (click-through) mode |
