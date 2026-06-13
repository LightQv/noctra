const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isExtensionInternalUrl,
  validateNavigableUrl,
} = require("../../core/security/urlPolicy");

test("url policy allows https and about:blank", () => {
  assert.equal(validateNavigableUrl("https://example.com").ok, true);
  assert.equal(validateNavigableUrl("about:blank").ok, true);
  assert.equal(validateNavigableUrl("noctra://cat").ok, true);
  assert.equal(validateNavigableUrl("noctra://dashboard").ok, true);
});

test("url policy allows loopback and private LAN over http by default", () => {
  assert.equal(validateNavigableUrl("http://localhost:3000").ok, true);
  assert.equal(validateNavigableUrl("http://127.0.0.1:5173").ok, true);
  assert.equal(validateNavigableUrl("http://192.168.1.25:8080").ok, true);
  assert.equal(validateNavigableUrl("http://10.0.0.15").ok, true);
  assert.equal(validateNavigableUrl("http://172.20.1.9").ok, true);
});

test("url policy blocks non-local http by default", () => {
  const result = validateNavigableUrl("http://example.com");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "http_host_not_allowed");
});

test("url policy honors trusted_http_hosts allowlist for http", () => {
  const result = validateNavigableUrl("http://casaos.local", {
    trustedHttpHosts: ["casaos.local"],
  });
  assert.equal(result.ok, true);
});

test("url policy can explicitly disable loopback and private LAN http", () => {
  const loopback = validateNavigableUrl("http://localhost:3000", {
    allowHttpLoopback: false,
  });
  const lan = validateNavigableUrl("http://192.168.1.25:8080", {
    allowHttpPrivateLan: false,
  });
  assert.equal(loopback.ok, false);
  assert.equal(loopback.reason, "http_host_not_allowed");
  assert.equal(lan.ok, false);
  assert.equal(lan.reason, "http_host_not_allowed");
});

test("url policy blocks unsafe schemes", () => {
  assert.equal(validateNavigableUrl("javascript:alert(1)").ok, false);
  assert.equal(validateNavigableUrl("data:text/html,<p>bad</p>").ok, false);
  assert.equal(validateNavigableUrl("file:///tmp/test.html").ok, false);
});

test("url policy detects extension internal URLs", () => {
  assert.equal(isExtensionInternalUrl("chrome-extension://abc/popup.html"), true);
  assert.equal(isExtensionInternalUrl("crx://abc/index.html"), true);
  assert.equal(isExtensionInternalUrl("https://example.com"), false);
  assert.equal(isExtensionInternalUrl("not a url"), false);
});
