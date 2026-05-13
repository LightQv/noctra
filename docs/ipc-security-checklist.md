# IPC Security Checklist

Use this checklist when adding or modifying any IPC channel.

## Contract and trust checks

- [ ] Channel is registered in `runtime/ipcRegistration.js` with explicit handler/event intent.
- [ ] Payload contract is defined or updated in `core/contracts/ipc.js`.
- [ ] Unknown payload keys are rejected (strict shape).
- [ ] Sender trust is verified (window ownership + surface role + frame URL where applicable).
- [ ] Untrusted senders fail closed with standardized boundary errors.

## Error handling and observability

- [ ] Rejections use standardized error shape from `core/contracts/errors.js`.
- [ ] Error codes are explicit and stable (for example: `contract_invalid_payload`, `contract_unauthorized_sender`).
- [ ] Failure paths emit actionable logs or notifications without exposing sensitive internals.

## Privilege boundary hygiene

- [ ] Channel does not grant direct privileged capability to untrusted page contexts.
- [ ] Trusted internal surface channels are scoped to required actions only.
- [ ] No broad wildcard bridging from renderer to main.

## Required tests

- [ ] Add/update `tests/ipc-contracts.test.js` coverage for valid payload acceptance.
- [ ] Add/update `tests/ipc-contracts.test.js` coverage for malformed payload rejection.
- [ ] Add/update `tests/ipc-contracts.test.js` coverage for untrusted sender rejection.
- [ ] Run `npm run test:smoke:security` to validate runtime boundary behavior.

## Required local commands

```bash
npm run check:intents
npm run check:state-ownership
npm run check:security-baseline
npm test
npm run test:smoke:security
npm run ci:test
```
