export interface MacOSAudioDevice {
  name: string;
  id: string;
  type: "render" | "capture";
  isDefault: boolean;
}

export class MacOSAudioCommands {
  /**
   * Get avfoundation command for recording system audio.
   * `:0` = default screen + system audio source on macOS.
   * We capture only the audio channel.
   */
  public static getSystemAudioCommand(outputPath: string): string[] {
    return [
      "-f",
      "avfoundation",
      "-i",
      ":0", // Default audio input (system audio via Screen Recording permission)
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
   * High quality avfoundation capture (48kHz, 24-bit)
   */
  public static getHighQualitySystemAudioCommand(outputPath: string): string[] {
    return [
      "-f",
      "avfoundation",
      "-i",
      ":0",
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
   * Get command to list available avfoundation devices
   */
  public static getListDevicesCommand(): string[] {
    return ["-f", "avfoundation", "-list_devices", "true", "-i", "\"\""];
  }

  /**
   * Parse FFmpeg avfoundation device listing output.
   * Output format:
   *   [AVFoundation indev @ ...] AVFoundation audio devices:
   *   [AVFoundation indev @ ...] [0] MacBook Pro Microphone
   *   [AVFoundation indev @ ...] [1] External Headphones
   */
  public static parseDeviceList(output: string): MacOSAudioDevice[] {
    const devices: MacOSAudioDevice[] = [];
    const lines = output.split("\n");
    let inAudioSection = false;

    for (const line of lines) {
      // Detect audio devices section
      if (line.includes("AVFoundation audio devices")) {
        inAudioSection = true;
        continue;
      }

      // End of audio section when video section starts or empty section
      if (inAudioSection && line.includes("AVFoundation video devices")) {
        break;
      }

      if (!inAudioSection) continue;

      // Parse device entries: [AVFoundation indev @ 0x...] [0] Device Name
      const deviceMatch = line.match(/\[(\d+)\]\s+(.+)/);
      if (deviceMatch) {
        const index = deviceMatch[1];
        const name = deviceMatch[2].trim();

        // Skip "none" entries
        if (name.toLowerCase() === "none") continue;

        devices.push({
          name,
          id: index,
          type: "capture", // avfoundation lists capture devices in audio section
          isDefault: index === "0", // First device is typically the default
        });
      }
    }

    return devices;
  }
}
