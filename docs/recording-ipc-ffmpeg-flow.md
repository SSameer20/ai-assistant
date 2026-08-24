**Recording to IPC & FFmpeg Flow**

- **Overview:**: Simple end-to-end flow from renderer request to FFmpeg producing an output file.

**Key Files**

- **Renderer → preload:** [src/electron/preload/apis/AudioAPI.ts](src/electron/preload/apis/AudioAPI.ts)
- **Main IPC handlers:** [src/electron/icp.ts](src/electron/icp.ts)
- **Audio service:** [src/electron/services/AudioRecordingService.ts](src/electron/services/AudioRecordingService.ts)
- **IPC audio handlers:** [src/electron/ipc/handlers/AudioIPCHandlers.ts](src/electron/ipc/handlers/AudioIPCHandlers.ts)
- **System audio recorder:** [src/electron/audio/SystemAudioRecorder.ts](src/electron/audio/SystemAudioRecorder.ts)
- **FFmpeg resolver:** [src/electron/lib/FFmpegPathResolver.ts](src/electron/lib/FFmpegPathResolver.ts)

**Filename(s) & Where They're Created**

- **Default (quick recording):** `meeting-<timestamp>.wav`
  - Created in [src/electron/icp.ts](src/electron/icp.ts) when renderer sends `record:start`.
  - Uses: `const output = path.join(app.getPath("downloads"), "AI-Meetings", `meeting-${Date.now()}.wav`);`
- **Service start (programmatic):** `meeting-<Date.now()>.wav`
  - Created in [src/electron/services/AudioRecordingService.ts](src/electron/services/AudioRecordingService.ts) when `startRecording()` is called without `options.filename`.
  - Output dir default: `path.join(app.getPath("downloads"), "AI-Meetings")`.
- **System audio recording:** `system-audio-<iso-timestamp>.wav` (ISO timestamp with `:` and `.` replaced by `-`)
  - Created in [src/electron/audio/SystemAudioRecorder.ts](src/electron/audio/SystemAudioRecorder.ts).
  - Output dir default: `path.join(app.getPath("downloads"), "SystemAudio")`.
- **Overrides:** Both the service and system-audio handlers accept `filename` and `outputDir` options (see `AudioRecordingOptions` and `SystemAudioRecordingOptions`). The IPC handler for system audio (`system-audio:start`) forwards options to the service.

**IPC Channels (renderer ↔ main)**

- **Start/Stop basic recording:**
  - Renderer calls `recorder.start()` → preload sends `record:start` → handler in [src/electron/icp.ts](src/electron/icp.ts) spawns FFmpeg writing to `meeting-<ts>.wav`.
  - Renderer calls `recorder.stop()` → preload sends `record:stop` → handler kills FFmpeg.
- **Chunked audio:** Renderer sends chunks via `audio:chunk` (preload) → handled by `AudioRecordingService.processChunk()`.
- **System audio (Windows):**
  - `system-audio:start` (handle) accepts `{ outputDir?, filename?, quality? }` → service validates, resolves FFmpeg, constructs filename, spawns FFmpeg.
  - `system-audio:stop`, `system-audio:status`, `system-audio:list-devices` — for stopping and querying.

**How FFmpeg Is Invoked**

- Quick `record:start` in `icp.ts` uses platform-specific args:
  - macOS: `-f avfoundation -i :1 -ac 1 -ar 16000 -y <output>`
  - Windows: `-f dshow -i audio=Stereo Mix ... -y <output>`
- System audio uses `FFmpegPathResolver.getInstance().getFFmpegPath()` to locate a bundled or system FFmpeg binary (see [src/electron/lib/FFmpegPathResolver.ts](src/electron/lib/FFmpegPathResolver.ts)).
- The `SystemAudioRecorder` uses helper `WindowsAudioCommands` to build device-specific FFmpeg args.

**Where Files End Up**

- Default locations:
  - Basic recordings: `Downloads/AI-Meetings/meeting-<timestamp>.wav`
  - System audio: `Downloads/SystemAudio/system-audio-<iso-timestamp>.wav`
- You can override both `outputDir` and `filename` via the service API or IPC `system-audio:start` options.

**Minimal Flow Summary (renderer perspective)**

1. Renderer calls `recorder.start()` (or `system-audio:start` with options).
2. Preload forwards to IPC channel (`record:start` or `system-audio:start`).
3. Main process handler constructs output path + filename (or uses provided one).
4. Main process resolves FFmpeg path (for system audio) and spawns FFmpeg with platform-specific args.
5. FFmpeg writes the output file; stop is signaled via `record:stop` / `system-audio:stop` which kills FFmpeg.

**Notes / Gotchas**

- Basic `record:start` in `icp.ts` does not accept filename/options from the renderer; use the service API or `system-audio:start` for options.
- `FFmpegPathResolver` checks common dev/prod locations and falls back to system `ffmpeg` on PATH.
- System audio file names use an ISO timestamp (safe for files) while basic recordings use `Date.now()`.

If you want, I can add a tiny sequence diagram or example IPC call snippets next.
