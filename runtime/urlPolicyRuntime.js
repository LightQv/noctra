function createUrlPolicyRuntime({ configService, validateNavigableUrl }) {
  function getUrlPolicyConfig() {
    return {
      allowHttpLoopback: configService.getConfigValue("browser.allow_http_loopback", true),
      allowHttpPrivateLan: configService.getConfigValue("browser.allow_http_private_lan", true),
      trustedHttpHosts: configService.getConfigValue("browser.trusted_http_hosts", []),
    };
  }

  function isAllowedNavigationUrl(rawUrl) {
    return validateNavigableUrl(rawUrl, getUrlPolicyConfig()).ok;
  }

  return {
    getUrlPolicyConfig,
    isAllowedNavigationUrl,
  };
}

module.exports = {
  createUrlPolicyRuntime,
};
