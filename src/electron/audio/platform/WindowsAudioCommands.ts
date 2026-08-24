export interface WindowsAudioDevice {
  name: string;
  id: string;
  type: "render" | "capture";
  isDefault: boolean;
}

export class WindowsAudioCommands {
  /**
   * Get WASAPI loopback command for recording system audio
   */
  public static getSystemAudioCommand(outputPath: string): string[] {
    return [
      "-f",
      "wasapi",
      "-i",
      "default", // Default system output device
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
   * Get WASAPI loopback command with specific device
   */
  public static getSystemAudioCommandWithDevice(deviceId: string, outputPath: string): string[] {
    return [
      "-f",
      "wasapi",
      "-i",
      `audio=${deviceId}`,
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
   * Get command to list available WASAPI devices
   */
  public static getListDevicesCommand(): string[] {
    return ["-f", "wasapi", "-list_devices", "true", "-i", "dummy"];
  }

  /**
   * Get enhanced quality command with noise reduction
   */
  public static getHighQualitySystemAudioCommand(outputPath: string): string[] {
    return [
      "-f",
      "wasapi",
      "-i",
      "default",
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
   * Parse FFmpeg device list output to extract Windows audio devices
   */
  public static parseDeviceList(output: string): WindowsAudioDevice[] {
    const devices: WindowsAudioDevice[] = [];
    const lines = output.split("\n");
    let currentType: "render" | "capture" | null = null;

    for (const line of lines) {
      // Detect device type sections
      if (line.includes("DirectSound capture devices") || line.includes("wasapi capture devices")) {
        currentType = "capture";
        continue;
      }
      if (line.includes("DirectSound output devices") || line.includes("wasapi output devices")) {
        currentType = "render";
        continue;
      }

      if (!currentType) continue;

      // Parse device entries with improved regex for special characters
      // Handle both quoted and unquoted device names
      const deviceMatch = line.match(
        /\[(?:wasapi|dshow) @ [^\]]+\]\s+(?:"([^"]+)"|([^\s]+[^\(]*))\s*(?:\(([^\)]+)\))?/,
      );

      if (deviceMatch) {
        // Extract name from either quoted or unquoted match
        const name = (deviceMatch[1] || deviceMatch[2] || "Unknown Device").trim();
        const id = deviceMatch[3] || name; // Use description as ID if available, otherwise name
        const isDefault = line.toLowerCase().includes("default") || line.includes("[default]");

        // Skip empty or invalid device names
        if (name && name !== "Unknown Device" && !name.startsWith("Alternative name")) {
          devices.push({
            name: name.replace(/[\r\n\t]/g, " ").trim(), // Clean up whitespace
            id: id.replace(/[\r\n\t]/g, " ").trim(),
            type: currentType,
            isDefault,
          });
        }
      }
    }

    // If no devices found, try alternative parsing methods
    if (devices.length === 0) {
      console.warn("No devices found with primary parser, trying fallback parsing");
      return this.fallbackDeviceParsing(output);
    }

    return devices;
  }

  /**
   * Fallback device parsing for different FFmpeg output formats
   */
  private static fallbackDeviceParsing(output: string): WindowsAudioDevice[] {
    const devices: WindowsAudioDevice[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
      // Look for any line that might contain device information
      if (
        line.includes("audio") &&
        (line.includes(":") || line.includes("(") || line.includes("[")) &&
        !line.includes("@")
      ) {
        // Extract device name from various formats
        let name = "Unknown Device";
        if (line.includes('"')) {
          const quoted = line.match(/"([^"]+)"/)?.[1];
          if (quoted) name = quoted;
        } else {
          // Try to extract meaningful text
          const cleaned = line.replace(/^[\s\[\]\w@\s]+/, "").trim();
          if (cleaned.length > 2) name = cleaned.split("(")[0].trim();
        }

        if (name !== "Unknown Device") {
          devices.push({
            name: name,
            id: name,
            type: "render", // Assume render device for fallback
            isDefault: line.toLowerCase().includes("default"),
          });
        }
      }
    }

    return devices;
  }
}
