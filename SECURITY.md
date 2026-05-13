<div align="center">

# Security Policy

Reporting vulnerabilities, disclosure expectations, and response process.

[Reporting](#reporting-a-vulnerability) · [Scope](#scope) · [Versions](#supported-versions) · [Posture](#security-posture) · [Disclosure](#disclosure-expectations) · [Response](#response-process)

</div>

---

## Reporting a Vulnerability

Use GitHub Private Vulnerability Reporting. Open the repository "Security" tab and submit a private report.

Do not open public GitHub issues for suspected vulnerabilities.

---

## Scope

In scope:

- Electron main/renderer boundaries and preload exposure.
- IPC contracts and sender validation.
- Trusted internal surfaces (shell, settings, side panel).
- Session, history, and bookmark persistence handling.

Out of scope (unless chained with a security impact):

- General feature requests.
- Pure UI/UX bugs without security impact.
- Performance issues without security impact.

---

## Supported Versions

Noctra is early stage (`0.x`).

- Security fixes are applied to the latest commit on `main` first.
- No backported patches for older `0.x` snapshots.
- If a stable release branch policy is introduced later, this section will be updated.

---

## Security Posture

Current baseline:

- Untrusted web content does not receive privileged internal preload bridges in tested paths.
- Privileged IPC paths are explicit-contract based with sender/role/frame trust checks.
- Trusted internal surfaces are constrained by navigation and CSP policy controls.
- Downloads are governed by explicit `will-download` policy with deny/prompt/allow controls.
- Canonical security validation runs via `npm run ci:test`.

These describe current project reality; they are not a claim of complete exploit-proofing.

For architecture details, see [docs/architecture.md](docs/architecture.md).

---

## Disclosure Expectations

- Give maintainers a reasonable window to triage and prepare a fix before public disclosure.
- Share reproduction details, impact, and environment information where possible.
- Avoid accessing or modifying data that is not yours.

---

## What to Include

- Affected commit/revision and platform (OS, Node, npm).
- Reproduction steps (minimal proof of concept preferred).
- Security impact and likely attack preconditions.
- Any suggested mitigation.

---

## Response Process

Maintainers will:

1. Acknowledge receipt.
2. Triage severity and scope.
3. Validate and reproduce.
4. Prepare and ship a fix when confirmed.
5. Coordinate disclosure timing through the advisory thread.
