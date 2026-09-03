#!/usr/bin/env node
/**
 * Downloads the FFmpeg binary this app bundles, into the layout that both
 * FFmpegPathResolver (dev mode) and electron-builder's `extraResources` expect:
 *
 *   resources/ffmpeg/win32/ffmpeg.exe
 *   resources/ffmpeg/darwin/ffmpeg
 *
 * Cross-platform replacement for setup.sh, which is bash-only and wrote the Windows
 * binary to the wrong directory (resources/win).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCES = {
  win32: {
    url: "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
    executable: "ffmpeg.exe",
    targetDir: path.join(PROJECT_ROOT, "resources", "ffmpeg", "win32"),
  },
  darwin: {
    url: "https://evermeet.cx/ffmpeg/getrelease/zip",
    executable: "ffmpeg",
    targetDir: path.join(PROJECT_ROOT, "resources", "ffmpeg", "darwin"),
  },
};

// Defaults to the host platform; pass `--platform=win32` to stage the Windows binary
// from a macOS machine for a cross-build.
const platform =
  process.argv.find((arg) => arg.startsWith("--platform="))?.split("=")[1] ?? process.platform;
const source = SOURCES[platform];

if (!source) {
  console.error(`Unsupported platform: ${platform}. Only win32 and darwin bundle FFmpeg.`);
  process.exit(1);
}

const destination = path.join(source.targetDir, source.executable);

if (fs.existsSync(destination)) {
  console.log(`FFmpeg already present: ${destination}`);
  process.exit(0);
}

/**
 * Downloads a file to disk.
 *
 * Prefers curl (bundled with macOS and with Windows 10 1803+) because these archives are
 * ~100MB from slow mirrors, and undici's fetch aborts long bodies with a bare
 * "terminated". Falls back to fetch with retries when curl is unavailable.
 */
async function download(url, outPath) {
  const curl = spawnSync(
    "curl",
    [
      "-fL",
      "--retry",
      "3",
      "--retry-all-errors",
      "--connect-timeout",
      "30",
      "--progress-bar",
      "-o",
      outPath,
      url,
    ],
    { stdio: "inherit" },
  );

  if (curl.status === 0) return;
  if (curl.error && curl.error.code !== "ENOENT") {
    throw new Error(`curl failed: ${curl.error.message}`);
  }
  if (!curl.error && curl.status !== null) {
    throw new Error(`curl exited with code ${curl.status}`);
  }

  console.log("curl unavailable, falling back to fetch...");
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok || !response.body) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(outPath));
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Download attempt ${attempt} failed: ${error.message}`);
    }
  }
  throw new Error(`Download failed after 3 attempts: ${lastError?.message}`);
}

/** Extracts a zip using whatever the host OS provides — no npm dependency needed. */
function extractZip(zipPath, outDir) {
  // Extraction always runs on the host, so this branch keys off process.platform.
  const command =
    process.platform === "win32"
      ? {
          cmd: "powershell.exe",
          args: [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir}' -Force`,
          ],
        }
      : { cmd: "unzip", args: ["-o", "-q", zipPath, "-d", outDir] };

  const result = spawnSync(command.cmd, command.args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Failed to extract ${zipPath} (exit code ${result.status})`);
  }
}

/** Depth-first search for the extracted executable — archive layouts differ per source. */
function findExecutable(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findExecutable(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "qluely-ffmpeg-"));
const zipPath = path.join(workDir, "ffmpeg.zip");

try {
  console.log(`Downloading FFmpeg for ${platform}...`);
  await download(source.url, zipPath);

  console.log("Extracting...");
  const extractDir = path.join(workDir, "extracted");
  fs.mkdirSync(extractDir, { recursive: true });
  extractZip(zipPath, extractDir);

  const binary = findExecutable(extractDir, source.executable);
  if (!binary) {
    throw new Error(`${source.executable} was not found in the downloaded archive`);
  }

  fs.mkdirSync(source.targetDir, { recursive: true });
  fs.copyFileSync(binary, destination);
  if (platform !== "win32") {
    fs.chmodSync(destination, 0o755);
  }

  console.log(`Done. FFmpeg saved to ${destination}`);
} catch (error) {
  console.error("FFmpeg setup failed:", error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
