# Getting Started

This guide gets you from clone to productive usage quickly.

Noctra is early-stage (`0.1.0`): expect active iteration while core modal workflows remain usable.

## 1) Install dependencies

```bash
npm install
```

## 2) Start Noctra

```bash
npm run start
```

## 3) Learn the three modes

- `NORMAL`: navigate and trigger browser actions.
- `INSERT`: interact with web page inputs normally.
- `COMMAND`: run `:` commands.

Basic flow:

- Press `i` to enter `INSERT` mode.
- Press `Escape` to return to `NORMAL` mode.
- Press `:` to open command mode.

## 4) First useful commands

- `:open github.com` opens a URL in the current buffer.
- `:tabnew` opens a new buffer.
- `:tabnew example.com` opens URL in a new buffer.
- `:buffer 2` switches to buffer 2.
- `:bdelete` closes active buffer.

## 5) Configure your setup

Noctra auto-creates:

- `~/.config/noctra/config.yml`

Start with these edits:

- Set your leader key under `global.input.leader_key`.
- Toggle URL line with `global.ui.urlline.enabled`.
- Customize leader mappings under `keymap.leader`.

## 6) Optional env policy

From `.env.example`:

- `NOCTRA_CONFIG_POLICY=customizable` keeps your config editable.
- `NOCTRA_CONFIG_POLICY=strict` resets config to defaults on load.

## 7) Continue learning

- `docs/tutorials/first-30-minutes.md`
- `docs/keybindings.md`
- `docs/commands.md`
- `docs/configuration.md`
- `SECURITY.md`
