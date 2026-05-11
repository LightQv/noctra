const test = require("node:test");
const assert = require("node:assert/strict");

const { isExactVersion, findDynamicVersions } = require("../../scripts/check-dependency-versions");

test("exact version matcher accepts pinned versions", () => {
  assert.equal(isExactVersion("1.2.3"), true);
  assert.equal(isExactVersion("1.2.3-beta.1"), true);
  assert.equal(isExactVersion("1.2.3+build.7"), true);
});

test("exact version matcher rejects dynamic version specifiers", () => {
  assert.equal(isExactVersion("^1.2.3"), false);
  assert.equal(isExactVersion("~1.2.3"), false);
  assert.equal(isExactVersion(">=1.2.3"), false);
  assert.equal(isExactVersion("latest"), false);
  assert.equal(isExactVersion("*"), false);
});

test("dynamic dependency finder reports all non-pinned dependencies", () => {
  const pkg = {
    dependencies: {
      stable: "1.0.0",
      dynamicA: "^2.0.0",
    },
    devDependencies: {
      stableDev: "3.1.4",
      dynamicB: "latest",
    },
  };

  const problems = findDynamicVersions(pkg);
  assert.deepEqual(problems, [
    { section: "dependencies", name: "dynamicA", version: "^2.0.0" },
    { section: "devDependencies", name: "dynamicB", version: "latest" },
  ]);
});
