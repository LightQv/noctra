const { defaultConfig } = require("../core/config/defaults");

function isValidDownloadPolicy(value) {
  return value === "deny" || value === "prompt" || value === "allow";
}

function runSecurityBaselineChecks(config = defaultConfig) {
  const errors = [];
  const browser =
    config && typeof config === "object" ? config.browser : undefined;

  if (!browser || typeof browser !== "object") {
    errors.push("Missing browser config section in defaults.");
    return errors;
  }

  if (browser.allow_http_loopback !== true) {
    errors.push("browser.allow_http_loopback must default to true.");
  }

  if (browser.allow_http_private_lan !== true) {
    errors.push("browser.allow_http_private_lan must default to true.");
  }

  if (!Array.isArray(browser.trusted_http_hosts)) {
    errors.push("browser.trusted_http_hosts must be an array.");
  }

  if (
    Array.isArray(browser.trusted_http_hosts) &&
    browser.trusted_http_hosts.length !== 0
  ) {
    errors.push("browser.trusted_http_hosts must default to an empty array.");
  }

  const downloads = browser.downloads;
  if (!downloads || typeof downloads !== "object") {
    errors.push("browser.downloads config section is required.");
    return errors;
  }

  if (!isValidDownloadPolicy(downloads.policy)) {
    errors.push(
      "browser.downloads.policy must be one of: deny, prompt, allow.",
    );
  }

  if (downloads.policy !== "prompt") {
    errors.push("browser.downloads.policy must default to prompt.");
  }

  if (downloads.allow_trusted_surfaces !== false) {
    errors.push(
      "browser.downloads.allow_trusted_surfaces must default to false.",
    );
  }

  if (
    !(
      downloads.default_directory === null ||
      typeof downloads.default_directory === "string"
    )
  ) {
    errors.push("browser.downloads.default_directory must be null or string.");
  }

  if (downloads.default_directory !== null) {
    errors.push("browser.downloads.default_directory must default to null.");
  }

  if (downloads.auto_open !== false) {
    errors.push("browser.downloads.auto_open must default to false.");
  }

  return errors;
}

function main() {
  const errors = runSecurityBaselineChecks(defaultConfig);

  if (errors.length === 0) {
    console.log("Security baseline check passed.");
    return;
  }

  console.error("Security baseline check failed.");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  runSecurityBaselineChecks,
};
