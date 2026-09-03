import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { SystemAudioRecorder } from "./SystemAudioRecorder.js";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  recommendations?: string[];
}

export class SystemAudioValidator {
  private recorder: SystemAudioRecorder;

  constructor(recorder: SystemAudioRecorder) {
    this.recorder = recorder;
  }

  /**
   * Validate system requirements for audio recording (macOS + Windows)
   */
  public async validateSystem(): Promise<ValidationResult> {
    const recommendations: string[] = [];
    const platform = process.platform;

    // Only macOS and Windows are supported
    if (platform !== "win32" && platform !== "darwin") {
      return {
        isValid: false,
        error: "System audio recording is only supported on macOS and Windows",
      };
    }

    // Check if already recording
    const status = this.recorder.getStatus();
    if (status.isRecording) {
      return {
        isValid: false,
        error: "Recording already in progress. Stop the current recording first.",
      };
    }

    // Platform-specific device validation
    if (platform === "win32") {
      try {
        // dshow enumerates capture endpoints only, so filtering by "render" would
        // always come up empty on Windows.
        const outputDevices = await this.recorder.listAudioDevices();

        if (outputDevices.length === 0) {
          return {
            isValid: false,
            error: "No audio devices found. Please connect speakers, headphones or a microphone.",
          };
        }

        if (!outputDevices.some((device) => device.isDefault)) {
          recommendations.push("No default audio device detected. Recording may fail.");
        }

        if (outputDevices.length > 1) {
          recommendations.push(
            "Multiple audio devices detected. Recording will use the default device.",
          );
        }
      } catch (error) {
        return {
          isValid: false,
          error: `Failed to enumerate audio devices: ${(error as Error).message}`,
          recommendations: [
            "Ensure Windows audio services are running",
            "Check that audio drivers are installed",
            "Restart the application with administrator privileges",
          ],
        };
      }
    }

    if (platform === "darwin") {
      // On macOS, system audio capture requires Screen Recording permission.
      // We can't programmatically check this — macOS will prompt the user.
      recommendations.push(
        "macOS requires 'Screen & System Audio Recording' permission. Grant it if prompted.",
      );
    }

    return {
      isValid: true,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }

  /**
   * Validate recording parameters
   */
  public validateRecordingOptions(options: {
    outputDir?: string;
    filename?: string;
    quality?: "standard" | "high";
  }): ValidationResult {
    const { outputDir, filename, quality } = options;

    // Validate output directory
    if (outputDir) {
      try {

        // Check if directory exists or can be created
        if (!fs.existsSync(outputDir)) {
          try {
            fs.mkdirSync(outputDir, { recursive: true });
          } catch (error) {
            return { isValid: false, error: `Cannot create output directory: ${outputDir}` };
          }
        }

        // Check disk space (require at least 100MB free)
        try {
          const freeSpace = this.getAvailableDiskSpace(outputDir);
          if (freeSpace !== null && freeSpace < 100 * 1024 * 1024) {
            return {
              isValid: false,
              error: `Insufficient disk space. At least 100MB required, but only ${Math.round(freeSpace / 1024 / 1024)}MB available.`,
            };
          }
        } catch (error) {
          console.warn("Could not check disk space:", error);
        }

        // Check write permissions
        const testFile = path.join(outputDir, "test-write.tmp");
        try {
          fs.writeFileSync(testFile, "test");
          fs.unlinkSync(testFile);
        } catch (error) {
          return { isValid: false, error: `No write permission in directory: ${outputDir}` };
        }
      } catch (error) {
        return { isValid: false, error: `Invalid output directory: ${(error as Error).message}` };
      }
    }

    // Validate filename
    if (filename) {
      const invalidChars = /[<>:"/\\|?*]/g;
      if (invalidChars.test(filename)) {
        return {
          isValid: false,
          error: 'Filename contains invalid characters: < > : " / \\ | ? *',
        };
      }

      if (filename.length > 255) {
        return { isValid: false, error: "Filename is too long (maximum 255 characters)" };
      }

      if (!filename.endsWith(".wav")) {
        return { isValid: false, error: "Filename must end with .wav extension" };
      }
    }

    // Validate quality setting
    if (quality && !["standard", "high"].includes(quality)) {
      return { isValid: false, error: "Quality must be 'standard' or 'high'" };
    }

    return { isValid: true };
  }

  /**
   * Diagnose common audio issues (platform-aware)
   */
  public async diagnoseAudioIssues(): Promise<string[]> {
    const issues: string[] = [];
    const platform = process.platform;

    issues.push("Troubleshooting steps:");

    if (platform === "darwin") {
      issues.push("1. Open System Settings > Privacy & Security > Screen & System Audio Recording");
      issues.push("2. Grant permission to this application and restart it");
      issues.push("3. Ensure audio output is active (play some audio to verify)");
      issues.push("4. Check that FFmpeg is installed (brew install ffmpeg)");
      issues.push("5. Try restarting CoreAudio: sudo killall coreaudiod");
    } else {
      issues.push("1. Close other audio applications (Discord, Teams, etc.)");
      issues.push("2. Check Windows Sound settings > Advanced > Default Format");
      issues.push("3. Disable exclusive mode in sound device properties");
      issues.push("4. Run the application as Administrator");
      issues.push("5. Update audio drivers");
      issues.push("6. Check Windows Audio service is running");
      issues.push("7. Verify FFmpeg has necessary permissions");
    }

    return issues;
  }

  /**
   * Get available disk space in bytes
   * Returns null if space cannot be determined (e.g. sandbox restrictions)
   */
  private getAvailableDiskSpace(dirPath: string): number | null {
    try {
      if (process.platform === "win32") {
        const drive = dirPath.split(":")[0] + ":";
        const output = execSync(`fsutil volume diskfree ${drive}`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"], // Ignore stderr to avoid sandbox noise
        });
        const match = output.match(/Total free bytes\s*:\s*(\d+)/);
        return match ? parseInt(match[1]) : null;
      } else {
        const output = execSync(`df -P "${dirPath}"`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        const lines = output.trim().split("\n");
        if (lines.length < 2) return null;
        const lastLine = lines[lines.length - 1];
        const fields = lastLine.split(/\s+/);
        return fields[3] ? parseInt(fields[3]) * 1024 : null; // Convert from KB to bytes
      }
    } catch (error) {
      console.warn("Disk space check failed (this is expected in some sandboxed environments):", error);
      return null;
    }
  }
}
