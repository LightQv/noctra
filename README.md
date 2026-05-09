# Noctra

Noctra is a keyboard-first browser shell for people who want Neovim-style flow inside a modern web engine.

Built on Electron today (Chromium backend), Noctra treats tabs like buffers, keeps modal navigation at the center (`NORMAL`, `INSERT`, `COMMAND`), and uses adapter/service boundaries to separate orchestration from engine-facing primitives.

## Status

Noctra is an early-stage project (`v0.1.0`) and actively evolving.

- Core modal interaction is implemented and usable.
- Keymaps are data-driven with user override support.
- Browser UX is intentionally nvim-like rather than conventional browser-like.
- APIs, commands, and default mappings may still change between minor versions.
- Security hardening is active and evidence-backed in CI; independent final re-reviews are complete, with hosted final-gate evidence refresh queued for the next PR.

## Why Noctra

- Vim mental model for browsing: motions, counts, command line, leader maps.
- Buffer-first navigation and split workflows.
- Runtime-configurable behavior from `~/.config/noctra/config.yml`.
- Clear module boundaries (`core/`, `motions/`, `browser/`, `ui/`) for maintainability.

## Features

- Modal input engine with intent dispatching.
- Browser buffer management (new, switch, close, reopen).
- Command mode (`:`) with URL open, search, session, and UI commands.
- Side panel integrations for history/bookmarks.
- Session save/restore.
- Theme controls and custom override support.
- In-app settings buffer and notifications buffer.

## Quick Start

### Requirements

- Node.js 20+ recommended
- npm 10+
- macOS, Linux, or Windows with Electron support

### Install and run

```bash
npm install
npm run start
```

### Optional environment config

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

Available variable:

- `NOCTRA_CONFIG_POLICY=customizable` (default)
- `NOCTRA_CONFIG_POLICY=strict` (forces default config on load)

## Documentation

Use this sequence if you are new:

1. [Getting Started](docs/getting-started.md)
2. [Tutorial: First 30 Minutes](docs/tutorials/first-30-minutes.md)
3. [Keybindings](docs/keybindings.md)
4. [Commands](docs/commands.md)
5. [Configuration](docs/configuration.md)

Reference docs:

- [Architecture](docs/architecture.md)
- [FAQ](docs/faq.md)
- [Security Policy](SECURITY.md)

Tutorials:

- [Customize Leader Keymap](docs/tutorials/customize-keymap.md)
- [Sessions, History, and Bookmarks](docs/tutorials/sessions-history-bookmarks.md)

## Keyboard and command preview

### Normal mode defaults (excerpt)

- `j` / `k`: scroll down/up
- `h` / `l`: scroll left/right
- `gg` / `G`: top/bottom of page
- `H` / `L`: previous/next buffer
- `i`: enter insert mode
- `o`: open URL prompt
- `b`: new buffer
- `|`: open vertical split

### Modifier defaults (excerpt)

- `Ctrl+d` / `Ctrl+u`: half page down/up
- `Ctrl+f` / `Ctrl+b`: page down/up
- `Ctrl+h` / `Ctrl+l`: focus split left/right
- `Ctrl+q`: close focused context
- `Ctrl+t`: new buffer
- `Ctrl+Shift+t`: reopen buffer

### Command mode examples

Use `:` to open command mode, then run commands such as:

- `:open github.com`
- `:tabnew https://example.com`
- `:buffer 3`
- `:bdelete`
- `:history toggle`
- `:bookmarks toggle`
- `:session save`
- `:settings`
- `:theme dark`
- `:quit`

Full command and mapping references are in [Commands](docs/commands.md) and [Keybindings](docs/keybindings.md).

## How Noctra works

Input follows a strict intent pipeline:

1. `motions/*` parses key sequences and mode-specific behavior.
2. `core/input.js` normalizes input and resolves intent payloads.
3. `core/dispatcher.js` executes intents against browser/UI services.
4. `browser/*` and `ui/*` apply results to web contents and shell UI.

This separation keeps input logic deterministic and prevents tight coupling between motion parsing and Electron internals.

## Configuration

Noctra loads config from:

- `~/.config/noctra/config.yml`

Config includes:

- Input behavior (leader key, sequence timeout)
- Leader map overrides
- UI toggles (tabline, urlline, statusline, sidepanel)
- Theme mode and color overrides
- Split behavior and focus keys
- Storage paths (history/bookmarks/sessions/notifications)
- Browser settings (language, selection-copy behavior)

See [Configuration](docs/configuration.md) for schema and examples.

## Project structure

```text
noctra/
  browser/     # webContents-backed buffer and browser actions
  core/        # state, dispatcher, parser, config, services
  motions/     # modal key handling and action builders
  ui/          # shell UI, command palette, tabline, theme
  docs/        # tutorials and reference documentation
```

## Contributing

Contributions are welcome.

Start here:

- [Contributing Guide](CONTRIBUTING.md) for workflow, standards, and PR expectations.

If you are looking for a first contribution, prioritize small improvements in docs, keymap ergonomics, and command discoverability.

## Roadmap themes

### Fixes

- [ ] Vertical spacing above whichkey hints.
- [ ] Subfolder alignment in bookmarks lists.
- [ ] Add `border-bottom` on tabline to match statusline styling.

### Next features

- [ ] Build a unified telescope for history, bookmarks, and open web buffers/tabs.
- [ ] Add in-page `/` search with a Neovim-like experience.
- [ ] Add extensions support (for example ad blockers).
- [ ] Improve web-native behavior (download management, native app events like quit handling, and related integrations).
- [ ] Stabilize keymap override and runtime reload behavior.
- [ ] Handle in-page navigation/insertion through Vim-motion flow.
- [ ] Continue deepening adapter boundaries for future multi-engine support.

## License

Noctra is licensed under the [MIT License](LICENSE).
