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
