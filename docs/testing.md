# Testing Guide

This guide explains Noctra test scopes, where to add tests, and which commands to run.

## Test scopes

- `tests/app/*`: application behavior and core logic (state transitions, input/keymap grammar, resolvers, config behavior).
- `tests/security/*`: security boundaries and policy behavior (intent/IPC contracts, URL/download policy, trusted surface checks).
- `tests/guardrails/*`: engineering safety checks that prevent policy and architecture drift (ownership checks, invariants behavior, dependency pin policy).
- `tests/smoke/*`: runtime Electron lifecycle and integration sanity checks.

## Where to add a new test

- Put it in `tests/app/*` if it validates product behavior from user-facing logic.
- Put it in `tests/security/*` if it validates trust boundaries, payload validation, navigation/download policy, or privileged channel handling.
- Put it in `tests/guardrails/*` if it validates contributor/process rules or repository-level hardening checks.
- Put it in `tests/smoke/*` if it validates end-to-end runtime behavior that crosses module boundaries.

## Command matrix

- Full unit/contract suite: `npm test`
- App-only unit/contract tests: `npm run test:app`
- Security-only unit/contract tests: `npm run test:security`
- Guardrail-only unit/contract tests: `npm run test:guardrails`
- Smoke startup: `npm run test:smoke`
- Smoke security boundary: `npm run test:smoke:security`
- Canonical local gate (same structure as CI hardening gate): `npm run ci:test`

## Required policy checks

- `npm run check:intents`: enforces `INTENTS.md` parity with `core/intents.js`.
- `npm run check:state-ownership`: enforces state write boundaries.
- `npm run check:security-baseline`: enforces secure defaults policy baseline.
- `npm run check:deps-locked`: enforces exact pinned dependency versions.

## Minimal pre-PR checklist

1. Run `npm run lint`.
2. Run `npm run format:check`.
3. Run `npm run ci:test`.
4. Run `npm audit --audit-level=high`.
