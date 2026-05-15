# Keybindings

This page documents current default keybindings.

Notes:

- Normal and modifier defaults are built-in.
- Leader mappings are configurable through `keymap.leader`.
- Tree-local edit/navigation shortcuts in the side panel are internal for now.

## NORMAL mode

- `j`: scroll down
- `k`: scroll up
- `h`: scroll left
- `l`: scroll right
- `gg`: scroll to top
- `G`: scroll to bottom
- `gh`: history back
- `gl`: history forward
- `r`: reload page
- `.`: repeat last action
- `H`: previous buffer
- `L`: next buffer
- `i`: enter insert mode
- `o`: open URL prompt
- `b`: new buffer
- `|`: vertical split

## Modifier keys (Ctrl)

- `Ctrl+d`: half-page down
- `Ctrl+u`: half-page up
- `Ctrl+f`: page down
- `Ctrl+b`: page up
- `Ctrl+[` : history back
- `Ctrl+]`: history forward
- `Ctrl+h`: focus split left
- `Ctrl+l`: focus split right
- `Ctrl+q`: close focused context
- `Ctrl+t`: new buffer
- `Ctrl+Shift+t`: reopen last closed buffer

## App menu accelerators

- `CmdOrCtrl+[` : previous page
- `CmdOrCtrl+]`: next page
- `CmdOrCtrl+Shift+S`: save session snapshot
- `CmdOrCtrl+Shift+Y`: restore session snapshot
- `CmdOrCtrl+Shift+R`: hard reload current page

## Leader mappings (default)

Leader key default is `Space`.

- `<leader> ,`: open settings buffer
- `<leader> Tab`: toggle focus context (`SHELL`/`EDITOR`)
- `<leader> b c`: close current buffer
- `<leader> b l`: close right buffers
- `<leader> b h`: close left buffers
- `<leader> b u`: reopen last closed buffer
- `<leader> c c`: close current buffer
- `<leader> c l`: close right buffers
- `<leader> c h`: close left buffers
- `<leader> s q`: close right split
- `<leader> s d`: open devtools split
- `<leader> S s`: save session snapshot
- `<leader> S r`: restore session snapshot
- `<leader> u`: toggle URL line
- `<leader> y`: toggle copy selection to clipboard
- `<leader> e`: toggle side-tree/history panel
- `<leader> o`: toggle tree focus
- `<leader> d r`: bookmark active page at root level
- `<leader> d d`: bookmark active page with path prompt
- `<leader> n`: open notifications buffer

## Customize leader mappings

Edit `~/.config/noctra/config.yml`:

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

Valid `action` IDs are constrained by schema and comments in generated config.

## Customization scope

- User customization is supported for `keymap.leader`.
- `global.input.leader_key` is configurable.
- Normal/modifier and tree-local defaults are intentionally fixed in current versions.
