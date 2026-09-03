#!/usr/bin/env node
/**
 * Launches Electron for local development.
 *
 * Replaces `env -u ELECTRON_RUN_AS_NODE electron .`, which only works on Unix shells.
 * ELECTRON_RUN_AS_NODE is set by some editors/terminals and makes the electron binary
 * behave like plain Node, so the app window never appears.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let electronBinary;
try {
  electronBinary = require("electron");
} catch {
  console.error("Could not resolve the 'electron' package. Run `npm install` first.");
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."], { stdio: "inherit", env });

child.on("close", (code) => process.exit(code ?? 0));
child.on("error", (error) => {
  console.error("Failed to launch Electron:", error);
  process.exit(1);
});
