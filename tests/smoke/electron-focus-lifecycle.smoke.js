const { runSmoke } = require("../helpers/smoke");

runSmoke({ scenario: "focus-lifecycle", timeoutMs: 30000 }).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
