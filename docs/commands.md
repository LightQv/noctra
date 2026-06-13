# Commands

Use `:` in `COMMAND` mode to run the following commands.

## Navigation and Open

- `:open <target>`: open URL/search target in active buffer
- `:tab`, `:tabe`, `:tabnew [target]`: open new buffer (optionally with target)
- `:duck <query>`: search with DuckDuckGo
- `:google <query>`: search with Google
- `:ecosia <query>`: search with Ecosia

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

## Split Management

- `:split`: open vertical split
- `:splitq`: close right split
- `:splitd`: open devtools in split

## UI and Settings

- `:settings`, `:config`: open settings buffer
- `:notifications`, `:notifs`: open notifications buffer
- `:password-manager`, `:pm`: open password manager
- `:config-reload`: reload config file

## URL Line

- `:urlline`
- `:urlline toggle`
- `:urlline on`
- `:urlline off`

## Theme and Language

- `:theme dark`
- `:theme light`
- `:theme auto`
- `:theme custom`

For `:theme dark|light|auto`, web content follows the app theme automatically.
`global.theme.content_mode` is only applied while in `:theme custom`.

- `:lang system`
- `:lang en`
- `:lang fr`
- `:lang fr!` (reload-aware variant)

## Clipboard Behavior

- `:copy-selection`
- `:copy-selection toggle`
- `:copy-selection on`
- `:copy-selection off`

## Context and Panels

- `:focus-context`
- `:context`
- `:history show|hide|toggle|focus|delete-all|delete-today`
- `:bookmarks show|hide|toggle|focus|delete-all|import`
- `:downloads show|hide|toggle|focus|clear-all|live`

## Sessions

- `:session save`
- `:session restore`

## Exit

- `:quit`: quit application

## Notes

- Unknown or malformed commands resolve to `UNKNOWN_COMMAND` intent.
- `:open` / `:tabnew` use `browser.default_search_engine` for non-URL inputs.
- URL-like and query-like inputs are normalized before dispatch.
- Some commands have aliases (for example `:tab`, `:tabe`, `:tabnew`).
