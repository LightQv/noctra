# Phase 04 - Adapter Deepening + Monolith Split

## Goal
Deepen platform/renderer boundaries and reduce monolithic modules without changing user-visible behavior.

## In Scope
- Push Electron-specific logic behind adapter interfaces
- Decompose high-churn large modules into focused services
- Preserve stable intent/command boundary and lifecycle behavior
- Improve maintainability and future multi-engine optionality

## Out of Scope
- New end-user features
- Security boundary redesign already handled in Phase 01
- Large-scale rewrites without parity checkpoints

## Primary Current Files
- `main.js`
- `ui/shell/manager.js`
- `browser/manager.js`
- `core/history/panel.js`
- `core/adapters/platform/*`
- `core/adapters/renderer/*`

## Planned Outputs
- Reduced direct Electron API usage in orchestration modules
- Extracted domain services from monolithic files
- Stable adapter contracts with clear ownership boundaries
- Regression-safe module split sequence with parity checks

## Steps
1. [x] Inventory direct Electron/WebContents/BrowserView calls by module.
2. [x] Define target ownership map (orchestration vs adapter vs UI domain service).
3. [ ] Extract first decomposition slice (lowest-risk domain) and validate parity.
4. [ ] Continue incremental splits for remaining large modules.
5. [ ] Add/update tests for extracted boundaries and lifecycle ordering.
6. [ ] Remove deprecated passthroughs after parity verification.

## Step 1 Inventory - Direct Electron Call Map
| Module | Direct callsites (representative) | Target owner | Migration priority | Parity risk notes |
|---|---|---|---|---|
| `main.js` | Electron roots: `BrowserWindow` creation and shell preload (`main.js:1233`, `main.js:1265`); app/session policy hooks (`main.js:135`, `main.js:151`, `main.js:181`, `main.js:195`); global IPC registration/teardown (`main.js:1147`, `main.js:1167`); window/webContents event wiring (`main.js:1269`, `main.js:1273`) | `main.js` keeps high-level orchestration; extract Electron/session policy and IPC wiring behind `core/adapters/platform/*` modules | medium | Startup order and shutdown ordering are sensitive (window creation, buffers init, shell init, IPC registration).
| `main.js` | Global native integrations: clipboard reads for paste actions (`main.js:373`, `main.js:388`), native theme subscription (`main.js:234`, `main.js:1537`), display bounds query (`main.js:61`) | platform adapter services (`clipboard`, `themeSignals`, `displayInfo`) | low | Low lifecycle risk; can be isolated first if API remains synchronous for existing callers.
| `main.js` | Active webContents input/mode tracking (`main.js:416`, `main.js:541`, `main.js:1211`) | split between input domain service (`core/`) and thin webContents event adapter (`core/adapters/platform/webContentsEvents`) | medium | Event sequencing and listener detach timing can regress mode sync and focus behavior.
| `ui/shell/manager.js` | Overlay BrowserView construction + attachment (`ui/shell/manager.js:1011`, `ui/shell/manager.js:1031`, `ui/shell/manager.js:1123`, `ui/shell/manager.js:1172`) | renderer adapter (`core/adapters/renderer/*`) for surface lifecycle; shell domain service retains view models | high | Overlay readiness and initialization timing are tightly coupled to first render.
| `ui/shell/manager.js` | Overlay stacking/z-order and geometry (`ui/shell/manager.js:1364`, `ui/shell/manager.js:1474`, `ui/shell/manager.js:1498`) | dedicated shell layout/stack service, backed by a platform view host adapter | high | Highest risk for parity drift in command/telescope/which-key/statusline layering.
| `ui/shell/manager.js` | Frequent DOM patching via `webContents.executeJavaScript` (`ui/shell/manager.js:1247`, `ui/shell/manager.js:1271`, `ui/shell/manager.js:1583`) | renderer adapter API (`pushShellPatch`, `pushOverlayPatch`) + shell-specific patch builders | medium | Cadence and batching changes can affect perceived UI responsiveness.
| `browser/manager.js` | Content BrowserView lifecycle (`browser/manager.js:92`, `browser/manager.js:916`, `browser/manager.js:959`, `browser/manager.js:1091`) | browser domain service with platform view host adapter boundary | medium | Buffer open/close and split mirror paths are stateful; regressions show as wrong visible pane.
| `browser/manager.js` | Split/devtools orchestration with direct view calls (`browser/manager.js:503`, `browser/manager.js:511`, `browser/manager.js:1122`, `browser/manager.js:1130`) | split coordinator service + devtools adapter | high | Focused pane selection and `setTopBrowserView` ordering are critical for split correctness.
| `browser/manager.js` | WebContents event hooks and clipboard integration (`browser/manager.js:1227`, `browser/manager.js:1199`) | webContents observer adapter + browser interaction service | medium | Listener duplication/leak risk can create ghost focus changes or duplicated copy notifications.
| `core/history/panel.js` | Sidepanel BrowserView lifecycle and layout (`core/history/panel.js:1227`, `core/history/panel.js:1235`, `core/history/panel.js:1446`, `core/history/panel.js:1455`) | history panel domain service + platform view host adapter | low | Isolated surface with clear bounds logic; good first extraction candidate.
| `core/history/panel.js` | Sidepanel focus/z-order and rendered HTML load (`core/history/panel.js:1381`, `core/history/panel.js:1449`, `core/history/panel.js:2171`) | history renderer adapter (data-url render transport) + panel controller | low | Main risk is preserving panel focus handoff and render debounce behavior.

## Step 1 Outcome - First Decomposition Slice
- Recommended first extraction slice for step 3: `core/history/panel.js` BrowserView host boundary.
- Why this slice first: low coupling to split/devtools logic, no app-wide startup dependency, and clear parity checks (show/hide/focus/layout/render cadence).
- Guardrails for slice: keep existing panel state machine unchanged; extract only Electron view host operations and webContents transport behind adapter methods.

## Step 2 Ownership Map - Target Boundaries and Contracts
| Current module | Responsibility slice | Target owner | Proposed module path | Public contract (inputs/outputs) | Lifecycle sensitivity | Depends on |
|---|---|---|---|---|---|---|
| `main.js` | App bootstrap sequencing, service wiring, app lifecycle | orchestration | `main.js` (retain) | Inputs: app-ready, window lifecycle, config reload. Outputs: ordered calls to domain services/adapters only. | high | config service, buffers, UI shell, history panel, dispatcher |
| `main.js` | Browser/session security policy registration (`onBeforeRequest`, request headers, permission handlers, `window.open` denial, navigation allowlist) | platform adapter | `core/adapters/platform/securityPolicy.js` | `registerSessionPolicies({ session, configService, notificationsService }) -> unregisterFn`; `registerWebContentsPolicies({ app, isAllowedNavigationUrl, notificationsService }) -> unregisterFn` | high | Electron `session`/`app`, URL policy, notifications |
| `main.js` | IPC channel registration/teardown | platform adapter | `core/adapters/platform/ipcRegistry.js` | `registerUiIpc({ ipcMain, guards, handlers }) -> unregisterFn`; `registerSettingsIpc({ ipcMain, guards, handlers }) -> unregisterFn` | high | Electron `ipcMain`, sender guard helpers, domain handlers |
| `main.js` | Native integrations: display bounds lookup | platform adapter | `core/adapters/platform/displayInfo.js` | `isBoundsVisibleOnAnyDisplay(screen, bounds) -> boolean` | low | Electron `screen` |
| `main.js` | Native integrations: clipboard reads/writes | platform adapter | `core/adapters/platform/clipboardService.js` | `readText() -> string`; `writeText(text) -> void` | low | Electron `clipboard` |
| `main.js` | Native integrations: OS theme signal bridge | platform adapter | `core/adapters/platform/themeSignals.js` | `getSystemPrefersDark(nativeTheme) -> boolean`; `subscribeNativeTheme(nativeTheme, onUpdated) -> unsubscribeFn` | low | Electron `nativeTheme` |
| `main.js` | Active webContents event binding for mode/input tracking | split: platform adapter + core service | `core/adapters/platform/webContentsEvents.js`; `core/webModeSyncService.js` | adapter: `bindWebModeTracking(webContents, callbacks) -> unbindFn`; service: `requestWebModeSync(webContents, delayMs)` | medium | buffers, editor surface adapter, mode transition service |
| `ui/shell/manager.js` | Shell UI view-model state (tabline/urlline/statusline/overlay visibility + models) | UI domain service | `ui/shell/service.js` | Setters/updaters keep current semantics: `setTheme`, `renderTabline`, `renderUrlline`, `show/hide overlays` | medium | theme helpers, UI constants |
| `ui/shell/manager.js` | Overlay BrowserView creation/attach/destroy lifecycle | platform adapter | `core/adapters/platform/overlayViewHost.js` | `createOverlayHost(windowRef, overlayDescriptors) -> host`; host methods `attachAll`, `destroyAll`, `getView(id)` | high | Electron `BrowserView`/`BrowserWindow` |
| `ui/shell/manager.js` | Overlay geometry and z-order (`setBounds`, `setTopBrowserView`) | platform adapter | `core/adapters/platform/overlayLayoutHost.js` | `applyOverlayLayout(host, layoutModel) -> void`; `applyOverlayStack(host, stackModel) -> void` | high | window bounds, BrowserView stack order |
| `ui/shell/manager.js` | DOM patch transport via `executeJavaScript` and data URL loads | renderer adapter | `core/adapters/renderer/shellPatchTransport.js` | `loadHtmlDataUrl(webContents, html) -> Promise<void>`; `pushPatch(webContents, script, { swallowErrors }) -> Promise<void>` | medium | Electron `webContents` |
| `browser/manager.js` | Buffer/split domain decisions (active buffer, focused pane, split ratio, mirror source) | UI domain service | `browser/service.js` | Keep behavior contract for `create/switch/close/focus/split` while delegating host operations to adapters | high | buffer model, config, notifications |
| `browser/manager.js` | Content BrowserView host operations (attach/detach/layout/top) | platform adapter | `core/adapters/platform/contentViewHost.js` | `attachView(view)`; `detachView(view)`; `setViewBounds(view, bounds)`; `setViewAutoResize(view, opts)`; `setTopView(view)` | high | Electron window/view APIs |
| `browser/manager.js` | Devtools split primitives (`setDevToolsWebContents`, open/close/destroy) | platform adapter | `core/adapters/platform/devtoolsHost.js` | `openSplitDevtools({ targetWebContents, devtoolsView })`; `closeSplitDevtools({ targetWebContents, devtoolsView, windowRef })` | high | Electron devtools/webContents APIs |
| `browser/manager.js` | WebContents observer hooks + selection copy bridge | platform adapter | `core/adapters/platform/webContentsObserver.js` | `bindPaneObservers(webContents, handlers) -> unbindFn`; `readSelection(webContents) -> Promise<string>` | medium | webContents events, clipboard service |
| `core/history/panel.js` | History/bookmark tree state machine and key handling rules | UI domain service | `core/history/panelService.js` | Preserve current behaviors for `show/hide/focus/layout model/render model/handle input` | medium | history/bookmarks services, mode/editor focus services |
| `core/history/panel.js` | Sidepanel BrowserView lifecycle, layout, and top view ownership | platform adapter | `core/adapters/platform/panelViewHost.js` | `createPanelViewHost(windowRef, prefs) -> host`; host methods `show(bounds)`, `hide()`, `focusTop()`, `destroy()` | low | BrowserView/BrowserWindow |
| `core/history/panel.js` | Debounced renderer transport (`loadURL(data:)`) | renderer adapter | `core/adapters/renderer/panelRenderTransport.js` | `scheduleHtmlRender(viewRef, html, delayMs) -> cancelFn`; `cancelPending() -> void` | low | webContents load URL |

## Step 2 No-Crossing Rules
- Orchestration modules can coordinate lifecycle ordering, but must not hold raw Electron policy logic once adapter boundaries exist.
- UI domain services own state and intent decisions, but must not directly call `BrowserWindow`/`BrowserView`/`webContents` primitives.
- Platform adapters own Electron primitives, event listeners, and cleanup contracts; they do not contain domain branching.
- Renderer adapters own HTML/script transport only (`loadURL(data:)`, `executeJavaScript`) and remain side-effect minimal.
- Any temporary passthrough crossing this map must be marked as phase-local debt and removed in step 6.

## Step 2 Outcome - Extraction Order for Step 3+
- First extraction slice (step 3): `core/history/panel.js` BrowserView host boundary + render transport split.
- Second extraction candidate: `main.js` security policy + IPC registry adapters (high payoff, medium risk).
- Later higher-risk slices: overlay stack/layout in `ui/shell/manager.js`, then split/devtools host in `browser/manager.js`.

## Behavior Parity Checklist
- [ ] Startup/shutdown behavior unchanged
- [ ] Overlay/panel z-order behavior unchanged
- [ ] Buffer lifecycle and focus behavior unchanged
- [ ] Statusline/tabline/urlline update cadence unchanged

## Validation
- [ ] Manual: startup/shutdown parity script
- [ ] Manual: overlay/panel split-view parity script
- [ ] Focused tests for extracted service contracts

## Risks
| Risk | Trigger | Mitigation |
|---|---|---|
| Lifecycle regressions during split | event order changes | isolate one lifecycle slice per PR |
| Adapter leakage back into orchestration | partial extraction | ownership map + lint/check rules |
| Hard-to-debug behavior drift | wide refactor scope | small PRs with strict parity checklist |

## Exit Criteria
- [ ] Direct Electron coupling reduced in target modules
- [ ] Monolith decomposition milestones completed
- [ ] All parity validations pass
- [ ] Phase status updated in master plan

## Handoff Notes
- Done:
  - Completed step 1 inventory for direct Electron/WebContents/BrowserView coupling by module.
  - Identified `core/history/panel.js` as the lowest-risk first decomposition slice for step 3.
  - Completed step 2 ownership map with explicit target owner, module path, and contract boundary per responsibility slice.
- Remaining:
  - steps 3 through 6.
- Known pitfalls:
  - Splitting too many modules in one session reduces confidence and rollback safety.
- Next exact step:
  - Execute step 3: extract first decomposition slice (`core/history/panel.js` BrowserView host boundary) and validate parity.
