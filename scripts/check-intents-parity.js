const fs = require("fs");
const path = require("path");
const { INTENTS } = require("../core/intents");

function readIntentDocNames(markdown) {
  const matches = markdown.matchAll(/-\s+`([A-Z0-9_]+)`:/g);
  const names = new Set();

  for (const match of matches) {
    names.add(match[1]);
  }

  return names;
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function diff(expected, actual) {
  const missing = new Set();
  const extra = new Set();

  for (const value of expected) {
    if (!actual.has(value)) {
      missing.add(value);
    }
  }

  for (const value of actual) {
    if (!expected.has(value)) {
      extra.add(value);
    }
  }

  return { missing, extra };
}

function main() {
  const docPath = path.join(__dirname, "..", "INTENTS.md");
  const markdown = fs.readFileSync(docPath, "utf8");
  const docIntents = readIntentDocNames(markdown);
  const codeIntents = new Set(Object.values(INTENTS));
  const result = diff(codeIntents, docIntents);

  if (result.missing.size === 0 && result.extra.size === 0) {
    console.log("INTENTS.md parity check passed.");
    return;
  }

  console.error("INTENTS.md parity check failed.");
  if (result.missing.size > 0) {
    console.error("Missing from INTENTS.md:", sorted(result.missing).join(", "));
  }
  if (result.extra.size > 0) {
    console.error("Extra in INTENTS.md:", sorted(result.extra).join(", "));
  }
  process.exit(1);
}

main();
