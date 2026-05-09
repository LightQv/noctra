# FAQ

## Is Noctra production-ready?

Not yet. It is usable and evolving, but still early-stage (`v0.1.0`).

## Why Electron?

Electron gives a fast path to ship a keyboard-first browser shell on Chromium while keeping room for adapter-based engine expansion later.

## Where is my config file?

`~/.config/noctra/config.yml`

If it does not exist, Noctra creates it automatically.

## Can I customize all keybindings?

Currently, user customization focuses on `keymap.leader`.

Core NORMAL/tree motions are intentionally fixed internally for now.

## How do I reload config without restart?

Run:

- `:config-reload`

## How do I change browser language?

Use command mode:

- `:lang en`
- `:lang fr`

You can also set `browser.language` in config.

## Where are sessions/history/bookmarks stored?

Default paths:

- `~/.config/noctra/sessions.yml`
- `~/.config/noctra/history.yml`
- `~/.config/noctra/bookmarks.yml`

## Why was my config replaced?

If `NOCTRA_CONFIG_POLICY=strict`, Noctra enforces default config each load.

Also, invalid configs can be auto-repaired and backed up.

## How can I contribute?

Start with `CONTRIBUTING.md` and open a focused pull request.

## How do I report a security vulnerability?

Use GitHub Private Vulnerability Reporting for this repository.

See `SECURITY.md` for the full policy and disclosure expectations.
