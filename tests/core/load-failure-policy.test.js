const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeChromiumErrorName,
  shouldShowCatErrorBuffer,
} = require("../../core/navigation/loadFailurePolicy");

test("normalizeChromiumErrorName strips net prefix", () => {
  assert.equal(
    normalizeChromiumErrorName("net::ERR_INTERNET_DISCONNECTED"),
    "ERR_INTERNET_DISCONNECTED",
  );
});

test("cat error buffer shows on network failures", () => {
  assert.equal(
    shouldShowCatErrorBuffer({
      errorCode: -106,
      errorDescription: "net::ERR_INTERNET_DISCONNECTED",
      isMainFrame: true,
    }),
    true,
  );
});

test("cat error buffer shows on tls and cert failures", () => {
  assert.equal(
    shouldShowCatErrorBuffer({
      errorCode: -202,
      errorDescription: "net::ERR_CERT_AUTHORITY_INVALID",
      isMainFrame: true,
    }),
    true,
  );
  assert.equal(
    shouldShowCatErrorBuffer({
      errorCode: -107,
      errorDescription: "net::ERR_SSL_PROTOCOL_ERROR",
      isMainFrame: true,
    }),
    true,
  );
});

test("cat error buffer does not show on aborted or subframe failures", () => {
  assert.equal(
    shouldShowCatErrorBuffer({
      errorCode: -3,
      errorDescription: "net::ERR_ABORTED",
      isMainFrame: true,
    }),
    false,
  );
  assert.equal(
    shouldShowCatErrorBuffer({
      errorCode: -106,
      errorDescription: "net::ERR_INTERNET_DISCONNECTED",
      isMainFrame: false,
    }),
    false,
  );
});
