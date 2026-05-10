## Overall Assessment

- Working tree is clean, so this review covers the current HEAD state rather than an uncommitted diff.
- The intent pipeline direction is good: `motions -> input -> dispatcher -> domain handlers/adapters` is visible and materially better for long-term growth than direct Electron calls from motion code.
- The biggest remaining OSS-readiness risk is not conceptual architecture, but concentration of responsibility in a few very large modules (`main.js`, `browser/manager.js`, `ui/shell/manager.js`). Those files now act as orchestration hubs, feature containers, and test harnesses at once.
- Command boundaries are mostly present, but state ownership is still diffuse. Direct mutation of shared state from `main.js`, motion handlers, and dispatcher handlers creates hidden coupling that will slow future contributors.
- Adapter extraction is a real strength, especially around security policy, content view hosting, and renderer bridges. That said, some renderer/web interactions are still stringly-typed `executeJavaScript` contracts, which are harder to evolve safely.
- Documentation quality is good overall, but the intent contract docs have drifted from implementation. For OSS contributors, stale architecture contracts are worse than missing detail because they create false confidence.
- Test posture is stronger than many early Electron OSS projects: CI exists, smoke coverage exists, and security boundaries are being exercised. The highest ROI next step is to make the architecture easier to change, not to add more broad tests first.

## Top Risks (ranked)

| Severity | Area | Issue | Why it matters | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| P1 | Runtime orchestration | `main.js` is carrying bootstrap, input coordination, IPC registration, window lifecycle, smoke scenarios, and runtime sync in one ~1955-line file. | This makes the intent pipeline harder to audit, raises change risk, and creates a steep contributor ramp. It also undermines the main/adapter boundary by turning the entrypoint into a knowledge bottleneck. | Extract by responsibility first, not by feature count: `app/createWindow`, `runtime/inputCoordinator`, `runtime/ipc/registerShellIpc`, `runtime/windowPersistence`, and `smoke/scenarios/*`. Keep `main.js` as composition only. | M-L |
| P1 | State ownership | Shared `core/state.js` is mutated from many places (`main.js`, `motions/normal.js`, `motions/command.js`, `core/modeTransitionService.js`, dispatcher handlers). | Hidden write paths make mode bugs, focus bugs, and future undo/replay/debug tooling much harder. Contributors cannot tell which layer owns which state transitions. | Introduce small domain state services/reducers for command line, leader session, urlline, and mode transitions. Make each state field have one obvious write boundary. | M |
| P1 | Buffer/pane architecture | `browser/manager.js` has grown into buffer store + pane layout + split/devtools + window event handling + selection behavior in one ~1332-line class. | This is the main migration risk for future multi-engine work. The manager currently knows too much about Electron view hosting and UI layout, so swapping or extending engines/panes will be expensive. | Split into façade + subservices: `bufferRegistry`, `paneLayoutController`, `splitController`, `devtoolsController`, `selectionClipboardObserver`. Keep `browser/manager` as a thin coordinator. | L |
| P1 | Contributor contract drift | `INTENTS.md` no longer matches `core/intents.js` (missing intents like `REOPEN_BUFFER`, `OPEN_NOTIFICATIONS_BUFFER`, theme/language/history/bookmark/telescope intents, etc.). | For OSS, the intent contract is part of the public architecture. Drift here causes wrong changes, duplicate logic, and review friction. | Add a parity test or generate `INTENTS.md` from `core/intents.js`. At minimum, fail CI when documented intents diverge from implementation. | S |
| P2 | Renderer/web action contracts | Several interactions still rely on string-based JS injection (`core/adapters/renderer/editorSurface.js`, `core/adapters/platform/webContentsActions.js`, UI patch transports, smoke probes in `main.js`). | These contracts are brittle, hard to refactor, and harder to secure-review than explicit APIs. They are acceptable for page scrolling, but risky as an expanding general integration pattern. | Keep script injection limited to untrusted page actions. For trusted internal surfaces, prefer explicit preload APIs or centralized script modules with named helpers and tests. | M |
| P2 | UI module size | `ui/shell/manager.js` is another large mixed-responsibility file (~1825 lines) combining HTML/CSS templates, layout logic, and renderer patching. | Even if runtime layering is correct, contributors will struggle to change shell UI without touching a giant file with multiple concerns. | Split static HTML/template generation, overlay controllers, and shell state patching into separate modules. | M |

## Strengths

- The intent/dispatcher split is real, not cosmetic; handler factories under `core/dispatcher/handlers/*` are a good direction.
- Electron hardening defaults are in place (`contextIsolation`, `sandbox`, `nodeIntegration: false`) and backed by security-oriented tests.
- Adapter modules such as `securityPolicy`, `ipcRegistry`, `contentViewHost`, and `webContentsActions` improve local reasoning and create better seams for testing.
- The repo already has unusually solid early-stage OSS hygiene: README, architecture docs, contributing guide, security policy, CI, and smoke tests.
- Config/keymap work is contributor-friendly in principle: data-driven mappings and config schema/defaults are the right long-term model.

## Suggested Improvements

### Executive summary

- Review scope note: there is no current uncommitted diff; this is a review of the current repository state at HEAD.
- The architecture direction is good and close to OSS-usable, but the repo still has a few “god modules” that hide the intent pipeline’s otherwise clean layering.
- The highest-leverage cleanup is to make ownership explicit: one module should own window bootstrap, one should own input coordination, one should own shell UI composition, and one should own buffer/pane orchestration.
- State mutation boundaries need tightening more than new abstractions do; right now the architecture reads cleaner than it behaves.
- Docs/testing/security posture are ahead of average for this stage, which is a strong base for an OSS release.
- Biggest practical gap for contributors: intent/docs drift and large files that require broad context before making safe edits.

### Findings table

| Severity | Area | Issue | Why it matters | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| P1 | Runtime entrypoint | `main.js` is still the operational center of gravity. | New features will keep accreting here unless a composition-only rule is enforced. | Move smoke helpers and lifecycle coordinators out first; make `createWindow()` mostly wiring. | M |
| P1 | State consistency | Direct mutation of `state` across layers obscures ownership. | Harder debugging, harder tests, more fragile modal behavior. | Add focused state transition modules and forbid ad hoc writes for new state fields. | M |
| P1 | Engine extensibility | `browser/manager.js` mixes engine/view specifics with browser-domain behavior. | Multi-engine support will require untangling orchestration from platform details later at higher cost. | Separate buffer domain model from Electron pane/view implementation. | L |
| P1 | OSS contributor ergonomics | `INTENTS.md` is stale relative to `core/intents.js`. | Contributors will target the wrong contract. | Add doc generation or a contract parity test in CI. | S |
| P2 | Trusted-surface integration | Internal surface behavior depends on injected global function names. | Fragile refactors and weaker interface discoverability. | Prefer explicit preload bridge APIs for trusted surfaces. | M |
| P2 | Shell UI maintainability | `ui/shell/manager.js` is too broad. | Slows UI iteration and onboarding. | Split overlays/templates/update transports. | M |

### OSS readiness checklist

- [x] Clear README with project scope, status, and quick start
- [x] Contributing guide and security policy present
- [x] CI exists and runs both contract/unit and smoke checks
- [x] Architecture and intent docs exist
- [ ] Add automated parity check between `INTENTS.md` and `core/intents.js`
- [ ] Add a lightweight architecture decision record or module map for `main`, `browser`, `core`, `ui`, and adapters
- [ ] Add a lint/format gate (`npm run lint`, formatter, or equivalent) so style and obvious mistakes are machine-enforced
- [ ] Add a release checklist/workflow for packaging/signing/notarization expectations, even if releases are still manual
- [ ] Add a formal `CODE_OF_CONDUCT.md` before wider OSS promotion
- [ ] Document how smoke tests are intended to run locally and in CI, including platform assumptions
- [ ] Clarify source-of-truth docs: `AGENTS.md` vs `docs/architecture.md` vs `INTENTS.md`

### Next actions

1. Extract smoke scenarios out of `main.js` into `tests/smoke/runtime-scenarios/*` or a dedicated runtime-smoke module.
2. Split `main.js` into composition-only bootstrap plus input/IPC/window lifecycle coordinators.
3. Define explicit write ownership for `state` domains (mode, command line, leader, urlline, editor focus) and route new writes through those modules only.
4. Break `browser/manager.js` into domain + platform/layout pieces so multi-engine support remains feasible.
5. Add CI enforcement that `INTENTS.md` stays in sync with `core/intents.js`.
6. Reduce trusted-surface string injection by promoting editor/settings interactions to named preload contracts.
7. Add lint/format scripts and wire them into CI to improve contributor consistency.
8. Publish a short OSS release doc covering support expectations, smoke-test workflow, and packaging/signing status.

## Final Recommendation

changes requested
