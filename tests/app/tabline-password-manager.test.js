const test = require("node:test");
const assert = require("node:assert/strict");

const { renderTabline } = require("../../ui/tabline");

function renderWithPasswordManagerStatus(status) {
  const calls = [];
  const webContents = {
    isDestroyed: () => false,
    executeJavaScript(script) {
      calls.push(script);
    },
  };

  renderTabline(
    webContents,
    [],
    { platform: "linux", useNativeControls: false },
    { passwordManager: { icon: "key", status } },
  );

  assert.equal(calls.length, 1);
  return calls[0];
}

test("password manager button is hidden for provider none", () => {
  const script = renderWithPasswordManagerStatus({
    provider: "none",
    state: "disabled",
    enabled: false,
    canOpen: false,
  });

  assert.equal(
    script.includes('data-tabline-action=\\"open-password-manager\\"'),
    false,
  );
});

test("password manager button is disabled while loading", () => {
  const script = renderWithPasswordManagerStatus({
    provider: "bitwarden",
    label: "Bitwarden",
    state: "loading",
    enabled: true,
    canOpen: false,
  });

  assert.equal(
    script.includes('data-tabline-action=\\"open-password-manager\\"'),
    true,
  );
  assert.equal(script.includes("Loading Bitwarden"), true);
  assert.equal(script.includes(" disabled"), true);
});

test("password manager button is disabled while installing", () => {
  const script = renderWithPasswordManagerStatus({
    provider: "bitwarden",
    label: "Bitwarden",
    state: "installing",
    enabled: true,
    canOpen: false,
  });

  assert.equal(
    script.includes('data-tabline-action=\\"open-password-manager\\"'),
    true,
  );
  assert.equal(script.includes("Installing Bitwarden"), true);
  assert.equal(script.includes(" disabled"), true);
});

test("password manager button click dispatches tabline bridge action", () => {
  const script = renderWithPasswordManagerStatus({
    provider: "bitwarden",
    label: "Bitwarden",
    state: "loaded",
    enabled: true,
    canOpen: true,
  });

  assert.equal(
    script.includes("window.uiShell.tablineAction('open-password-manager')"),
    true,
  );
});

test("password manager button is enabled when loaded", () => {
  const script = renderWithPasswordManagerStatus({
    provider: "bitwarden",
    label: "Bitwarden",
    state: "loaded",
    enabled: true,
    canOpen: true,
  });

  assert.equal(
    script.includes('data-tabline-action=\\"open-password-manager\\"'),
    true,
  );
  assert.equal(script.includes("Open Bitwarden"), true);
  assert.equal(script.includes(" disabled"), false);
});

test("password manager failed state uses message title", () => {
  const script = renderWithPasswordManagerStatus({
    provider: "bitwarden",
    label: "Bitwarden",
    state: "failed",
    enabled: true,
    canOpen: false,
    message: "Extension failed to initialize.",
  });

  assert.equal(script.includes("Extension failed to initialize."), true);
  assert.equal(script.includes(" disabled"), true);
});
