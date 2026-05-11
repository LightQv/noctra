const { runSmoke } = require("../../helpers/smoke");

runSmoke({ scenario: "security-boundary", timeoutMs: 25000 }).catch(
  (error) => {
    console.error(error.message);
    process.exit(1);
  },
);
