# Configuration

Noctra loads user configuration from:

- `~/.config/noctra/config.yml`

If missing, it is generated automatically with defaults and inline comments.

## Config policy

Set in `.env`:

- `NOCTRA_CONFIG_POLICY=customizable` (default): keep and normalize user config.
- `NOCTRA_CONFIG_POLICY=strict`: overwrite with defaults each load.

## Main sections

- `global.input`: leader key and sequence timeout
- `global.whichkey`: helper panel behavior
- `global.editor`: editable buffer behavior
- `global.ui`: shell UI toggles and panel tuning
- `global.theme`: app/content theme mode and overrides
- `global.split`: split ratios and focus keys
- `global.storage`: file locations for persisted data
- `global.notifications`: toast and persistence behavior
- `global.window`: initial window bounds and maximized state
- `global.opening_buffer`: startup mode and dashboard settings
- `keymap.leader`: user leader-key mappings
- `browser`: language and clipboard-selection behavior

## Minimal example

```yaml
global:
  input:
    leader_key: "Space"
    sequence_timeout_ms: 500
  ui:
    urlline:
      enabled: true
  theme:
    mode: "auto"
    content_mode: "match"

keymap:
  leader:
    s:
      label: "Session"
      children:
        s:
          label: "Save"
          action: "session_save"
        r:
          label: "Restore"
          action: "session_restore"

browser:
  language: "en"
  copy_selection_to_clipboard: false
```

## Theme modes

`global.theme.mode` accepts:

- `dark`
- `light`
- `auto`
- `custom`

`global.theme.content_mode` accepts:

- `dark`
- `light`
- `auto`
- `match`

## Leader mapping rules

- Only `keymap.leader` is user-configurable.
- Node supports either `action` or nested `children`.
- `action` must be a known action ID accepted by config schema.

## Storage defaults

By default:

- `~/.config/noctra/history.yml`
- `~/.config/noctra/bookmarks.yml`
- `~/.config/noctra/sessions.yml`
- `~/.config/noctra/notifications.yml`

## Safety and recovery

- Invalid config files are auto-repaired.
- Prior invalid files are backed up with `.bak` suffix.
