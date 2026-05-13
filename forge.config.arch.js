const path = require("path");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");
const { default: MakerPacman } = require("@osmn-byhn/electron-make-pacman");

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: "noctra",
    icon: path.resolve(__dirname, "assets/icons/icon"),
    osxSign: process.env.APPLE_ID
      ? {
          identity: process.env.APPLE_IDENTITY || "Developer ID Application",
          "hardened-runtime": true,
          entitlements: "entitlements.plist",
          "entitlements-inherit": "entitlements.plist",
          "signature-flags": "library",
        }
      : undefined,
    osxNotarize: process.env.APPLE_ID
      ? {
          tool: "notarytool",
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        }
      : undefined,
  },
  rebuildConfig: {},
  makers: [
    new MakerPacman(
      {
        options: {
          depends: ["gtk3", "nss", "libxss", "libxtst", "alsa-lib"],
          icon: path.resolve(__dirname, "assets/icons/icon_512.png"),
          desktopCategories: ["Network", "WebBrowser"],
        },
      },
      ["linux"]
    ),
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
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
