## Overall Assessment

Phase 05 is close, but I would not mark it fully complete yet. The core hardening changes are directionally correct: trusted surface roles are introduced and applied at the main creation boundaries (`core/security/surfaceTrust.js:1-54`, `main.js:1385-1387`, `core/dispatcher.js:119-124`, `core/adapters/platform/panelViewHost.js:9-20`, `browser/buffers.js:43-49`); trusted-surface navigation blocking is enforced (`core/adapters/platform/securityPolicy.js:41-70`); and privileged settings IPC now checks sender identity, expected role, active-buffer status, and trusted frame URL (`main.js:925-955`, `main.js:1073-1126`).

I also verified the current worktree test claims that matter most here: `npm test` passes, and `npm run test:smoke:security` completes successfully.

My verdict is **ready-with-conditions**.

## Top Risks (ranked)

1. **The “smoke-only” probe is not actually smoke-only at the preload boundary**  
   `ui/shell/preload.js:28-30` always exposes `window.uiShell.probePrivilegedIpc()` in production builds. The handler is test-gated in `main.js:1181-1183`, which prevents privilege escalation, but the API surface still ships. That is a mismatch with the stated design and an avoidable privileged-bridge expansion.

2. **The probe validates guard logic via a synthetic event, not a real unauthorized renderer IPC attempt**  
   In `main.js:1128-1157`, `onSecurityProbePrivilegedIpc()` fabricates `fakeEvent = { sender, senderFrame: { url: "https://evil.invalid" } }` and calls `onSettingsGet/Save/Close` directly. This is useful for deterministic coverage of the guard logic, but it is not a full end-to-end proof that an actual unauthorized renderer invocation path is rejected by Electron at runtime.

3. **Trusted URL allowlist is broad for `data:`**  
   `core/security/surfaceTrust.js:32-45` allows any `data:text/html...` URL for trusted surfaces. That matches current internal rendering, but it means trusted shell/settings/panel surfaces are permitted to navigate to arbitrary HTML data URLs, not just app-generated ones. That is not an immediate Phase 05 blocker, but it is a meaningful follow-up hardening gap.

## Strengths

- Good centralization of trust checks in `main.js:925-955`; this is much better than per-handler ad hoc checks.
- Navigation hardening in `core/adapters/platform/securityPolicy.js:41-70` is simple and readable.
- The bridge cleanup in `ui/shell/preload.js` removes stale shell editor methods, reducing confusion and attack surface.
- CSP/sanitization work is sensible and targeted (`core/history/panel.js:26-28`, `core/settings/page.js:29-39`, `core/settings/page.js:62-75`).
- Contract coverage for trusted-surface navigation exists (`tests/adapter-contracts.test.js:173-218`).

## Suggested Improvements

1. **Gate the probe bridge in preload as well as main**  
   Rationale: if this is a test-only proof hook, it should not exist on `window.uiShell` outside smoke runs.  
   Expected impact: removes a production-only API mismatch with effectively zero product risk.  
   File: `ui/shell/preload.js:28-30`

2. **Document the probe as partial proof, not full runtime equivalence**  
   Rationale: the current probe proves that the privileged guard rejects an untrusted sender/frame tuple, but it does so by direct handler invocation from main, not by an actual hostile renderer path.  
   Expected impact: avoids overstating the proof in Phase 05 docs and keeps the exit criteria honest.  
   Files: `main.js:1128-1157`, `docs/hardening/phase-05-security-boundary-closure.md`

3. **Narrow trusted-surface URL allowance in a future pass**  
   Rationale: `isAllowedTrustedSurfaceUrl()` currently accepts arbitrary `data:text/html...` content. A nonce/tokenized scheme or app-owned custom protocol would be tighter.  
   Expected impact: reduces blast radius if a trusted internal surface ever gains script injection.  
   File: `core/security/surfaceTrust.js:32-45`

## Final Recommendation

**approve** for Phase 05 only as **ready-with-conditions**.

Conditions:

- **Critical:** none.
- **High:** gate `probePrivilegedIpc()` out of production preload exposure (`ui/shell/preload.js:28-30`) or explicitly accept and document that the bridge method ships while only the handler is smoke-gated.
- **Medium:** document that the synthetic probe is guard-level proof rather than a full hostile-renderer E2E proof (`main.js:1128-1157`, `docs/hardening/phase-05-security-boundary-closure.md`).
- **Medium:** track narrowing of trusted `data:` navigation allowance as follow-up hardening (`core/security/surfaceTrust.js:32-45`).
