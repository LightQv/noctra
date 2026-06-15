# Configuration

Noctra loads user configuration from:

- `~/.config/noctra/config.yml`

If missing, it is generated automatically with defaults and inline comments.

## Config policy

Set in `.env`:

- `NOCTRA_CONFIG_POLICY=customizable` (default): keep and normalize user config.
- `NOCTRA_CONFIG_POLICY=strict`: overwrite with defaults each load.

Apply config changes at runtime with `:config-reload`.

## Main sections

- `global.input`: leader key and sequence timeout
- `global.whichkey`: helper panel behavior
- `global.editor`: editable buffer behavior
- `global.ui`: shell UI toggles and panel tuning
- `global.theme`: app/content theme mode and overrides
- `global.split`: split layout ratios and divider behavior
- `global.storage`: file locations for persisted data
- `global.notifications`: toast and persistence behavior
- `global.window`: initial window bounds, maximized state, and cascade offset
- `global.opening_buffer`: startup mode and dashboard settings
- `keymap.normal`: user NORMAL-mode key mappings
- `keymap.mod`: user Ctrl-modified key mappings
- `keymap.search`: user search-mode key mappings
- `keymap.leader`: user leader-key mappings
- `browser`: web-content language, search engine, clipboard-selection behavior, downloads, and password-manager provider selection

## Minimal example

```yaml
global:
  input:
    leader_key: "Space"
    sequence_timeout_ms: 500
  ui:
    urlline:
      enabled: true
    loadingline:
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
  language: "system"
  default_search_engine: "duckduckgo"
  copy_selection_to_clipboard: false
  allow_http_loopback: true
  allow_http_private_lan: true
  trusted_http_hosts: []
  downloads:
    policy: "prompt"
    allow_trusted_surfaces: false
    default_directory: null
    auto_open: false
  password_manager:
    provider: none
```

## Search engine fallback

## Web-content language

- `browser.language` controls website language negotiation.
- Allowed values:
  - `system` (default): follow OS/system language.
  - `en`: force English for web content.
  - `fr`: force French for web content.
- This does not localize Noctra UI strings; app UI remains English-first.

- `browser.default_search_engine` controls how non-URL text is resolved by `:open`, `:tab`, and URL line submit.
- Allowed values: `duckduckgo`, `google`, `ecosia`.
- Default: `duckduckgo`.

## URL security policy

- `https://` URLs are always allowed.
- `http://` URLs are allowed by default only for developer-local targets (loopback and private LAN).
- Non-local `http://` targets are blocked unless listed in `trusted_http_hosts`.
- `trusted_http_hosts` allows specific extra HTTP hosts.
- Unsafe schemes like `javascript:`, `data:`, and `file:` are blocked.

Optional hardening for stricter environments:

```yaml
browser:
  allow_http_loopback: false
  allow_http_private_lan: false
```

Example trusted hosts:

```yaml
browser:
  trusted_http_hosts:
    - "casaos.local"
    - "my-homelab-box"
```

## Download governance policy

- `browser.downloads.policy` controls download behavior:
  - `deny`: block all downloads.
  - `prompt`: require explicit user confirmation through the native save dialog (default).
  - `allow`: allow downloads without confirmation dialog.
- `allow_trusted_surfaces` controls whether trusted internal surfaces can initiate downloads.
- `default_directory` sets an optional preferred destination directory.
- `auto_open` enables opening files after download completion (disabled by default).

## Password-manager provider

- `browser.password_manager.provider` selects extension-backed password-manager support.
- Allowed values:
  - `none` (default): disable password-manager extension support.
  - `bitwarden`: use Bitwarden, first stable target.
  - `1password`: use 1Password, experimental target.
- Invalid provider values normalize to `none`.
- Noctra does not store, inspect, sync, or log passwords. The selected extension owns credential handling.
- Smoke/manual validation can set `NOCTRA_USER_DATA_DIR` to isolate Electron profile data and installed extensions from the normal Noctra profile.
- Chrome extension support uses the GPL-compatible distribution path for `electron-chrome-extensions`; see `THIRD_PARTY_NOTICES.md` for bundled notices.
- See [Password Managers](password-managers.md) for setup, button states, provider status, and troubleshooting.

Example:

```yaml
browser:
  password_manager:
    provider: bitwarden
```

## Theme modes

`global.theme.mode` accepts:

- `dark`
- `light`
- `auto`
- `custom` (requires `global.theme.custom_base`)

`global.theme.custom_base` accepts (only when `mode` is `custom`):

- `dark` — base palette is dark, devTools is dark
- `light` — base palette is light, devTools is light
- `auto` — follows OS dynamically

`global.theme.content_mode` accepts:

- `dark`
- `light`
- `auto`
- `match` — follows the resolved app theme

`content_mode` is used only when `global.theme.mode` is `custom`.
When `global.theme.mode` is `dark`, `light`, or `auto`, web content always follows the resolved app theme.

## Keymap mapping rules

- `keymap.normal`, `keymap.mod`, and `keymap.search` accept `<key>: <action_id>` mappings.
- `keymap.leader` accepts nested nodes with labels and actions.
- Each node supports either `action` or nested `children`.
- `action` must be a known action ID accepted by config schema.
- Invalid mapping values are ignored during normalization.

## Storage defaults

By default:

- `~/.config/noctra/history.yml`
- `~/.config/noctra/bookmarks.yml`
- `~/.config/noctra/sessions.yml`
- `~/.config/noctra/notifications.yml`

## Safety and recovery

- Invalid config files are auto-repaired.
- Prior invalid files are backed up with `.bak` suffix.
