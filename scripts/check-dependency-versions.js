const fs = require("node:fs");
const path = require("node:path");

const EXACT_VERSION_REGEX =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

function isExactVersion(value) {
  return typeof value === "string" && EXACT_VERSION_REGEX.test(value.trim());
}

function findDynamicVersions(pkg) {
  const problems = [];
  const sections = ["dependencies", "devDependencies"];

  for (const section of sections) {
    const deps = pkg[section];
    if (!deps || typeof deps !== "object") {
      continue;
    }

    for (const [name, version] of Object.entries(deps)) {
      if (!isExactVersion(version)) {
        problems.push({ section, name, version });
      }
    }
  }

  return problems.sort((a, b) =>
    `${a.section}:${a.name}`.localeCompare(`${b.section}:${b.name}`),
  );
}

function main() {
  const packagePath = path.join(__dirname, "..", "package.json");
  const raw = fs.readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(raw);
  const problems = findDynamicVersions(pkg);

  if (problems.length === 0) {
    console.log("Dependency version lock check passed.");
    return;
  }

  console.error("Dependency version lock check failed.");
  for (const item of problems) {
    console.error(`- ${item.section}.${item.name}: ${item.version}`);
  }
  console.error("Use exact pinned versions only (for example: 1.2.3).");
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  isExactVersion,
  findDynamicVersions,
};
