const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "assets/**",
      "*.png",
      "package-lock.json",
      "OSS_READINESS_STABILIZATION_PLAN.md",
      "senior-feedback-working-diff.md",
      "modal_browser_architecture_v_2.md",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-redeclare": "off",
      "no-useless-escape": "warn",
      "no-regex-spaces": "warn",
      "no-empty": "warn",
      "no-console": "off",
    },
  },
];
