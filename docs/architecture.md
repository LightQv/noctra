# Architecture

Noctra uses an intent-driven architecture: inputs are parsed into intents, then executed by a dispatcher against browser and UI services.

## Runtime flow

High-level path:

`motions/* -> core/input.js -> core/dispatcher.js -> browser/* + ui/*`

Flow details:

1. Keyboard input enters mode handlers in `motions/*`.
2. `core/input.js` normalizes and routes input by mode and context.
3. Motion and command parsers emit intent objects from `core/intents.js`.
4. `core/dispatcher.js` executes intents via domain handlers.
5. Browser and UI modules apply side effects and sync visual state.

## Module responsibilities

- `main.js`: app bootstrap and orchestration entrypoint.
- `core/state.js`: shared runtime state.
- `core/input.js`: input normalization and mode/context routing.
- `core/dispatcher.js`: intent execution boundary.
- `core/commandParser.js`: `:` command parsing.
- `core/config/*`: defaults, schema normalization, config I/O.
- `motions/*`: mode behavior and mapping resolution.
- `browser/*`: buffers, splits, webContents lifecycle.
- `ui/*`: shell rendering, overlays, settings, notifications.

## Adapter boundaries

Noctra isolates Electron-specific primitives behind adapters where possible.

Platform adapters (`core/adapters/platform/*`) cover operations such as:

- BrowserView lifecycle and layout hosts
- webContents event binding and observers
- security and IPC registration boundaries
- devtools and content view host operations

Renderer adapters (`core/adapters/renderer/*`) cover operations such as:

- shell patch transport
- panel render transport
- editor surface bridge calls

These boundaries are active today, but extraction is still incremental across some lifecycle-sensitive paths.

## Keymap model

- Normal and modifier defaults are data-driven.
- Leader mappings merge defaults with user overrides from config.
- Runtime guards and context routing apply after keymap resolution.

## Data model

User data is file-backed under `~/.config/noctra/` by default:

- `history.yml`
- `bookmarks.yml`
- `sessions.yml`
- `notifications.yml`

## Engine scope

Current runtime engine is Chromium through Electron.
The architecture is designed to keep engine details isolated, but multi-engine runtime support is a future goal, not a current feature.
