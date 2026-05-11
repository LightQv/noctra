const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeDownloadConfig,
  sanitizeDownloadFilename,
  buildSafeDownloadPath,
  resolveDownloadDecision,
} = require("../core/security/downloadPolicy");
const { isTrustedInternalRole, SURFACE_ROLES } = require("../core/security/surfaceTrust");

test("download policy normalizes defaults", () => {
  const result = normalizeDownloadConfig({});
  assert.equal(result.policy, "prompt");
  assert.equal(result.allowTrustedSurfaces, false);
  assert.equal(result.defaultDirectory, null);
  assert.equal(result.autoOpen, false);
});

test("download policy sanitizes suspicious filenames", () => {
  assert.equal(sanitizeDownloadFilename("../../secret.txt"), "secret.txt");
  assert.equal(sanitizeDownloadFilename("bad:name?.zip"), "bad_name_.zip");
});

test("download policy builds safe destination path", () => {
  const output = buildSafeDownloadPath("/tmp/downloads", "../report.pdf");
  assert.equal(output, "/tmp/downloads/report.pdf");
});

test("download policy resolves deny decision", () => {
  const decision = resolveDownloadDecision({
    role: SURFACE_ROLES.UNTRUSTED_WEB,
    isTrustedInternalRole,
    config: { policy: "deny" },
  });
  assert.equal(decision.action, "deny");
});

test("download policy blocks trusted surfaces when disabled", () => {
  const decision = resolveDownloadDecision({
    role: SURFACE_ROLES.TRUSTED_SHELL,
    isTrustedInternalRole,
    config: { policy: "allow", allow_trusted_surfaces: false },
  });
  assert.equal(decision.action, "deny");
  assert.equal(decision.reason, "trusted_surface_downloads_disabled");
});

test("download policy resolves prompt and allow decisions", () => {
  const promptDecision = resolveDownloadDecision({
    role: SURFACE_ROLES.UNTRUSTED_WEB,
    isTrustedInternalRole,
    config: { policy: "prompt" },
  });
  const allowDecision = resolveDownloadDecision({
    role: SURFACE_ROLES.UNTRUSTED_WEB,
    isTrustedInternalRole,
    config: { policy: "allow" },
  });

  assert.equal(promptDecision.action, "prompt");
  assert.equal(allowDecision.action, "allow");
});
