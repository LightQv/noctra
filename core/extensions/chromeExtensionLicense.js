const CHROME_EXTENSION_LICENSE_ENV = "NOCTRA_CHROME_EXTENSIONS_LICENSE";

const CHROME_EXTENSION_LICENSES = Object.freeze({
  GPL_3: "GPL-3.0",
  PATRON: "Patron-License-2020-11-19",
});

const VALID_CHROME_EXTENSION_LICENSES = new Set(
  Object.values(CHROME_EXTENSION_LICENSES),
);

function resolveChromeExtensionLicense(env = process.env) {
  const rawLicense = env ? env[CHROME_EXTENSION_LICENSE_ENV] : undefined;
  const license = typeof rawLicense === "string" ? rawLicense.trim() : "";

  if (!license || !VALID_CHROME_EXTENSION_LICENSES.has(license)) {
    return null;
  }

  return license;
}

module.exports = {
  CHROME_EXTENSION_LICENSE_ENV,
  CHROME_EXTENSION_LICENSES,
  resolveChromeExtensionLicense,
};
