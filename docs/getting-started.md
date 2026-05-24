# Getting Started

This guide gets you from install to a usable daily workflow.

## 1) Install Noctra

### Option A: Download a release (recommended)

Grab the latest `.dmg` (macOS) or `.deb`/`.rpm` (Linux) from the [Releases](https://github.com/LightQv/noctra/releases) page.

On macOS, the app is currently unsigned. On first launch, right-click the app and select **Open** to bypass Gatekeeper.

### Option B: Build from source

Requirements:

- Node.js 20+
- npm 10+

```bash
npm install
npm run start
```

## 3) Learn the four modes

- `NORMAL`: navigate and trigger browser actions.
- `INSERT`: interact with web page inputs normally.
- `COMMAND`: run `:` commands.
- `SEARCH`: run in-page search and match navigation.

Basic flow:

- Press `i` to enter `INSERT` mode.
- Press `Escape` to return to `NORMAL` mode.
- Press `:` to open command mode.
- Press `/` in `NORMAL` to enter `SEARCH`, then `Enter` to submit, `n`/`N` to move, and `Escape` to clear/exit.

## 4) First useful commands

- `:open github.com` opens a URL in the current buffer.
- `:tabnew` opens a new buffer.
- `:tabnew example.com` opens a URL in a new buffer.
- `:buffer 2` switches to buffer 2.
- `:bdelete` closes active buffer.

## 5) Configure your setup

Noctra auto-creates:

- `~/.config/noctra/config.yml`

Start with these edits:

- Set your leader key under `global.input.leader_key`.
- Toggle URL line with `global.ui.urlline.enabled`.
- Customize leader mappings under `keymap.leader`.

Then run `:config-reload`.

## 6) Optional env policy

From `.env.example`:

- `NOCTRA_CONFIG_POLICY=customizable` keeps your config editable.
- `NOCTRA_CONFIG_POLICY=strict` resets config to defaults on load.

## 7) Continue learning

- [Tutorial: First 30 Minutes](docs/tutorials/first-30-minutes.md)
- [Keybindings](docs/keybindings.md)
- [Commands](docs/commands.md)
- [Configuration](docs/configuration.md)
- [Security Policy](../SECURITY.md)
