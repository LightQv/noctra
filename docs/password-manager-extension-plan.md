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

Local validation/runtime note: Noctra passes `NOCTRA_CHROME_EXTENSIONS_LICENSE` through to `electron-chrome-extensions` only when it is one of the package-supported license strings: `GPL-3.0` or `Patron-License-2020-11-19`. Without this explicit env var, the extension runtime falls back to no-op and real provider validation cannot pass.

Validation isolation note: set `NOCTRA_USER_DATA_DIR` during M14 smoke/manual checks so Chrome Web Store downloads, extension state, cookies, and extension storage are isolated from the normal Noctra profile.

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
- Runtime reload refreshes provider state after saving the main Noctra config.

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

- [x] Add runtime constructor accepting `session`, `buffers`, `createWindow`, `getLastWindowContext`, and `notificationsService` dependencies.
- [x] Add no-op implementation for provider `none`.
- [x] Add `registerBuffer(buffer, win)`.
- [x] Add `selectBuffer(buffer)`.
- [x] Add `removeBuffer(buffer)` if package requires explicit cleanup.
- [ ] Add `openActionPopup(provider)` or equivalent package-backed method.
- [x] Add fake-buffer tests for create/select/remove tab callbacks.
- [x] Add fake-window tests for extension-created tabs opening as normal buffers.

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

- [x] Create service with injected `session`, `configService`, `extensionRuntime`, and `notificationsService`.
- [x] Add `initialize()` startup method.
- [x] Add `getStatus()` method.
- [x] Add `open()` method used by intent/button.
- [x] Check `session.defaultSession.extensions.getAllExtensions()` for provider ID.
- [ ] Auto-install missing provider via `electron-chrome-web-store`.
- [x] Load extension after install.
- [x] Load existing extension on startup.
- [x] Start MV3 service worker when manifest requires it.
- [x] Catch install/load failures and set `failed` status.
- [x] Emit or callback status changes to update tabline.
- [x] Add unit tests with fake session/extensions object.

Exit criteria:

- [x] Provider `none` performs no extension work.
- [ ] Selected provider auto-installs when missing.
- [x] Selected provider loads when installed.
- [x] Failure shows disabled button and warning toast.
- [x] Service never logs credential data.

## Milestone 5: Buffer Lifecycle Wiring

Goal: keep extension runtime synchronized with Noctra buffers.

Files likely touched:

- `browser/manager.js`
- `browser/services/bufferLifecycleService.js`
- `browser/services/bufferQueryService.js`
- `main.js`

Todos:

- [x] Inject extension runtime into buffer manager or lifecycle service.
- [x] Register each new web buffer after creation.
- [x] Skip editable/settings/internal trusted buffers unless explicitly needed.
- [x] Select extension tab when active Noctra buffer changes.
- [x] Remove/destroy extension tab state when buffer closes.
- [x] Ensure split/right-pane buffers are handled intentionally.
- [x] Ensure session restore registers restored buffers.
- [x] Add tests for active buffer sync.
- [x] Add tests for buffer close cleanup.

Exit criteria:

- [x] Extension active-tab state follows Noctra active buffer.
- [x] Closed buffers do not remain stale extension tabs.
- [x] Restored sessions produce registered extension tabs.
- [x] Split behavior is defined and tested.

## Milestone 6: Session And Preload Wiring

Goal: satisfy extension package requirements while preserving Electron hardening.

Files likely touched:

- `main.js`
- `runtime/windowBootstrap.js`
- `browser/buffers.js`
- `forge.config.js` if preload/resource packaging needs explicit copy.

Todos:

- [x] Use persistent `session.defaultSession` for extension-capable web buffers.
- [x] Register package preload through `session.registerPreloadScript` when available.
- [x] Add fallback only if needed and safe.
- [x] Ensure extension preload does not replace trusted Noctra preloads.
- [x] Preserve `sandbox: true`.
- [x] Preserve `contextIsolation: true`.
- [x] Preserve `nodeIntegration: false`.
- [x] Include package preload in packaged app.
- [x] Add packaging test note if automated coverage is hard.

Packaging note: Noctra currently packages `node_modules` in the app ASAR, so `electron-chrome-extensions/preload` and `electron-chrome-web-store/preload` resolve from production dependencies. Automated coverage asserts module resolution; full packaged-app execution remains a manual release gate.

Exit criteria:

- [x] Existing security baseline remains green.
- [ ] Extension content scripts/action popup work.
- [x] Packaged app can resolve required extension preload files.

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

- [x] Add `passwordManager` tabline action model.
- [x] Render key icon button when provider is not `none`.
- [x] Set disabled attribute when `status.canOpen !== true`.
- [x] Add title/aria text for installing/loading/loaded/failed states.
- [x] Add preload method `openPasswordManager()`.
- [x] Add IPC channel `ui-shell:open-password-manager`.
- [x] Validate payload as empty/null only.
- [x] Enforce trusted-shell sender check.
- [x] Call password manager service `open()` from IPC handler.
- [x] Add tests for hidden/disabled/enabled rendering.
- [x] Add IPC rejection test for untrusted sender.

Exit criteria:

- [x] Button hidden for `none`.
- [x] Button visible disabled while installing/loading/failed.
- [x] Button enabled when loaded.
- [x] Button opens same flow as command/intent.
- [x] Untrusted content cannot trigger privileged open path.

## Milestone 8: Popup Modal Integration

Goal: render real extension action popup in centered Noctra modal.

Proposed file:

- `ui/shell/services/passwordManagerOverlayController.js`

Todos:

- [x] Use `electron-chrome-extensions` browser-action popup support.
- [x] Track `browser-action-popup-created` event.
- [x] Attach popup child window to Noctra modal controller.
- [x] Center popup in app window.
- [x] Add backdrop if needed for focus/dismiss behavior.
- [x] Close popup on Escape.
- [x] Close popup on outside click if safe.
- [x] Recenter on window resize/maximize/unmaximize.
- [x] Restore focus to active Noctra buffer on close.
- [x] Mark popup webContents with extension surface role.
- [x] Add modal lifecycle tests with fake popup view.

Implementation note: `electron-chrome-extensions` creates action popups as frameless child `BrowserWindow` instances through `PopupView`, not as `BrowserView` overlays. Noctra manages those child windows as modal extension surfaces, centers them, closes on Escape, and relies on the package's blur handling for outside-dismiss behavior.

Exit criteria:

- [x] Bitwarden popup renders centered.
- [x] Popup closes predictably.
- [x] Focus returns to active buffer.
- [x] Popup is not trusted shell/settings surface.

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

- [x] Add intent.
- [x] Add action builder.
- [x] Add dispatcher handler.
- [x] Add command parser support.
- [x] Add optional default leader mapping.
- [x] Show status toast if extension is installing/loading/failed.
- [x] Update `INTENTS.md`.
- [x] Update commands/keybindings docs.
- [x] Add tests.

Exit criteria:

- [x] Mouse, command, and keymap use same intent path.
- [x] `npm run check:intents` passes.
- [x] Runtime disabled states produce clear user feedback.

## Milestone 10: Extension Installation And Updates

Goal: provider selection installs extension automatically and keeps it usable.

Todos:

- [x] On startup, detect selected provider.
- [x] If missing, set `installing` status and auto-install.
- [x] If installed, set `loading` status and load.
- [x] If auto-update is supported by package, enable or call it intentionally.
- [x] If install fails due to network/offline, set `failed` with clear message.
- [x] If update fails, keep existing installed extension if usable.
- [x] Add notification for install start and install failure.
- [x] Avoid repeated aggressive install retries during one session.

Implementation note: Noctra wraps `electron-chrome-web-store` in `core/extensions/chromeWebStoreInstaller.js`. Startup initializes Chrome Web Store support with provider IDs allowlisted and package `autoUpdate` disabled; Noctra calls `updateExtensions()` intentionally and treats update failures as non-fatal when an installed extension can still load.

Exit criteria:

- [x] Provider config alone can install extension.
- [x] Offline startup does not crash.
- [x] Existing installed provider can still load if update fails.
- [x] Button state reflects install/load state.

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

- [x] Add or define `SURFACE_ROLES.EXTENSION`.
- [x] Ensure extension role fails trusted-shell IPC checks.
- [x] Ensure extension role fails trusted-settings IPC checks.
- [x] Ensure extension popup has no Noctra privileged preload.
- [x] Apply URL policy to extension-created normal tabs.
- [x] Decide whether `chrome-extension://` URLs are restorable; default should be no.
- [x] Exclude `chrome-extension://` and `crx://` from session snapshots.
- [x] Keep downloads from extension surfaces governed by download policy.
- [x] Sanitize install/load error reporting.
- [x] Add tests for untrusted extension sender rejection.
- [x] Add tests for session snapshot exclusion.

Implementation note: extension-created `chrome-extension://`, `crx://`, and otherwise unsafe URLs are converted to `about:blank` before opening as normal Noctra buffers. Session snapshots and restores exclude `chrome-extension://` and `crx://` entries so extension internals are never reopened accidentally.

Exit criteria:

- [x] Extension surfaces cannot call settings/config IPC.
- [x] Extension surfaces cannot call trusted shell-only IPC.
- [x] Session restore never reopens extension internals by accident.
- [x] Existing security smoke test passes.

## Milestone 13: Tests

Unit tests:

- [x] Provider registry resolves valid providers.
- [x] Provider registry rejects invalid providers.
- [x] Config normalization handles default, valid, invalid, and malformed shapes.
- [x] Password manager service transitions `disabled -> installing -> loading -> loaded`.
- [x] Password manager service transitions to `failed` on install/load error.
- [x] Chrome extension runtime maps extension-created tabs to Noctra buffers.
- [x] Chrome extension runtime maps select/remove callbacks to Noctra buffer operations.

Security tests:

- [x] Extension-like sender cannot call settings IPC.
- [x] Extension-like sender cannot call trusted shell IPC.
- [x] Extension popup is not trusted shell/settings role.
- [x] Session snapshot excludes `chrome-extension://`.
- [x] Session snapshot excludes `crx://`.

UI tests:

- [x] Button hidden when provider is `none`.
- [x] Button visible disabled while installing.
- [x] Button visible disabled while loading.
- [x] Button visible enabled when loaded.
- [x] Button visible disabled when failed.
- [x] Button click dispatches trusted IPC.
- [x] Popup modal lifecycle works with fake popup.

Implementation note: automated M13 coverage is complete. Manual provider smoke checks remain in Milestone 14 because they require real Chrome Web Store/provider behavior.

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

- [x] `npm run lint`
- [ ] `npm run format:check`
- [x] `npm run check:intents`
- [x] `npm run check:security-baseline`
- [x] `npm test`
- [ ] `npm run ci:test` before merge/release.

CI note: `npm run format:check` currently fails on pre-existing `README.md` formatting, unrelated to password-manager work. Changed plan docs pass targeted Prettier checks.

## Milestone 14: Real Provider Validation

Prerequisite:

- [x] Add explicit local validation license hook via `NOCTRA_CHROME_EXTENSIONS_LICENSE`.
- [x] Add `NOCTRA_USER_DATA_DIR` profile isolation for smoke/manual provider checks.
- [x] Run provider checks with `NOCTRA_CHROME_EXTENSIONS_LICENSE=GPL-3.0` in isolated local smoke profiles. This does not resolve public distribution licensing.

Bitwarden checklist:

- [x] Auto-installs from `browser.password_manager.provider: bitwarden`.
- [x] Loads after install.
- [x] Loads after app restart.
- [x] Button visible disabled while installing/loading.
- [x] Button enabled after loaded.
- [x] Popup opens centered.
- [ ] User can log in.
- [ ] User can unlock vault.
- [ ] Autofill works on a normal login page.
- [ ] Extension-created tabs open as normal Noctra buffers.
- [ ] Offline restart with already-installed extension works.

Bitwarden M14 result: isolated smoke installed Bitwarden `2026.5.1` from Chrome Web Store under `Extensions/nngceckbapebfimnlniiiahkandclblb/2026.5.1_0`, and restart finds the installed extension. Electron emitted unsupported permission warnings for `contextMenus`, `sidePanel`, `webNavigation`, `notifications`, and `privacy`. Noctra fixed the popup navigation blocker by allowing `chrome-extension://` navigation only for child extension popup windows; the popup open path no longer produces `ERR_FAILED (-2)` or `SIGSEGV` in smoke. A minimal Electron repro showed fresh install can make explicit `session.serviceWorkers.startWorkerForScope("chrome-extension://<id>/")` reject with `Failed to start service worker`, while the provider action popup still opens; restarting and directly loading the installed extension lets the same explicit worker start resolve. Noctra treats explicit MV3 worker start failure as a low-severity best-effort signal, not an initialization failure, because Electron may already manage the extension worker lifecycle. Login, unlock, autofill, extension-created tabs, and offline restart still require manual validation.

1Password experimental checklist:

- [x] Auto-installs from `browser.password_manager.provider: 1password`.
- [x] Loads after install.
- [x] Loads after app restart.
- [x] Popup opens centered.
- [ ] Native app bridge behavior is known.
- [x] User can log in or clear limitation is documented.
- [x] Autofill behavior is known.
- [x] Any unsupported APIs are documented.
- [x] Path to stable support is listed.

1Password M14 result: isolated smoke installed 1Password `8.12.22.17` from Chrome Web Store under `Extensions/aeblfdkhhhdcdjpifhhbdiojplfjncoa/8.12.22.17_0`, and restart finds the installed extension. Electron emitted unsupported permission warnings for `contextMenus`, `downloads`, `notifications`, `privacy`, and `webNavigation`. Noctra fixed the popup navigation blocker the same way as Bitwarden. Explicit MV3 worker start is best-effort for the same reason as Bitwarden: Electron/package lifecycle can reject a manual worker start even when extension UI opens. Login/native bridge/autofill still require manual validation.

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
