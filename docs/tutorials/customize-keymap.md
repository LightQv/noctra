# Tutorial: Customize Leader Keymap

This tutorial shows how to create your own leader mappings safely.

## Goal

Create a `Session` leader group on `<leader> p` with save/restore actions.

## 1) Open config

- Run `:settings`, or edit `~/.config/noctra/config.yml` directly.

## 2) Add mapping tree

```yaml
keymap:
  leader:
    p:
      label: "Session"
      children:
        s:
          label: "Save session"
          action: "session_save"
        r:
          label: "Restore session"
          action: "session_restore"
```

## 3) Reload config

- Run `:config-reload`.

## 4) Verify behavior

- Press `<leader> p s` and confirm session saves.
- Press `<leader> p r` and confirm restore runs.

## Rules to keep in mind

- Only `keymap.leader` is user-configurable.
- `action` must match valid action IDs known by config schema.
- Prefer grouped mappings for discoverability.
- Core NORMAL and tree motion defaults are intentionally fixed in the current architecture.

## Troubleshooting

- If mapping is ignored, check YAML indentation.
- If action fails, ensure `action` name is valid.
- If config is invalid, Noctra can auto-repair and create a backup.
