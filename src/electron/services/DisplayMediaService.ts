import electronMain from "electron/main";
const { desktopCapturer, screen, session } = electronMain;

let registered = false;

/**
 * Registers the session-wide handler that answers `navigator.mediaDevices.getDisplayMedia()`
 * calls made from the preload script.
 *
 * Without this handler Electron rejects every getDisplayMedia() request, which is why
 * system audio capture never started on Windows. On Windows we answer with
 * `audio: "loopback"`, which routes the default render endpoint through WASAPI loopback —
 * no FFmpeg process involved.
 *
 * macOS is served by `electron-audio-loopback` (see main.ts), which installs its own
 * handler on the same session, so we stay out of its way there.
 */
export function registerDisplayMediaHandler(): void {
  if (registered) return;
  if (process.platform === "darwin") {
    console.log("[DisplayMedia] Skipping handler on macOS (electron-audio-loopback owns it)");
    return;
  }

  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        // desktopCapturer is called directly (rather than through ScreenCaptureService)
        // because Electron needs the real DesktopCapturerSource object here, not the
        // serialisable shape that service returns to the renderer.
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: { width: 0, height: 0 },
        });

        if (!sources || sources.length === 0) {
          console.error("[DisplayMedia] No screen sources available");
          callback({});
          return;
        }

        const primaryId = String(screen.getPrimaryDisplay().id);
        const source = sources.find((s) => s.display_id === primaryId) ?? sources[0];

        if (!request.audioRequested) {
          console.warn("[DisplayMedia] Request did not ask for audio; granting video only");
          callback({ video: source });
          return;
        }

        // "loopback" is Windows-only in Electron; other platforms get no audio track,
        // which the preload surfaces as an explicit error instead of silent dead air.
        const audio = process.platform === "win32" ? ("loopback" as const) : undefined;
        console.log(
          `[DisplayMedia] Granting source "${source.name}" (${source.id}) audio=${audio ?? "none"}`,
        );
        callback({ video: source, audio });
      } catch (error) {
        console.error("[DisplayMedia] Failed to resolve a capture source:", error);
        callback({});
      }
    },
    // Never hand the user the OS picker dialog — the overlay must stay invisible.
    { useSystemPicker: false },
  );

  registered = true;
  console.log("[DisplayMedia] Handler registered");
}
