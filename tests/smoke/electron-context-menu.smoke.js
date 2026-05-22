const { runSmoke } = require("../helpers/smoke");

runSmoke({ scenario: "context-menu", timeoutMs: 15000 }).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
