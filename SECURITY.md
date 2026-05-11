# Security Policy

## Reporting a Vulnerability

Please use GitHub Private Vulnerability Reporting for Noctra:

- Open the repository "Security" tab and submit a private report.
- Do not open public GitHub issues for suspected vulnerabilities.

This is the canonical reporting path for this project.

## Scope

This policy applies to vulnerabilities in this repository, including:

- Electron main/renderer boundaries and preload exposure.
- IPC contracts and sender validation.
- Trusted internal surfaces (shell, settings, side panel).
- Session, history, and bookmark persistence handling.

Out-of-scope examples (unless chained with a security impact):

- General feature requests.
- Pure UI/UX bugs without security impact.
- Performance issues without security impact.

## Supported Versions

Noctra is currently early stage (`0.x`).

- Security fixes are applied to the latest commit on the default branch first.
- We do not currently maintain backported security patches for older `0.x` snapshots.

If a stable release branch policy is introduced later, this section will be updated.

## Security Posture (Current)

Current implementation and tests aim to provide the following baseline:

- Untrusted web content is not intended to receive privileged internal preload bridges in tested runtime paths.
- Privileged IPC paths are explicit-contract based and include sender/role/frame trust checks.
- Trusted internal surfaces are constrained by navigation and CSP policy controls.
- Downloads are governed by explicit `will-download` policy with deny/prompt/allow controls.
- Canonical security and regression validation runs via `npm run ci:test`.

These statements describe current project reality; they are not a claim of complete exploit-proofing.

For architecture details behind these controls, see `docs/architecture.md`.

## Disclosure Expectations

Please follow responsible disclosure:

- Give maintainers a reasonable window to triage and prepare a fix before public disclosure.
- Share reproduction details, impact, and environment information where possible.
- Avoid accessing or modifying data that is not yours.

## What to Include in a Report

Please include as much of the following as possible:

- Affected commit/revision and platform (OS, Node, npm).
- Reproduction steps (minimal proof of concept preferred).
- Security impact and likely attack preconditions.
- Any suggested mitigation.

## Response Process

Maintainers will:

- Acknowledge receipt.
- Triage severity and scope.
- Validate and reproduce.
- Prepare and ship a fix when confirmed.
- Coordinate disclosure timing through the advisory thread.
