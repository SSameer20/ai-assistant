const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  packagerConfig: {
    asar: true,
    osxSign: {
      entitlements: "build/entitlements.mac.plist",
      "entitlements-inherit": "build/entitlements.mac.plist",
      "hardened-runtime": true,
      "gatekeeper-assess": false,
    },
    extendInfo: {
      NSMicrophoneUsageDescription: "This app requires microphone access for audio recording and AI analysis.",
      NSScreenCaptureUsageDescription: "This app requires screen recording access to capture system audio loopback and screenshots.",
      NSCameraUsageDescription: "This app may require camera access for future video features.",
    },
  },
  rebuildConfig: {},
  makers: [
    { name: "@electron-forge/maker-squirrel", platforms: ["win32"] },
    { name: "@electron-forge/maker-zip", platforms: ["win32", "darwin"] },
    { name: "@electron-forge/maker-dmg", platforms: ["darwin"] },
    { name: "@electron-forge/maker-deb", platforms: ["linux"] },
    { name: "@electron-forge/maker-rpm", platforms: ["linux"] },
  ],
  plugins: [
    { name: "@electron-forge/plugin-auto-unpack-natives", config: {} },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
