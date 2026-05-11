const { runSmoke } = require("../../helpers/smoke");

runSmoke({ scenario: "overlay-panel-split", timeoutMs: 20000 }).catch(
  (error) => {
    console.error(error.message);
    process.exit(1);
  },
);
