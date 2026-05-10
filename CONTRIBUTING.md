# Contributing to Noctra

Thanks for your interest in contributing to Noctra.

This project is keyboard-first, modal, and architecture-conscious. Contributions that preserve those principles are the most valuable.

## Before you start

- Read `README.md` for project goals and current scope.
- Read `AGENTS.md` for architecture guardrails and design priorities.
- Read `INTENTS.md` before changing parser/dispatcher behavior.
- For user-facing behavior changes, verify modal consistency (`NORMAL`, `INSERT`, `COMMAND`).

## Development setup

```bash
npm install
npm run start
```

Config is loaded from `~/.config/noctra/config.yml` (auto-generated if missing).

## Contribution principles

- Keep keymap behavior data-driven; avoid hardcoding in motion handlers.
- Emit intents from motion/command layers, and execute in dispatcher/services.
- Keep emitted intents aligned with `core/intents.js` and `INTENTS.md`.
- Avoid leaking Electron-specific details across module boundaries.
- Prefer small modules and explicit domain naming.
- Keep changes focused and reviewable.

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

## Commit style

Use short, imperative commit messages that explain intent.

Examples:

- `add leader mapping for notifications buffer`
- `fix buffer reopen after focused close`
- `document session commands and defaults`

## Pull request checklist

- Change is scoped and does not include unrelated edits.
- Behavior is tested manually through relevant modes/commands.
- Documentation is updated (`README.md` and/or `docs/*`).
- New commands/mappings are discoverable in docs.
- No secrets or local machine artifacts are included.

## Testing guidance

Noctra has automated tests and a canonical CI gate:

- Run `npm run lint` for static checks.
- Run `npm run format:check` for formatting checks.
- Run `npm run check:intents` for intent contract/doc parity.
- Run `npm test` for unit/contract coverage.
- Run `npm run ci:test` for the canonical local parity/security smoke gate.

Also include a short manual test plan for behavior-sensitive changes.

At minimum, list:

- Mode(s) tested
- Key sequence(s) tested
- Command(s) tested
- Expected and observed outcomes

Example PR test note:

```text
Manual verification:
- NORMAL: j/k/h/l, gg/G, H/L
- COMMAND: :tabnew, :buffer 2, :bdelete, :session save, :session restore
- Leader: <leader> S s and <leader> S r
Result: All actions dispatch correctly, session restored without crash.
```

## Documentation expectations

If your change affects user workflows, update at least one of:

- `docs/keybindings.md`
- `docs/commands.md`
- `docs/configuration.md`
- `docs/tutorials/*`

Keep documentation concrete and example-driven.

## Good first contributions

- Improve command discoverability and help text.
- Add missing docs for existing behavior.
- Polish keymap defaults and leader grouping labels.
- Improve consistency between intent names, commands, and docs.

## Reporting issues

When opening an issue, include:

- OS and Node/npm versions
- Reproduction steps
- Expected behavior
- Actual behavior
- Logs or screenshots if relevant

For suspected security issues, do not open a public issue. Use the private reporting path documented in `SECURITY.md`.

## Code of conduct

Please follow `CODE_OF_CONDUCT.md` in all project spaces.
