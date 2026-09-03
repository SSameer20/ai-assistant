export interface WindowsAudioDevice {
  name: string;
  /** Value to pass to FFmpeg's dshow demuxer, e.g. `audio=Microphone (Realtek)`. */
  id: string;
  type: "render" | "capture";
  isDefault: boolean;
}

/**
 * FFmpeg command helpers for Windows.
 *
 * Note on demuxers: FFmpeg has no `wasapi` input demuxer — DirectShow (`dshow`) is the
 * Windows audio input. dshow can only see *capture* endpoints, so recording the system
 * output through FFmpeg requires a loopback device such as "Stereo Mix" or VB-Cable.
 * Live system-audio capture no longer goes through FFmpeg at all: it uses Electron's
 * native WASAPI loopback via getDisplayMedia (see DisplayMediaService). These commands
 * remain for device enumeration and offline/local capture.
 */
export class WindowsAudioCommands {
  /**
   * Record from the default DirectShow audio capture device.
   */
  public static getSystemAudioCommand(outputPath: string): string[] {
    return [
      "-f",
      "dshow",
      "-i",
      "audio=default",
      "-ar",
      "44100", // Sample rate: 44.1 kHz
      "-ac",
      "2", // Channels: Stereo
      "-acodec",
      "pcm_s16le", // Codec: 16-bit PCM
      "-y", // Overwrite output file
      outputPath,
    ];
  }

  /**
   * Record from a specific DirectShow device.
   */
  public static getSystemAudioCommandWithDevice(deviceId: string, outputPath: string): string[] {
    return [
      "-f",
      "dshow",
      "-i",
      deviceId.startsWith("audio=") ? deviceId : `audio=${deviceId}`,
      "-ar",
      "44100",
      "-ac",
      "2",
      "-acodec",
      "pcm_s16le",
      "-y",
      outputPath,
    ];
  }

  /**
   * List available DirectShow devices. FFmpeg writes the list to stderr and exits
   * non-zero — that is expected.
   */
  public static getListDevicesCommand(): string[] {
    return ["-list_devices", "true", "-f", "dshow", "-i", "dummy"];
  }

  /**
   * Higher quality variant with light cleanup filters.
   */
  public static getHighQualitySystemAudioCommand(outputPath: string): string[] {
    return [
      "-f",
      "dshow",
      "-i",
      "audio=default",
      "-ar",
      "48000", // Higher sample rate
      "-ac",
      "2",
      "-af",
      "highpass=f=80,lowpass=f=12000,dynaudnorm=f=75:g=25:p=0.95", // Audio filters
      "-acodec",
      "pcm_s24le", // 24-bit depth
      "-y",
      outputPath,
    ];
  }

  /**
   * Parse FFmpeg's dshow device listing.
   *
   * Expected shape:
   *   [dshow @ 000..] DirectShow audio devices
   *   [dshow @ 000..]  "Microphone (Realtek(R) Audio)"
   *   [dshow @ 000..]     Alternative name "@device_cm_{33D9A762-...}"
   */
  public static parseDeviceList(output: string): WindowsAudioDevice[] {
    const devices: WindowsAudioDevice[] = [];
    const lines = output.split("\n");
    let inAudioSection = false;

    for (const line of lines) {
      if (/DirectShow video devices/i.test(line)) {
        inAudioSection = false;
        continue;
      }
      if (/DirectShow audio devices/i.test(line)) {
        inAudioSection = true;
        continue;
      }
      if (!inAudioSection) continue;

      // Alternative-name lines describe the device above, not a new one.
      if (/Alternative name/i.test(line)) {
        const alt = line.match(/"([^"]+)"/)?.[1];
        if (alt && devices.length > 0) {
          devices[devices.length - 1].id = alt;
        }
        continue;
      }

      const name = line.match(/^\s*\[dshow @ [^\]]+\]\s+"([^"]+)"/)?.[1];
      if (!name) continue;

      const clean = name.replace(/[\r\n\t]/g, " ").trim();
      if (!clean) continue;

      devices.push({
        name: clean,
        id: clean,
        // dshow only enumerates capture endpoints.
        type: "capture",
        isDefault: devices.length === 0,
      });
    }

    if (devices.length === 0) {
      console.warn("No dshow audio devices parsed from FFmpeg output");
    }

    return devices;
  }
}
