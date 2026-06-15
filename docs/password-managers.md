# Password Managers

Noctra supports password managers through managed Chrome extensions. The selected extension owns credential handling. Noctra does not store, inspect, sync, or log passwords.

## Supported Providers

| Provider | Config value | Status       | Notes                                  |
| -------- | ------------ | ------------ | -------------------------------------- |
| None     | `none`       | Stable       | Default. Disables password-manager UI. |
| Bitwarden | `bitwarden` | Stable       | First stable provider target.          |
| 1Password | `1password` | Experimental | Installs, loads, and opens popup; login/native bridge/autofill need more validation. |

## Enable Bitwarden

Edit `~/.config/noctra/config.yml`:

```yaml
browser:
  password_manager:
    provider: bitwarden
```

Then restart Noctra or run `:config-reload` after saving config. If the extension is missing, Noctra installs it from Chrome Web Store, then loads it into the persistent Electron profile.

## Disable Support

```yaml
browser:
  password_manager:
    provider: none
```

When provider is `none`, Noctra hides the password-manager button and performs no extension install/load work.

## Open The Popup

After selected provider loads, open the extension action popup with any of these:

- Tabline key button `󰌆`
- `<leader> p`
- `:password-manager`
- `:pm`

Button states:

- Hidden: provider is `none`.
- Disabled: extension is installing, loading, failed, or unavailable.
- Enabled: extension loaded and popup can open.

## Autofill Behavior

Noctra does not implement autofill. The provider extension detects forms and fills them.

Bitwarden autofill works best when login forms use normal password-manager semantics:

- Username/email field uses `type="email"` or meaningful `type="text"`.
- Username/email field uses `name="username"` or `name="email"`.
- Username/email field uses `autocomplete="username"` or `autocomplete="email"`.
- Password field uses `type="password"`.
- Password field uses `name="password"`.
- Password field uses `autocomplete="current-password"`.
- Labels, placeholders, and field proximity clearly indicate login purpose.

Fields without those hints may not show inline suggestions even when popup autofill works.

## Extension Tabs And Popouts

Extension-created safe web links open as normal Noctra buffers. Known managed-extension popouts open as visible transient extension buffers with provider labels such as `Bitwarden`.

Extension buffers are visible in buffer navigation, but Noctra excludes them from history, bookmarks, session restore, closed-buffer reopen, and duplicate-buffer actions.

## Security Model

Extension popup and extension buffer surfaces are isolated from trusted Noctra surfaces.

- Browser surfaces keep `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, and `webviewTag: false`.
- Extension surfaces do not receive trusted Noctra preload APIs.
- Extension senders fail trusted shell/settings IPC checks.
- Normal web buffers cannot navigate into arbitrary `chrome-extension://` internals.
- Session snapshots exclude `chrome-extension://` and `crx://` URLs.

Using a password manager inside Noctra still means trusting the provider extension, Electron extension support, and `electron-chrome-extensions` compatibility glue.

## Troubleshooting

### Install Fails

- Check network access to Chrome Web Store.
- Restart Noctra and try again.
- Existing installed extension can still load if update checks fail.
- Use an isolated profile for tests with `NOCTRA_USER_DATA_DIR=/tmp/noctra-password-test`.

### Popup Does Not Open

- Wait until the password-manager button is enabled.
- Run `:pm` and check notification text.
- Restart Noctra after first install.
- If using 1Password, remember it is experimental.

### Autofill Does Not Appear

- Try popup autofill first.
- Check that the page uses semantic login field attributes listed above.
- Reload the page after extension install/load.
- Check whether provider warnings mention unsupported Chrome APIs.

### Expected Warnings

Electron may log unsupported Chrome API warnings for provider permissions such as `contextMenus`, `sidePanel`, `webNavigation`, `notifications`, `privacy`, or `downloads`. Bitwarden popup/autofill can still work despite these warnings.

Manifest V3 worker startup can also log `Failed to start service worker` during first install. Noctra treats explicit worker start as best-effort because Electron can still manage the extension worker lifecycle when the popup opens.

## Release Licensing

Chrome extension support uses `electron-chrome-extensions@4.9.0` under the selected GPL-compatible distribution path. Extension-enabled builds are not MIT-only distributions. Packaged releases include `THIRD_PARTY_NOTICES.md`, the Noctra MIT `LICENSE`, and `licenses/electron-chrome-extensions/LICENSE-GPL`.
