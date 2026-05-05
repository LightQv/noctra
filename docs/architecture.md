# Architecture

Noctra is structured around intent-driven input handling with strict module boundaries.

## Core pipeline

1. Input events are captured and normalized.
2. Motion handlers map key sequences to action builders.
3. Action builders emit typed intents.
4. Dispatcher executes intents through browser/UI services.
5. State and visual layers synchronize.

High-level path:

`motions/* -> core/input.js -> core/dispatcher.js -> browser/* + ui/*`

## Design principles

- Modal consistency over feature sprawl.
- Data-driven keymaps over hardcoded branches.
- Clear separation of concerns between parser, state, dispatcher, and engine APIs.
- Browser actions behind stable intent boundaries.

## Important modules

- `core/state.js`: app-level mode and sequence state.
- `core/input.js`: input normalization and routing.
- `core/dispatcher.js`: intent execution boundary.
- `core/commandParser.js`: `:` command parsing.
- `core/config/*`: defaults, schema normalization, config I/O.
- `motions/*`: mode handlers, action builders, key maps.
- `browser/*`: buffer lifecycle and webContents orchestration.
- `ui/*`: shell UI widgets and theming.

## Keymap model

- NORMAL and modifier defaults are defined centrally.
- Leader tree is merged from defaults + user config.
- Runtime behavior honors normalized config schema.

## Persistence model

Persistent user data (history, bookmarks, sessions, notifications) is file-backed under `~/.config/noctra/` by default.

## Future compatibility

Noctra is built with multi-engine ambitions.

- Chromium is the current adapter target via Electron.
- Architecture aims to keep engine-specific details isolated so alternate engines can be introduced with minimal impact on motion/parser layers.
