# Commands

Use `:` in command mode to run the following commands.

## Navigation and open

- `:open <target>`: open URL/search target in active buffer
- `:tab`, `:tabe`, `:tabnew [target]`: open new buffer (optionally with target)
- `:duck <query>`: search with DuckDuckGo
- `:google <query>`: search with Google

## Buffer management

- `:bnext`: next buffer
- `:bprev`: previous buffer
- `:buffer <id>`: switch to buffer id
- `:bdelete [id]`: close buffer (active if omitted)
- `:q`: close active buffer
- `:wq`: close active buffer
- `:breopen`, `:brestore`, `:reopen`: reopen last closed buffer
- `:bcloseleft`: close buffers to the left
- `:bcloseright`: close buffers to the right

## Split management

- `:split`: open vertical split
- `:splitq`: close right split
- `:splitd`: open devtools in split

## UI and settings

- `:settings`, `:config`: open settings buffer
- `:notifications`, `:notifs`: open notifications buffer
- `:config-reload`: reload config file

## URL line

- `:urlline`
- `:urlline toggle`
- `:urlline on`
- `:urlline off`

## Theme and language

- `:theme dark`
- `:theme light`
- `:theme auto`
- `:theme custom`
- `:lang en`
- `:lang fr`
- `:lang fr!` (reload-aware variant)

## Clipboard behavior

- `:copy-selection`
- `:copy-selection toggle`
- `:copy-selection on`
- `:copy-selection off`

## Context and panels

- `:focus-context`
- `:context`
- `:history show|hide|toggle|focus|delete-all|delete-today`
- `:bookmarks show|hide|toggle|focus|delete-all`

## Sessions

- `:session save`
- `:session restore`

## Exit

- `:quit`: quit application

## Notes

- Unknown or malformed commands resolve to `UNKNOWN_COMMAND` intent.
- URL-like and query-like inputs are normalized before dispatch.
- Some commands have aliases (for example `:tab`, `:tabe`, `:tabnew`).
