const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CHROME_EXTENSION_LICENSE_ENV,
  CHROME_EXTENSION_LICENSES,
  resolveChromeExtensionLicense,
} = require("../../core/extensions/chromeExtensionLicense");

test("resolveChromeExtensionLicense returns null when unset", () => {
  assert.equal(resolveChromeExtensionLicense({}), null);
});

test("resolveChromeExtensionLicense accepts valid package license values", () => {
  assert.equal(
    resolveChromeExtensionLicense({
      [CHROME_EXTENSION_LICENSE_ENV]: ` ${CHROME_EXTENSION_LICENSES.GPL_3} `,
    }),
    CHROME_EXTENSION_LICENSES.GPL_3,
  );
  assert.equal(
    resolveChromeExtensionLicense({
      [CHROME_EXTENSION_LICENSE_ENV]: CHROME_EXTENSION_LICENSES.PATRON,
    }),
    CHROME_EXTENSION_LICENSES.PATRON,
  );
});

test("resolveChromeExtensionLicense rejects invalid license values", () => {
  assert.equal(
    resolveChromeExtensionLicense({
      [CHROME_EXTENSION_LICENSE_ENV]: "MIT",
    }),
    null,
  );
});
