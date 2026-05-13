# Noctra

Noctra is a keyboard-first browser shell with a Neovim-style workflow.

It runs on Electron (Chromium engine), treats tabs as buffers, and keeps modal interaction at the center: `NORMAL`, `INSERT`, and `COMMAND`.

## Status

Noctra is early-stage (`v0.1.0`) and actively evolving.

- Core browsing and modal workflows are usable.
- Defaults are Vim-like, with configurable leader mappings.
- Security and regression checks are part of the standard CI test gate.
- Commands, mappings, and APIs can still change between minor versions.

## Quick Start

Requirements:

- Node.js 20+
- npm 10+

Run:

```bash
npm install
npm run start
```

Optional environment policy:

- `NOCTRA_CONFIG_POLICY=customizable` (default)
- `NOCTRA_CONFIG_POLICY=strict`

## Download

Prebuilt releases are available on the [Releases](https://github.com/LightQv/noctra/releases) page.

| Platform | Format | Notes                                                                                                                                |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| macOS    | `.dmg` | Drag to Applications. Unsigned builds show a Gatekeeper warning on first launch — right-click the app and select **Open** to bypass. |
| macOS    | `.zip` | Portable archive.                                                                                                                    |
| Linux    | `.deb` | Install with `sudo dpkg -i noctra_*.deb`.                                                                                            |
| Linux    | `.rpm` | Install with `sudo rpm -i noctra_*.rpm`.                                                                                             |

## Packaging (for developers)

Noctra uses [Electron Forge](https://www.electronforge.io/) for packaging.

```bash
# Build distributables for the current platform
npm run make

# Package only (no installer)
npm run package

# Build for a specific platform
npm run make -- --platform=darwin
npm run make -- --platform=linux
```

Output artifacts are written to `out/make/`.

### Creating a release

Releases are created via GitHub Actions. Only maintainers with write access can do this:

1. Go to **Actions → "Create Release" → "Run workflow"**.
2. Enter the version (e.g., `0.1.1`) and release notes.
3. Click **Run workflow**.
4. The workflow will bump `package.json`, create a tag, build artifacts for macOS and Linux, and publish the release automatically.

### macOS code signing

To produce a signed, notarized macOS build:

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Export your signing identity and create an app-specific password.
3. Add these repository secrets in GitHub:
   - `APPLE_ID`
   - `APPLE_PASSWORD`
   - `APPLE_TEAM_ID`
   - `APPLE_IDENTITY` (optional)

The release workflow will automatically sign and notarize when these secrets are present.

### App icons

Icons are generated from `assets/icons/icon.svg` via `scripts/generate-icons.js`. To regenerate:

```bash
node scripts/generate-icons.js
```

This produces:

- `assets/icons/icon.png` — 1024x1024 master
- `assets/icons/icon_512.png` — Linux app icon
- `assets/icons/icon.icns` — macOS app icon bundle

## Documentation

Start here:

1. [Getting Started](docs/getting-started.md)
2. [Tutorial: First 30 Minutes](docs/tutorials/first-30-minutes.md)
3. [Keybindings](docs/keybindings.md)
4. [Commands](docs/commands.md)
5. [Configuration](docs/configuration.md)

Reference:

- [Architecture](docs/architecture.md)
- [Architecture Map](docs/architecture-map.md)
- [Testing Guide](docs/testing.md)
- [Intent Contract](INTENTS.md)
- [Intent Lifecycle Workflow](docs/intent-lifecycle.md)
- [IPC Security Checklist](docs/ipc-security-checklist.md)
- [FAQ](docs/faq.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing](CONTRIBUTING.md)
- [Release Checklist](docs/release-checklist.md)
- [Release Hygiene Status](docs/release-hygiene-status.md)

Tutorials:

- [Customize Leader Keymap](docs/tutorials/customize-keymap.md)
- [Sessions, History, and Bookmarks](docs/tutorials/sessions-history-bookmarks.md)

## Preview

Normal mode examples:

- `j` / `k` scroll down/up
- `h` / `l` scroll left/right
- `gg` / `G` top/bottom
- `H` / `L` previous/next buffer
- `|` open split

Command mode examples:

- `:open github.com`
- `:tabnew`
- `:buffer 2`
- `:bdelete`
- `:session save`
- `:session restore`

## Architecture at a glance

Input flow:

`motions/* -> core/input.js -> core/dispatcher.js -> browser/* + ui/*`

Key design points:

- Motion and command layers emit intents.
- Dispatcher executes intent contracts.
- Adapter boundaries isolate Electron primitives.

## License

Noctra is licensed under the [MIT License](LICENSE).
