const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/run-tests.js <directory>');
  process.exit(1);
}

function findTests(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTests(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.test.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const tests = findTests(target);
if (tests.length === 0) {
  console.error(`No test files found in ${target}`);
  process.exit(1);
}

const child = spawn('node', ['--test', ...tests], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
