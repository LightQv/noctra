# OSS Readiness Stabilization Plan (Single-Pass)

## Goal
Ship one focused stabilization pass that improves architecture consistency, security defaults, and OSS contributor ergonomics without iterative churn.

## Scope Boundaries
- In scope: module boundaries, state ownership, intent/IPC contract enforcement, secure defaults, CI/docs guardrails.
- Out of scope: feature expansion, deep UI redesign, plugin system work, multi-engine implementation beyond adapter boundary prep.

## Success Criteria (Definition of Done)
- Runtime orchestration no longer concentrated in one monolith (`main.js`).
- Clear single-writer ownership for mode/leader/command/urlline state.
- Intent and IPC payload contracts validated at boundaries (fail closed).
- Secure defaults tightened (URL/trusted-surface/download policy) with documented opt-in relaxations.
- CI enforces contract/docs consistency and security hygiene.
- OSS contributors can add/modify intents via documented, predictable workflow.

---

## Work Breakdown (with estimates)

### 1) Decompose Runtime Orchestration (`main.js`)
- **Priority:** P1
- **Estimate:** L
- **Dependencies:** none
- **Tasks:**
  - Extract bootstrap composition layer from runtime logic.
  - Create modules: `windowLifecycle`, `inputCoordinator`, `ipcRegistration`, `smokeScenarios`.
  - Keep top-level `main.js` as wiring/composition only.
- **Acceptance checks:**
  - `main.js` mostly orchestrates imports and startup wiring.
  - No behavior regressions in startup, mode handling, window creation.

### 2) Split Browser and Shell Managers
- **Priority:** P1
- **Estimate:** L
- **Dependencies:** #1 recommended first
- **Tasks:**
  - Split `browser/manager.js` into `bufferRegistry`, `paneLayoutController`, `splitController`, `devtoolsController`.
  - Split `ui/shell/manager.js` into shell template/bootstrap, overlays/controllers, update transport bridge.
- **Acceptance checks:**
  - Existing behavior retained.
  - Service responsibilities are explicit and testable by module.

### 3) Enforce State Ownership Domains
- **Priority:** P1
- **Estimate:** M
- **Dependencies:** #1
- **Tasks:**
  - Define state transition modules for:
    - mode state
    - leader sequence state
    - command-line state
    - urlline/focus state
  - Reduce direct ad hoc writes from scattered layers.
- **Acceptance checks:**
  - Each domain has one obvious write boundary.
  - Call sites route through explicit transitions/services.

### 4) Intent/IPC Contract Validation Layer
- **Priority:** P1
- **Estimate:** M
- **Dependencies:** #1, #3
- **Tasks:**
  - Create canonical contract map for intents + IPC channels.
  - Add runtime payload validation at dispatcher/IPC boundaries.
  - Standardize error/rejection shape.
- **Acceptance checks:**
  - Invalid payloads rejected consistently.
  - Privileged channels cannot be called with malformed input.

### 5) Tighten URL and Trusted-Surface Security Defaults
- **Priority:** P1
- **Estimate:** M
- **Dependencies:** #4 preferred
- **Tasks:**
  - Preserve developer-first local HTTP defaults (loopback/private LAN allowed) while blocking unsafe schemes and non-local HTTP by default; keep explicit allowlist config for additional hosts.
  - Narrow trusted surface identity (avoid broad `data:` trust semantics).
  - Ensure policy is documented in config docs.
- **Acceptance checks:**
  - Default policy is secure-by-default for non-local navigation, while preserving local developer workflows.
  - Local/LAN behavior and host allowlist controls are explicitly documented.

### 6) Add Explicit Download Governance
- **Priority:** P2
- **Estimate:** S
- **Dependencies:** none
- **Tasks:**
  - Add `will-download` handling with explicit allow/prompt/deny path.
  - Sanitize destination behavior and surface user intent clearly.
- **Acceptance checks:**
  - Untrusted pages cannot silently trigger unsafe download behavior.

### 7) CI/Docs OSS Guardrails
- **Priority:** P1
- **Estimate:** M
- **Dependencies:** #4 recommended
- **Tasks:**
  - Add CI check for `INTENTS.md` parity with `core/intents.js`.
  - Enforce lint/format/test/security checks (fail on high-risk policy).
  - Add contributor docs:
    - architecture map
    - intent lifecycle workflow
    - IPC security checklist
    - release hygiene status
- **Acceptance checks:**
  - CI blocks contract drift.
  - New contributor can follow docs to add an intent safely.

---

## Recommended Commit Sequence

1. **refactor(main): extract runtime orchestration modules from bootstrap**
2. **refactor(browser): split manager into buffer/layout/split/devtools services**
3. **refactor(ui): split shell manager into render/overlay/transport modules**
4. **refactor(state): introduce explicit transition ownership for modal domains**
5. **feat(contracts): add intent and ipc payload validation with unified errors**
6. **security(policy): tighten default URL policy and trusted surface boundaries**
7. **security(downloads): add explicit will-download governance**
8. **chore(ci-docs): enforce intent parity checks and OSS contributor guardrails**

---

## Validation Matrix

- **Behavioral smoke**
  - Startup/shutdown, buffer open/close, split navigation, modal transitions.
- **Intent pipeline**
  - Valid intent accepted, malformed intent rejected, error shape stable.
- **IPC boundary**
  - Trusted sender accepted, untrusted sender denied, malformed payload denied.
- **Security policy**
  - HTTP loopback/LAN denied by default; works only with explicit opt-in.
  - Trusted surface checks enforce narrowed identity model.
  - Download events follow explicit policy.
- **OSS readiness**
  - Docs complete and aligned.
  - CI green with parity + lint + tests + security checks.

---

## Risk Controls

- Keep each refactor step behavior-preserving; avoid mixed feature/refactor commits.
- Add temporary compatibility adapters if module splits are large.
- Gate each major step with smoke tests before moving to next.
- If regressions appear, pause and stabilize before advancing phases.

---

## Suggested Execution Rhythm

- Day 1: #1 + #3
- Day 2: #2
- Day 3: #4 + #5
- Day 4: #6 + #7 + final polish/tests

(Adjust based on refactor complexity; keep the sequence order.)

---

## Optional Nice-to-Haves (only if time remains)

- Internal CSP tightening from inline to nonce/hash for trusted pages.
- Security automation uplift (CodeQL/Semgrep/secret scanning + dependency bot).
- Lightweight architecture diagram in docs.
