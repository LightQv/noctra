# Tutorial: Sessions, History, and Bookmarks

This tutorial covers the core persistence workflow.

Examples reflect current defaults and file-backed storage behavior.

## Sessions

Use sessions to snapshot and restore browsing context.

### Save a snapshot

- Run `:session save`, or use default leader mapping `<leader> S s`.

### Restore a snapshot

- Run `:session restore`, or use `<leader> S r`.

## History panel

Use history commands:

- `:history show`
- `:history hide`
- `:history toggle`
- `:history focus`
- `:history delete-today`
- `:history delete-all`

Default shortcuts:

- `<leader> e`: toggle side-tree/history panel
- `<leader> o`: toggle panel focus

## Bookmarks

Use bookmark commands:

- `:bookmarks show`
- `:bookmarks hide`
- `:bookmarks toggle`
- `:bookmarks focus`
- `:bookmarks delete-all`
- `:bookmarks import`

Default shortcuts:

- `<leader> d r`: add active page at root level
- `<leader> d d`: choose bookmark path/scope for active page

Import supports Netscape bookmark HTML export files (`.html`/`.htm`). Imported
items are appended at the bottom of the root level while preserving source
folder names and nested structure.

## Data files

By default, data is stored in:

- `~/.config/noctra/history.yml`
- `~/.config/noctra/bookmarks.yml`
- `~/.config/noctra/sessions.yml`

You can override these paths in `global.storage` config.

See also:

- [Commands](../commands.md)
- [Configuration](../configuration.md)
