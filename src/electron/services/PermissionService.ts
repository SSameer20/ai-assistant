import electronMain from "electron/main";
import electronCommon from "electron/common";
import { dialog } from "../electron-api.js";
const { systemPreferences } = electronMain;
const { shell } = electronCommon;

export class PermissionService {
  /**
   * Ensures the app has microphone permission on macOS.
   * If permission is not determined, it asks the user.
   * If permission is denied, it prompts the user to open settings.
   */
  static async ensureMicrophonePermission(): Promise<boolean> {
    if (process.platform !== "darwin") {
      return true;
    }

    const status = systemPreferences.getMediaAccessStatus("microphone");
    console.log(`Current microphone permission status: ${status}`);

    if (status === "granted") {
      return true;
    }

    if (status === "not-determined") {
      console.log("Microphone permission not determined, asking user...");
      const granted = await systemPreferences.askForMediaAccess("microphone");
      console.log(`Microphone permission request result: ${granted}`);
      return granted;
    }

    // Status is 'denied' or 'restricted'
    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Open Settings", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Microphone Access Required",
      message:
        "Clever AI needs microphone access to record audio and provide AI analysis. Access is currently denied.",
      detail:
        "Please click 'Open Settings' and enable microphone access for Clever AI in the Privacy & Security panel.",
    });

    if (response === 0) {
      console.log("Opening System Settings (Microphone Privacy)...");
      shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
      );
    }

    return false;
  }

  /**
   * Ensures the app has screen recording permission on macOS.
   * On macOS, screen recording permission is required for system audio loopback.
   */
  static async ensureScreenRecordingPermission(): Promise<boolean> {
    if (process.platform !== "darwin") {
      return true;
    }

    // @ts-ignore - 'screen' is valid on newer Electron versions
    const status = systemPreferences.getMediaAccessStatus("screen");
    console.log(`Current screen recording (system audio) permission status: ${status}`);

    if (status === "granted") {
      return true;
    }

    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Open Settings", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "System Audio Access Required",
      message:
        "Clever AI needs screen recording access to capture system audio. This is required for recording meetings and other system audio.",
      detail:
        "Please click 'Open Settings' and enable Screen System Audio Recording and System Audio Recording Only access for Clever AI in the Privacy & Security panel.",
    });

    if (response === 0) {
      console.log("Opening System Settings (Screen Recording Privacy)...");
      shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
      );
    }

    return false;
  }
}
