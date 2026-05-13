<div align="center">

# NOCTRA

A keyboard-first browser shell with a Neovim-style workflow.

Current version: 0.0.0

[About](#about) · [Installation](#installation) · [Documentation](#documentation) · [Contributing](#contributing) · [Roadmap](#roadmap)

</div>

---

## About

Noctra is a keyboard-first browser shell that brings a Neovim-style workflow to web browsing.

It runs on Electron with the Chromium engine, treats tabs as buffers, and keeps modal interaction at the center of everything. Three modes drive the experience:

- `NORMAL`  — navigate, scroll, and execute commands
- `INSERT`  — interact with web content as usual
- `COMMAND` — run explicit commands (`:open`, `:tabnew`, `:buffer`, `:session save`, ...)

Noctra is early-stage and actively evolving. Core browsing and modal workflows are usable, defaults are Vim-like with configurable leader mappings, and security checks are part of the standard CI gate. Commands, mappings, and APIs can still change between versions.

---

## Installation

Prebuilt releases are available on the [Releases](https://github.com/LightQv/noctra/releases) page.

| Platform | Format | Notes |
| -------- | ------ | ----- |
| macOS    | `.dmg` | Drag to Applications. Unsigned builds show a Gatekeeper warning on first launch — right-click the app and select **Open** to bypass. |
| macOS    | `.zip` | Portable archive. |
| Linux    | `.deb` | Install with `sudo dpkg -i noctra_*.deb`. |
| Linux    | `.rpm` | Install with `sudo rpm -i noctra_*.rpm`. |

> **Note:** Homebrew and Linux package manager installations are planned but not yet available.

### Installation Directory

User configuration is loaded from:

```
~/.config/noctra/config.yml
```

If missing, it is generated automatically with defaults and inline comments.

#### Config sections

| Section | Purpose |
| ------- | ------- |
| `global.input` | Leader key and sequence timeout |
| `global.ui` | Shell UI toggles and panel behavior |
| `global.theme` | App and content appearance |
| `global.keymap` | User leader-key mappings |
| `global.editor` | Editable buffer behavior |
| `global.split` | Split ratios and focus keys |
| `global.window` | Initial window bounds and maximized state |
| `global.storage` | File locations for persisted data |
| `global.notifications` | Toast and persistence behavior |
| `global.opening_buffer` | Startup mode and dashboard settings |

#### Persisted data

Each of the following gets its own persisted file, with paths defined under `global.storage`:

- **Sessions** — saved window and buffer state
- **Bookmarks** — user bookmark collection
- **History** — browsing history
- **Notifications** — notification log
- **Downloads** — download history and metadata

Apply config changes at runtime with `:config-reload`.

---

## Documentation

### Getting Started

- [Getting Started](docs/getting-started.md)
- [Tutorial: First 30 Minutes](docs/tutorials/first-30-minutes.md)

### User Reference

- [Keybindings](docs/keybindings.md)
- [Commands](docs/commands.md)
- [Configuration](docs/configuration.md)

### Deep Dive

- [Architecture](docs/architecture.md)
- [Architecture Map](docs/architecture-map.md)
- [Intent Contract](INTENTS.md)
- [Intent Lifecycle](docs/intent-lifecycle.md)
- [Testing Guide](docs/testing.md)
- [IPC Security Checklist](docs/ipc-security-checklist.md)
- [FAQ](docs/faq.md)
- [Security Policy](SECURITY.md)
- [Release Checklist](docs/release-checklist.md)
- [Release Hygiene Status](docs/release-hygiene-status.md)

### Tutorials

- [Customize Leader Keymap](docs/tutorials/customize-keymap.md)
- [Sessions, History, and Bookmarks](docs/tutorials/sessions-history-bookmarks.md)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, contribution principles, commit style, and pull request guidelines.

---

## Roadmap

1. [ ] **Stabilize UI**
   Harden layout, panels, and visual consistency across modes.

2. [ ] **Stabilize active focus**
   Ensure reliable focus tracking between splits, buffers, and input fields.

3. [ ] **Ensure keybindings are working properly**
   Cover app-menu, leader sequences, vim-motions, and command dispatch.

4. [ ] **Full mouse support**
   Click-to-focus, scroll, and context interactions outside modal keys.

5. [ ] **Multi-window support**
   Allow multiple native windows with shared session state.

6. [ ] **CLI support**
   Basic actions: open, quit, focus, change workspace, and more.

7. [ ] **Multi-language at app-level**
   Localize UI strings and user-facing messages.

8. [ ] **Bookmark imports from other browsers**
   Import bookmarks from Chrome, Firefox, Safari, and standard formats.

9. [ ] **Enhance modern browser behavior**
   Right-click context menu, extension support, plugins, and web compatibility layers.
