const path = require("path");
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  packagerConfig: {
    asar: true,
    // App bundle name — appears in Finder, Dock tooltip, etc.
    name: "Noctra",
    // Explicit executable name to ensure consistency across platforms
    // Fixes Linux .deb/.rpm makers failing to locate the binary
    executableName: "noctra",
    // Cross-platform icon path (Forge appends the correct extension per platform)
    icon: path.resolve(__dirname, "assets/icons/icon"),
    // macOS Info.plist extensions — register as a browser handler
    extendInfo: {
      CFBundleName: "Noctra",
      CFBundleDisplayName: "Noctra",
      CFBundleURLTypes: [
        {
          CFBundleURLName: "Noctra HTTP Handler",
          CFBundleURLSchemes: ["http", "https"],
        },
      ],
    },
    // macOS code signing configuration
    // Set environment variables to enable signing:
    // APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID
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
    {
      // macOS DMG installer
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        name: "Noctra",
        icon: path.resolve(__dirname, "assets/icons/icon.icns"),
        overwrite: true,
        debug: process.env.DEBUG === "true",
      },
    },
    {
      // macOS ZIP (portable)
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      // Linux .deb (Debian/Ubuntu)
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: {
        options: {
          maintainer: "LightQv",
          homepage: "https://github.com/LightQv/noctra",
          icon: path.resolve(__dirname, "assets/icons/icon_512.png"),
          mimeType: ["text/html", "x-scheme-handler/http", "x-scheme-handler/https"],
          categories: ["Network", "WebBrowser"],
          description:
            "A keyboard-first browser shell with a Neovim-style workflow.",
          productName: "Noctra",
          scripts: {
            postinst: path.resolve(
              __dirname,
              "scripts/linux/after-install.sh",
            ),
            postrm: path.resolve(__dirname, "scripts/linux/after-remove.sh"),
          },
        },
      },
    },
    {
      // Linux .rpm (Fedora/RHEL)
      name: "@electron-forge/maker-rpm",
      platforms: ["linux"],
      config: {
        options: {
          homepage: "https://github.com/LightQv/noctra",
          icon: path.resolve(__dirname, "assets/icons/icon_512.png"),
          mimeType: ["text/html", "x-scheme-handler/http", "x-scheme-handler/https"],
          categories: ["Network", "WebBrowser"],
          description:
            "A keyboard-first browser shell with a Neovim-style workflow.",
          productName: "Noctra",
        },
      },
    },
    {
      // Linux AppImage (universal, Arch-compatible)
      name: "@reforged/maker-appimage",
      platforms: ["linux"],
      config: {
        options: {
          bin: "noctra",
          categories: ["Network", "WebBrowser"],
          icon: path.resolve(__dirname, "assets/icons/icon_512.png"),
        },
      },
    },
    {
      // Linux ZIP (portable fallback)
      name: "@electron-forge/maker-zip",
      platforms: ["linux"],
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
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
