import electronMain from "electron/main";
const { app } = electronMain;
import path from "path";
import fs from "fs";

export class FFmpegPathResolver {
  private static instance: FFmpegPathResolver;
  private ffmpegPath: string | null = null;

  private constructor() {}

  public static getInstance(): FFmpegPathResolver {
    if (!FFmpegPathResolver.instance) {
      FFmpegPathResolver.instance = new FFmpegPathResolver();
    }
    return FFmpegPathResolver.instance;
  }

  /**
   * Get the correct FFmpeg executable path based on environment and platform
   */
  public getFFmpegPath(): string {
    if (this.ffmpegPath) {
      return this.ffmpegPath;
    }

    const platform = process.platform;
    const isPackaged = app.isPackaged;
    const ffmpegExecutable = platform === "win32" ? "ffmpeg.exe" : "ffmpeg";

    let resolvedPath: string;

    if (isPackaged) {
      // Production mode: use process.resourcesPath (standard for Electron packaging)
      // MSIX bundles resources in a specific way, process.resourcesPath is the safest bet
      resolvedPath = path.join(process.resourcesPath, "ffmpeg", ffmpegExecutable);
    } else {
      // Development mode: look in the project's resources directory
      // Using app.getAppPath() ensures we resolve relative to the root regardless of CWD
      resolvedPath = path.join(
        app.getAppPath(),
        "resources",
        "ffmpeg",
        platform === "win32" ? "win32" : "darwin",
        ffmpegExecutable,
      );
    }

    // Direct check for the resolved path
    if (fs.existsSync(resolvedPath)) {
      this.ensureExecutable(resolvedPath);
      this.ffmpegPath = resolvedPath;
      return resolvedPath;
    }

    // Fallback search strategy if primary path fails
    const fallbacks = this.getFallbackPaths(isPackaged, platform, ffmpegExecutable);
    for (const attemptPath of fallbacks) {
      if (fs.existsSync(attemptPath)) {
        this.ensureExecutable(attemptPath);
        this.ffmpegPath = attemptPath;
        return attemptPath;
      }
    }

    // Last resort: check system PATH
    this.ffmpegPath = ffmpegExecutable;
    return ffmpegExecutable;
  }

  private ensureExecutable(filePath: string): void {
    if (process.platform !== "win32") {
      try {
        const stats = fs.statSync(filePath);
        if (!(stats.mode & fs.constants.S_IXUSR)) {
          fs.chmodSync(filePath, 0o755);
        }
      } catch (error) {
        console.warn(`Could not set execute permissions on ${filePath}:`, error);
      }
    }
  }

  private getFallbackPaths(isPackaged: boolean, platform: string, executable: string): string[] {
    const paths: string[] = [];
    if (isPackaged) {
      paths.push(
        path.join(path.dirname(process.execPath), "resources", "ffmpeg", executable),
        path.join(path.dirname(process.execPath), "ffmpeg", executable),
      );
    } else {
      const root = app.getAppPath();
      paths.push(
        path.join(root, "ffmpeg", platform === "win32" ? "win32" : "darwin", executable),
        path.join(process.cwd(), "resources", "ffmpeg", platform, executable),
      );
    }
    return paths;
  }

  /**
   * Verify FFmpeg installation and get version
   */
  public async verifyFFmpeg(): Promise<string> {
    const { spawn } = await import("child_process");
    const ffmpegPath = this.getFFmpegPath();

    return new Promise((resolve, reject) => {
      // Check for architecture mismatch on macOS
      if (process.platform === "darwin") {
        const os = require("os");
        const arch = os.arch();
        // If we are on arm64 (Apple Silicon) but the binary is captured by setup.sh as x86_64,
        // it might fail if Rosetta is not installed or if executed in certain environments.
        console.log(`Verifying FFmpeg on macOS (${arch}) at: ${ffmpegPath}`);
      }

      const ffmpeg = spawn(ffmpegPath, ["-version"], { shell: true });

      let output = "";
      let errorOutput = "";

      ffmpeg.stdout?.on("data", (data) => {
        output += data.toString();
      });

      ffmpeg.stderr?.on("data", (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          const versionMatch = output.match(/ffmpeg version ([^\s]+)/);
          const version = versionMatch ? versionMatch[1] : "unknown";
          console.log(`FFmpeg verification successful: version ${version}`);
          resolve(version);
        } else {
          const detailedError = `FFmpeg verification failed with code ${code}.\nError: ${errorOutput}`;
          console.error(detailedError);

          if (process.platform === "darwin" && errorOutput.includes("bad CPU type")) {
            reject(
              new Error(
                "FFmpeg architecture mismatch detected (bad CPU type). " +
                  "You are likely running an x86_64 binary on Apple Silicon. " +
                  "Please install Rosetta 2 or use an arm64 FFmpeg binary.",
              ),
            );
          } else {
            reject(new Error(detailedError));
          }
        }
      });

      ffmpeg.on("error", (err) => {
        reject(new Error(`FFmpeg not found or not executable: ${err.message}`));
      });
    });
  }
}
