const test = require("node:test");
const assert = require("node:assert/strict");

const { buildCatErrorPage } = require("../../core/errorbuffer/page");

test("cat page renders generic content by default", () => {
  const html = buildCatErrorPage();
  assert.match(html, /<h1>Standby<\/h1>/);
  assert.doesNotMatch(html, /Tip: open <code>noctra:\/\/cat<\/code> any time\./);
  assert.equal((html.match(/<p>/g) || []).length, 1);
  assert.match(html, /,;.=\.\.`_\.\.=\.,&#39; -&#39;/);
});

test("cat page renders failure details when provided", () => {
  const html = buildCatErrorPage({
    fromFailure: true,
    failedUrl: "https://example.com",
    errorName: "ERR_CONNECTION_TIMED_OUT",
    errorCode: -118,
  });
  assert.match(html, /<h1>Load Failure<\/h1>/);
  assert.match(html, /Noctra could not load this page\./);
  assert.match(html, /https:\/\/example\.com/);
  assert.match(html, /ERR_CONNECTION_TIMED_OUT/);
  assert.match(html, /-118/);
  assert.equal((html.match(/<p>/g) || []).length, 1);
});
