<div align="center">

# Contributing to Noctra

Keyboard-first, modal, and architecture-conscious.

[Development Setup](#development-setup) · [Principles](#contribution-principles) · [Change Flow](#typical-change-flow) · [Testing](#testing) · [Documentation](#documentation-expectations) · [Issues](#reporting-issues)

</div>

---

## Development Setup

See [Getting Started](docs/getting-started.md#build-from-source) for Node.js requirements and build instructions.

Config is loaded from `~/.config/noctra/config.yml` (auto-generated if missing).

---

## Before you start

- Read `README.md` for project goals and current scope.
- Read `docs/architecture-map.md` for module boundaries before structural edits.
- Read `INTENTS.md` before changing parser/dispatcher behavior.
- Read `docs/testing.md` for test scopes and command matrix.
- For user-facing behavior changes, verify modal consistency (`NORMAL`, `INSERT`, `COMMAND`).

---

## Contribution principles

- Keep keymap behavior data-driven; avoid hardcoding in motion handlers.
- Emit intents from motion/command layers, and execute in dispatcher/services.
- Keep emitted intents aligned with `core/intents.js` and `INTENTS.md`.
- Follow `docs/intent-lifecycle.md` for any intent or contract change.
- Avoid leaking Electron-specific details across module boundaries.
- Prefer small modules and explicit domain naming.
- Keep changes focused and reviewable.

---

## Typical change flow

1. Create a branch from `main`.
2. Implement a focused change.
3. Update docs when behavior changes.
4. Manually verify the behavior in-app.
5. Open a pull request with context and rationale.

Suggested branch prefixes:

- `feat/<topic>` for features
- `fix/<topic>` for bug fixes
- `docs/<topic>` for documentation
- `refactor/<topic>` for structural cleanup

---

## Commit style

Use short, imperative commit messages that explain intent.

Examples:

- `add leader mapping for notifications buffer`
- `fix buffer reopen after focused close`
- `document session commands and defaults`

---

## Pull request checklist

- Change is scoped and does not include unrelated edits.
- Behavior is tested manually through relevant modes/commands.
- Documentation is updated (`README.md` and/or `docs/*`).
- New commands/mappings are discoverable in docs.
- No secrets or local machine artifacts are included.

---

## Testing

### Before opening a PR

Run these locally before submitting:

| Command | What it checks |
| ------- | -------------- |
| `npm run lint` | Static analysis and code style |
| `npm run format:check` | Prettier formatting compliance |
| `npm run ci:test` | Canonical local gate — same structure as CI |

For the full command matrix, policy checks, and test scopes, see [docs/testing.md](docs/testing.md).

For IPC-facing changes, complete [docs/ipc-security-checklist.md](docs/ipc-security-checklist.md) before opening a PR.

### Manual test plan

For behavior-sensitive changes, include a short verification note in your PR.

Template:

```text
Manual verification:
- Mode(s): NORMAL, INSERT, COMMAND
- Tested: key sequences and commands
- Result: expected vs observed
```

Example:

```text
Manual verification:
- NORMAL: j/k/h/l, gg/G, H/L
- COMMAND: :tabnew, :buffer 2, :bdelete, :session save, :session restore
- Leader: <leader> S s and <leader> S r
- Result: All actions dispatch correctly, session restored without crash.
```

---

## Documentation expectations

If your change affects user workflows, update at least one of:

- [docs/keybindings.md](docs/keybindings.md)
- [docs/commands.md](docs/commands.md)
- [docs/configuration.md](docs/configuration.md)
- [docs/tutorials/*](docs/tutorials/)

Keep documentation concrete and example-driven.

---

## Good first contributions

- Improve command discoverability and help text.
- Add missing docs for existing behavior.
- Polish keymap defaults and leader grouping labels.
- Improve consistency between intent names, commands, and docs.

---

## Reporting issues

When opening an issue, include:

- OS and Node/npm versions
- Reproduction steps
- Expected behavior
- Actual behavior
- Logs or screenshots if relevant

For suspected security issues, do not open a public issue. Use the private reporting path documented in [SECURITY.md](SECURITY.md).
