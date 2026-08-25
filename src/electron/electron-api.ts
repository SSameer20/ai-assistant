import { createRequire } from "module";
import { ipcMain } from "electron/main";

const require = createRequire(import.meta.url);
const electron = require("electron") as typeof import("electron");

export const { dialog } = electron;
export { ipcMain };
