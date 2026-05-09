const test = require("node:test");
const assert = require("node:assert/strict");

const { isAllowedTrustedSurfaceUrl } = require("../core/security/surfaceTrust");

test("trusted surface URL policy allows only strict internal forms", () => {
  assert.equal(isAllowedTrustedSurfaceUrl("about:blank"), true);
  assert.equal(isAllowedTrustedSurfaceUrl("data:text/html;charset=utf-8,%3Cp%3Eok%3C%2Fp%3E"), true);
});

test("trusted surface URL policy rejects broad or malformed data URLs", () => {
  assert.equal(isAllowedTrustedSurfaceUrl("https://example.com"), false);
  assert.equal(isAllowedTrustedSurfaceUrl("data:text/html,<p>loose</p>"), false);
  assert.equal(isAllowedTrustedSurfaceUrl("data:text/html;base64,PHA+bG9vc2U8L3A+"), false);
  assert.equal(isAllowedTrustedSurfaceUrl("data:text/plain;charset=utf-8,hello"), false);
  assert.equal(isAllowedTrustedSurfaceUrl(""), false);
  assert.equal(isAllowedTrustedSurfaceUrl(null), false);
});
