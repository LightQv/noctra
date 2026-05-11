# Release Checklist

Use this checklist before publishing a new Noctra release.

## Version and notes

- [ ] Bump version in `package.json`.
- [ ] Draft release notes with user-visible changes and migration notes.
- [ ] Document any keybinding or command contract changes.

## Quality gates

- [ ] Run `npm run lint`.
- [ ] Run `npm run format:check`.
- [ ] Run `npm run check:intents`.
- [ ] Run `npm run ci:test`.

## Security and policy checks

- [ ] Confirm security-sensitive defaults remain intentional.
- [ ] Confirm trusted surface and IPC boundary tests are green.
- [ ] Confirm download governance (`will-download` deny/prompt/allow) behavior matches policy.
- [ ] Review `npm audit --audit-level=high` output.

## Documentation sync

- [ ] `INTENTS.md` matches `core/intents.js`.
- [ ] Update relevant docs in `docs/` and `README.md`.
- [ ] Confirm `CONTRIBUTING.md` references current workflows.

## Packaging status

- [ ] Verify current packaging/signing/notarization status in release notes.
- [ ] If artifacts are distributed, attach checksums.

## Final publish

- [ ] Tag release commit.
- [ ] Publish GitHub release.
- [ ] Monitor post-release issues/regressions.
