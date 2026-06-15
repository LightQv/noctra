# Password Manager Extension Plan

This document tracks the implementation plan for password-manager support through Chrome extensions. Noctra must not store, inspect, sync, or log user passwords. The selected password-manager extension owns credential handling.

## Source Material

- [`samuelmaddock/electron-browser-shell`](https://github.com/samuelmaddock/electron-browser-shell): reference Electron browser shell with Chrome extension support.
- [`electron-chrome-extensions`](https://github.com/samuelmaddock/electron-browser-shell/tree/master/packages/electron-chrome-extensions): package for richer Chrome extension APIs, action popups, tab/window mapping, and extension UI integration.
- [`electron-chrome-web-store`](https://github.com/samuelmaddock/electron-browser-shell/tree/master/packages/electron-chrome-web-store): package for installing and updating extensions from Chrome Web Store.
- [`electron-chrome-context-menu`](https://github.com/samuelmaddock/electron-browser-shell/tree/master/packages/electron-chrome-context-menu): package for merging Chrome extension context-menu items into Electron browser context menus.
- [Electron Chrome Extension Support](https://www.electronjs.org/docs/latest/api/extensions): upstream Electron extension-support baseline and limitations.

## Locked Product Decisions

- Password handling is extension-backed, not Noctra-backed.
- Noctra stores only provider configuration and extension runtime state.
- Provider selection auto-installs the matching extension.
- Extension-created tabs open as normal Noctra buffers.
- Bitwarden is the first stable target.
- 1Password starts as experimental, but architecture must support making it stable later.
- Password-manager button is hidden when provider is `none`.
- Password-manager button is visible but disabled while extension is installing, loading, failed, or otherwise unavailable.
- Password-manager button is enabled only when the selected extension is loaded and can open its action popup.
- Public release requires resolving the `electron-chrome-extensions` license situation.

## Non-Goals

- No built-in password vault.
- No Noctra autofill implementation.
- No credential import/export.
- No custom encryption/keychain storage for site passwords.
- No manual support for arbitrary extensions in the first implementation pass.
- No Chrome extension marketplace UI beyond provider auto-install.

## Target Dependencies

- `electron-chrome-extensions`: richer Chrome extension API support, action popups, tab/window mapping, storage fallback, context menu item support.
- `electron-chrome-web-store`: install/update provider extensions from Chrome Web Store.
- `electron-chrome-context-menu`: optional later phase for extension context-menu items.

## License Gate

`electron-chrome-extensions` is GPL-3 / Patron licensed. Noctra is MIT. Private development can proceed, but public distribution must resolve this before release.

Release blocker todo:

- [ ] Decide GPL compatibility or obtain Patron/proprietary license.
- [ ] Document final license decision in release notes.
- [ ] Update `docs/release-checklist.md` with extension-support license gate.
- [ ] Update dependency/license review before public release.

## Config Contract

Default config:

```yaml
browser:
  password_manager:
    provider: none
```

Allowed providers:

- `none`: disables password-manager extension support.
- `bitwarden`: installs and loads Bitwarden.
- `1password`: installs and loads 1Password, initially experimental.

Provider metadata:

```js
bitwarden: {
  id: "nngceckbapebfimnlniiiahkandclblb",
  label: "Bitwarden",
  support: "stable",
}

"1password": {
  id: "aeblfdkhhhdcdjpifhhbdiojplfjncoa",
  label: "1Password",
  support: "experimental",
}
```

Config behavior:

- Unknown provider normalizes to `none`.
- Missing `password_manager` section uses defaults.
- Invalid shape must not crash startup.
- Runtime reload should eventually refresh the provider state, but first implementation can require restart if hot-swap is too risky.

## Runtime Status Model

Use one serializable status object for UI, commands, tests, and notifications.

```js
{
  provider: "bitwarden",
  label: "Bitwarden",
  support: "stable",
  state: "disabled" | "installing" | "loading" | "loaded" | "failed",
  extensionId: "nngceckbapebfimnlniiiahkandclblb",
  enabled: true,
  canOpen: false,
  message: "",
}
```

State rules:

- `disabled`: provider is `none`.
- `installing`: provider selected, extension missing, install in progress.
- `loading`: extension installed/found, load/runtime setup in progress.
- `loaded`: extension loaded and action popup can be opened.
- `failed`: install/load/runtime setup failed.

UI rules:

- `disabled`: hide button.
- `installing`: show disabled button with install title.
- `loading`: show disabled button with loading title.
- `loaded`: show enabled button.
- `failed`: show disabled button with failure title and toast.

## Architecture Overview

Add three small extension-specific modules and keep `main.js` orchestration thin.

Proposed files:

- `core/extensions/passwordManagerProviders.js`
- `core/extensions/chromeExtensionRuntime.js`
- `core/extensions/passwordManagerService.js`
- `ui/shell/services/passwordManagerOverlayController.js`

Responsibilities:

- Provider registry resolves provider metadata and validates names.
- Chrome extension runtime adapts Noctra buffers/windows to `electron-chrome-extensions` tab/window APIs.
- Password manager service owns selected-provider install/load/status lifecycle.
- UI overlay controller owns popup placement, visibility, dismissal, and focus restore.

Security boundary:

- Main process owns extension installation/loading.
- Renderer shell only requests `open password manager` through trusted IPC.
- Extension popup/web content receives no Noctra privileged preload.
- Extension surfaces must not satisfy trusted shell/settings IPC checks.

## Milestone 1: Technical Spike

Goal: prove Bitwarden works in Noctra before full product implementation.

Todos:

- [ ] Create local spike branch.
- [ ] Add `electron-chrome-extensions` and `electron-chrome-web-store` as exact-version deps.
- [ ] Instantiate `ElectronChromeExtensions` with `session.defaultSession`.
- [ ] Register current active buffer with `extensions.addTab(buffer.webContents, win)`.
- [ ] Call `extensions.selectTab(buffer.webContents)` when active buffer changes.
- [ ] Call `ElectronChromeExtensions.handleCRXProtocol(session.defaultSession)`.
- [ ] Auto-install Bitwarden from Chrome Web Store by extension ID.
- [ ] Open Bitwarden action popup using package-supported flow.
- [ ] Test Bitwarden login.
- [ ] Test Bitwarden autofill on a real login page.
- [ ] Repeat install/load/popup checks for 1Password.
- [ ] Record unsupported APIs or failures.

Exit criteria:

- [ ] Bitwarden installs from provider selection.
- [ ] Bitwarden loads after restart.
- [ ] Bitwarden popup opens.
- [ ] Bitwarden content scripts run inside Noctra web buffers.
- [ ] Bitwarden autofill works on normal login forms.
- [ ] 1Password result is known and documented.
- [ ] No Noctra privileged IPC is exposed to web or extension content.

## Milestone 2: Config And Provider Registry

Goal: create stable, testable configuration model.

Files likely touched:

- `core/config/defaults.js`
- `core/config/schema.js`
- `core/extensions/passwordManagerProviders.js`
- `docs/configuration.md`
- config tests under `tests/app/`

Todos:

- [ ] Add default `browser.password_manager.provider: none`.
- [ ] Add schema normalization for `none`, `bitwarden`, and `1password`.
- [ ] Normalize invalid provider values to `none`.
- [ ] Add provider registry constants.
- [ ] Add `resolvePasswordManagerProvider(provider)` helper.
- [ ] Add `isPasswordManagerEnabled(config)` helper.
- [ ] Add tests for default config.
- [ ] Add tests for Bitwarden config.
- [ ] Add tests for 1Password config.
- [ ] Add tests for invalid provider value.
- [ ] Document config in `docs/configuration.md`.

Exit criteria:

- [ ] Config normalization is deterministic.
- [ ] Invalid config cannot crash app startup.
- [ ] Provider metadata has no Electron dependency.

## Milestone 3: Chrome Extension Runtime Adapter

Goal: map Noctra's buffer-first model to Chrome extension tab/window concepts.

Proposed file:

- `core/extensions/chromeExtensionRuntime.js`

Runtime responsibilities:

- Construct `ElectronChromeExtensions`.
- Call `ElectronChromeExtensions.handleCRXProtocol(session.defaultSession)`.
- Register Noctra web buffers as extension tabs.
- Select active Noctra buffer as active extension tab.
- Map extension-created tabs to normal Noctra buffers.
- Map extension tab selection/removal to Noctra buffer operations.
- Expose status-safe methods to password manager service.

Callbacks to implement:

- `createTab(details)` creates normal Noctra buffer with `details.url || "about:blank"`.
- `selectTab(webContents, browserWindow)` switches to matching Noctra buffer.
- `removeTab(webContents, browserWindow)` closes matching Noctra buffer.
- `createWindow(details)` opens `details.url` as normal Noctra buffer in current/last window and returns the owning `BrowserWindow`.
- `removeWindow(browserWindow)` closes only extension-created window/buffer state when safe; otherwise no-op with warning.
- `assignTabDetails(details, webContents)` fills safe tab metadata only.

Todos:

- [ ] Add runtime constructor accepting `session`, `buffers`, `createWindow`, `getLastWindowContext`, and `notificationsService` dependencies.
- [ ] Add no-op implementation for provider `none`.
- [ ] Add `registerBuffer(buffer, win)`.
- [ ] Add `selectBuffer(buffer)`.
- [ ] Add `removeBuffer(buffer)` if package requires explicit cleanup.
- [ ] Add `openActionPopup(provider)` or equivalent package-backed method.
- [ ] Add fake-buffer tests for create/select/remove tab callbacks.
- [ ] Add fake-window tests for extension-created tabs opening as normal buffers.

Exit criteria:

- [ ] Every web buffer can be represented as a Chrome extension tab.
- [ ] `chrome.tabs.query({ active: true })` can resolve active Noctra buffer.
- [ ] Extension-created tabs are normal Noctra buffers.
- [ ] Runtime module does not know password-manager provider policy.

## Milestone 4: Password Manager Service

Goal: own selected-provider install/load/status lifecycle.

Proposed file:

- `core/extensions/passwordManagerService.js`

Service responsibilities:

- Read selected provider from config.
- Auto-install missing provider extension.
- Load selected extension on startup.
- Start Manifest V3 worker if needed.
- Track status transitions.
- Publish status updates to UI shell.
- Notify failures without crashing app.

Todos:

- [ ] Create service with injected `session`, `configService`, `extensionRuntime`, and `notificationsService`.
- [ ] Add `initialize()` startup method.
- [ ] Add `getStatus()` method.
- [ ] Add `open()` method used by intent/button.
- [ ] Check `session.defaultSession.extensions.getAllExtensions()` for provider ID.
- [ ] Auto-install missing provider via `electron-chrome-web-store`.
- [ ] Load extension after install.
- [ ] Load existing extension on startup.
- [ ] Start MV3 service worker when manifest requires it.
- [ ] Catch install/load failures and set `failed` status.
- [ ] Emit or callback status changes to update tabline.
- [ ] Add unit tests with fake session/extensions object.

Exit criteria:

- [ ] Provider `none` performs no extension work.
- [ ] Selected provider auto-installs when missing.
- [ ] Selected provider loads when installed.
- [ ] Failure shows disabled button and warning toast.
- [ ] Service never logs credential data.

## Milestone 5: Buffer Lifecycle Wiring

Goal: keep extension runtime synchronized with Noctra buffers.

Files likely touched:

- `browser/manager.js`
- `browser/services/bufferLifecycleService.js`
- `browser/services/bufferQueryService.js`
- `main.js`

Todos:

- [ ] Inject extension runtime into buffer manager or lifecycle service.
- [ ] Register each new web buffer after creation.
- [ ] Skip editable/settings/internal trusted buffers unless explicitly needed.
- [ ] Select extension tab when active Noctra buffer changes.
- [ ] Remove/destroy extension tab state when buffer closes.
- [ ] Ensure split/right-pane buffers are handled intentionally.
- [ ] Ensure session restore registers restored buffers.
- [ ] Add tests for active buffer sync.
- [ ] Add tests for buffer close cleanup.

Exit criteria:

- [ ] Extension active-tab state follows Noctra active buffer.
- [ ] Closed buffers do not remain stale extension tabs.
- [ ] Restored sessions produce registered extension tabs.
- [ ] Split behavior is defined and tested.

## Milestone 6: Session And Preload Wiring

Goal: satisfy extension package requirements while preserving Electron hardening.

Files likely touched:

- `main.js`
- `runtime/windowBootstrap.js`
- `browser/buffers.js`
- `forge.config.js` if preload/resource packaging needs explicit copy.

Todos:

- [ ] Use persistent `session.defaultSession` for extension-capable web buffers.
- [ ] Register package preload through `session.registerPreloadScript` when available.
- [ ] Add fallback only if needed and safe.
- [ ] Ensure extension preload does not replace trusted Noctra preloads.
- [ ] Preserve `sandbox: true`.
- [ ] Preserve `contextIsolation: true`.
- [ ] Preserve `nodeIntegration: false`.
- [ ] Include package preload in packaged app.
- [ ] Add packaging test note if automated coverage is hard.

Exit criteria:

- [ ] Existing security baseline remains green.
- [ ] Extension content scripts/action popup work.
- [ ] Packaged app can resolve required extension preload files.

## Milestone 7: Tabline Button And IPC

Goal: expose password manager entry point in Noctra UI.

Files likely touched:

- `ui/tabline.js`
- `ui/shell/manager.js`
- `ui/shell/preload.js`
- `runtime/ipcRegistration.js`
- `core/contracts/ipc.js`
- related UI tests

Todos:

- [ ] Add `passwordManager` tabline action model.
- [ ] Render key icon button when provider is not `none`.
- [ ] Set disabled attribute when `status.canOpen !== true`.
- [ ] Add title/aria text for installing/loading/loaded/failed states.
- [ ] Add preload method `openPasswordManager()`.
- [ ] Add IPC channel `ui-shell:open-password-manager`.
- [ ] Validate payload as empty/null only.
- [ ] Enforce trusted-shell sender check.
- [ ] Call password manager service `open()` from IPC handler.
- [ ] Add tests for hidden/disabled/enabled rendering.
- [ ] Add IPC rejection test for untrusted sender.

Exit criteria:

- [ ] Button hidden for `none`.
- [ ] Button visible disabled while installing/loading/failed.
- [ ] Button enabled when loaded.
- [ ] Button opens same flow as command/intent.
- [ ] Untrusted content cannot trigger privileged open path.

## Milestone 8: Popup Modal Integration

Goal: render real extension action popup in centered Noctra modal.

Proposed file:

- `ui/shell/services/passwordManagerOverlayController.js`

Todos:

- [ ] Use `electron-chrome-extensions` browser-action popup support.
- [ ] Track `browser-action-popup-created` event.
- [ ] Attach popup view to Noctra overlay stack.
- [ ] Center popup in app window.
- [ ] Add backdrop if needed for focus/dismiss behavior.
- [ ] Close popup on Escape.
- [ ] Close popup on outside click if safe.
- [ ] Recenter on window resize/maximize/unmaximize.
- [ ] Restore focus to active Noctra buffer on close.
- [ ] Mark popup webContents with extension surface role.
- [ ] Add modal lifecycle tests with fake popup view.

Exit criteria:

- [ ] Bitwarden popup renders centered.
- [ ] Popup closes predictably.
- [ ] Focus returns to active buffer.
- [ ] Popup is not trusted shell/settings surface.

## Milestone 9: Intent, Command, And Keymap

Goal: keep Vim-first interaction model consistent.

Proposed intent:

- `PASSWORD_MANAGER_OPEN`

Proposed commands:

- `:password-manager`
- Optional alias later: `:pm`

Possible default leader mapping:

```yaml
keymap:
  leader:
    p:
      label: "Password manager"
      action: "password_manager_open"
```

Files likely touched:

- `core/intents.js`
- `INTENTS.md`
- `motions/actionBuilders.js`
- dispatcher handlers
- command parser files/tests
- `docs/keybindings.md`
- `docs/commands.md`

Todos:

- [ ] Add intent.
- [ ] Add action builder.
- [ ] Add dispatcher handler.
- [ ] Add command parser support.
- [ ] Add optional default leader mapping.
- [ ] Show status toast if extension is installing/loading/failed.
- [ ] Update `INTENTS.md`.
- [ ] Update commands/keybindings docs.
- [ ] Add tests.

Exit criteria:

- [ ] Mouse, command, and keymap use same intent path.
- [ ] `npm run check:intents` passes.
- [ ] Runtime disabled states produce clear user feedback.

## Milestone 10: Extension Installation And Updates

Goal: provider selection installs extension automatically and keeps it usable.

Todos:

- [ ] On startup, detect selected provider.
- [ ] If missing, set `installing` status and auto-install.
- [ ] If installed, set `loading` status and load.
- [ ] If auto-update is supported by package, enable or call it intentionally.
- [ ] If install fails due to network/offline, set `failed` with clear message.
- [ ] If update fails, keep existing installed extension if usable.
- [ ] Add notification for install start and install failure.
- [ ] Avoid repeated aggressive install retries during one session.

Exit criteria:

- [ ] Provider config alone can install extension.
- [ ] Offline startup does not crash.
- [ ] Existing installed provider can still load if update fails.
- [ ] Button state reflects install/load state.

## Milestone 11: Optional Context Menu Support

Goal: support extension context-menu entries when needed by providers.

Dependency:

- `electron-chrome-context-menu`

Todos:

- [ ] Inspect Bitwarden/1Password context-menu needs.
- [ ] Merge `extensions.getContextMenuItems(webContents, params)` into existing web context menu.
- [ ] Keep Noctra context-menu isolation rules.
- [ ] Do not expose Noctra privileged actions through extension callbacks.
- [ ] Add tests for context menu item merge.

Exit criteria:

- [ ] Existing Noctra context menu tests still pass.
- [ ] Extension context-menu items work when provider exposes them.

## Milestone 12: Security Hardening

Goal: extension support must not weaken Noctra's trusted-surface model.

Threats:

- Malicious or compromised extension.
- Compromised extension update.
- Web content attempting to reach extension or Noctra IPC.
- Extension popup accidentally marked trusted.
- Extension-created tabs navigating to privileged internal surfaces.
- Logs or notifications leaking sensitive URLs/forms/errors.

Todos:

- [ ] Add or define `SURFACE_ROLES.EXTENSION`.
- [ ] Ensure extension role fails trusted-shell IPC checks.
- [ ] Ensure extension role fails trusted-settings IPC checks.
- [ ] Ensure extension popup has no Noctra privileged preload.
- [ ] Apply URL policy to extension-created normal tabs.
- [ ] Decide whether `chrome-extension://` URLs are restorable; default should be no.
- [ ] Exclude `chrome-extension://` and `crx://` from session snapshots.
- [ ] Keep downloads from extension surfaces governed by download policy.
- [ ] Sanitize install/load error reporting.
- [ ] Add tests for untrusted extension sender rejection.
- [ ] Add tests for session snapshot exclusion.

Exit criteria:

- [ ] Extension surfaces cannot call settings/config IPC.
- [ ] Extension surfaces cannot call trusted shell-only IPC.
- [ ] Session restore never reopens extension internals by accident.
- [ ] Existing security smoke test passes.

## Milestone 13: Tests

Unit tests:

- [ ] Provider registry resolves valid providers.
- [ ] Provider registry rejects invalid providers.
- [ ] Config normalization handles default, valid, invalid, and malformed shapes.
- [ ] Password manager service transitions `disabled -> installing -> loading -> loaded`.
- [ ] Password manager service transitions to `failed` on install/load error.
- [ ] Chrome extension runtime maps extension-created tabs to Noctra buffers.
- [ ] Chrome extension runtime maps select/remove callbacks to Noctra buffer operations.

Security tests:

- [ ] Extension-like sender cannot call settings IPC.
- [ ] Extension-like sender cannot call trusted shell IPC.
- [ ] Extension popup is not trusted shell/settings role.
- [ ] Session snapshot excludes `chrome-extension://`.
- [ ] Session snapshot excludes `crx://`.

UI tests:

- [ ] Button hidden when provider is `none`.
- [ ] Button visible disabled while installing.
- [ ] Button visible disabled while loading.
- [ ] Button visible enabled when loaded.
- [ ] Button visible disabled when failed.
- [ ] Button click dispatches trusted IPC.
- [ ] Popup modal lifecycle works with fake popup.

Smoke/manual tests:

- [ ] Startup with provider `none`.
- [ ] Startup with provider `bitwarden` and no installed extension.
- [ ] Startup with provider `bitwarden` and existing installed extension.
- [ ] Startup with provider `1password` and no installed extension.
- [ ] Open popup from key button.
- [ ] Open popup from command/keymap.
- [ ] Close popup with Escape.
- [ ] Close popup by changing active buffer/window if required.
- [ ] Verify no privileged IPC exposed to active web page.

CI target:

- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run check:intents`
- [ ] `npm run check:security-baseline`
- [ ] `npm test`
- [ ] `npm run ci:test` before merge/release.

## Milestone 14: Real Provider Validation

Bitwarden checklist:

- [ ] Auto-installs from `browser.password_manager.provider: bitwarden`.
- [ ] Loads after install.
- [ ] Loads after app restart.
- [ ] Button visible disabled while installing/loading.
- [ ] Button enabled after loaded.
- [ ] Popup opens centered.
- [ ] User can log in.
- [ ] User can unlock vault.
- [ ] Autofill works on a normal login page.
- [ ] Extension-created tabs open as normal Noctra buffers.
- [ ] Offline restart with already-installed extension works.

1Password experimental checklist:

- [ ] Auto-installs from `browser.password_manager.provider: 1password`.
- [ ] Loads after install.
- [ ] Loads after app restart.
- [ ] Popup opens centered.
- [ ] Native app bridge behavior is known.
- [ ] User can log in or clear limitation is documented.
- [ ] Autofill behavior is known.
- [ ] Any unsupported APIs are documented.
- [ ] Path to stable support is listed.

## Milestone 15: Packaging

Goal: ensure extension support works outside dev mode.

Todos:

- [ ] Verify packaged app includes `electron-chrome-extensions/preload` or equivalent copied file.
- [ ] Verify packaged app can install selected provider.
- [ ] Verify packaged app can load installed provider after restart.
- [ ] Verify extension storage persists across restart.
- [ ] Verify no dev-only absolute paths are used.
- [ ] Verify signed/unsigned macOS behavior if relevant.
- [ ] Add packaging notes to release checklist.

Exit criteria:

- [ ] `npm run make` output can use Bitwarden popup.
- [ ] No missing preload/resource errors in packaged app.
- [ ] Public release checklist includes license gate.

## Milestone 16: Documentation

Docs to update:

- `docs/configuration.md`
- `docs/keybindings.md`
- `docs/commands.md`
- `docs/release-checklist.md`
- `docs/release-hygiene-status.md`
- `README.md` once feature is stable.

Possible new docs:

- `docs/password-managers.md`
- `docs/extensions.md`

Documentation todos:

- [ ] Explain Noctra does not store passwords.
- [ ] Explain provider config.
- [ ] Explain auto-install behavior.
- [ ] Explain button disabled states.
- [ ] Explain Bitwarden support status.
- [ ] Explain 1Password experimental status.
- [ ] Explain troubleshooting for install failure.
- [ ] Explain troubleshooting for popup failure.
- [ ] Explain troubleshooting for autofill failure.
- [ ] Document public-release license blocker.

## Implementation Order

Use this order to keep changes reviewable:

1. Technical spike on throwaway/local branch.
2. Config + provider registry.
3. Runtime adapter with fake tests.
4. Password manager service with fake tests.
5. Buffer lifecycle wiring.
6. Session/preload wiring.
7. Tabline button + IPC.
8. Popup modal.
9. Intent/command/keymap.
10. Auto-install/update hardening.
11. Security hardening.
12. Bitwarden manual validation.
13. 1Password experimental validation.
14. Packaging validation.
15. Documentation and release checklist updates.

## Definition Of Done For First Stable Bitwarden Pass

- [ ] `browser.password_manager.provider: bitwarden` auto-installs Bitwarden.
- [ ] Bitwarden loads after install and app restart.
- [ ] Password-manager button appears disabled until loaded.
- [ ] Password-manager button opens real Bitwarden popup once loaded.
- [ ] Extension-created tabs open as normal Noctra buffers.
- [ ] Autofill works on common login forms.
- [ ] Noctra does not store or log credentials.
- [ ] Extension popup has no trusted Noctra IPC access.
- [ ] Session snapshots exclude extension internals.
- [ ] Tests cover config, service, UI state, IPC, and security boundaries.
- [ ] License blocker is documented before public release.

## Definition Of Done For 1Password Stable Later

- [ ] 1Password auto-installs and loads reliably.
- [ ] Popup opens and login/unlock flow works.
- [ ] Native messaging or desktop-app bridge works, or supported alternative exists.
- [ ] Autofill works on common login forms.
- [ ] Unsupported API gaps are closed or worked around safely.
- [ ] Experimental label removed only after manual checklist is green.
