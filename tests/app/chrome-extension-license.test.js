const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CHROME_EXTENSION_DISTRIBUTION_LICENSE,
  CHROME_EXTENSION_LICENSES,
  resolveChromeExtensionLicense,
} = require("../../core/extensions/chromeExtensionLicense");

test("resolveChromeExtensionLicense returns the GPL distribution license", () => {
  assert.equal(CHROME_EXTENSION_DISTRIBUTION_LICENSE, CHROME_EXTENSION_LICENSES.GPL_3);
  assert.equal(resolveChromeExtensionLicense(), CHROME_EXTENSION_LICENSES.GPL_3);
});
