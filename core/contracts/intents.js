const { INTENTS } = require("../intents");
const {
  isPlainObject,
  validateString,
  validateBoolean,
  validateFiniteNumber,
  validateInteger,
  createEnumValidator,
  createStrictObjectValidator,
  optional,
  nullable,
} = require("./validation");

const validateScrollDirection = createEnumValidator([
  "up",
  "down",
  "left",
  "right",
]);
const validateThemeMode = createEnumValidator([
  "dark",
  "light",
  "auto",
  "custom",
]);
const validateLanguage = createEnumValidator(["system", "en", "fr"]);

function validateIntentNext(value) {
  if (!isPlainObject(value)) {
    return { ok: false, message: "expected object" };
  }
  if (typeof value.type !== "string") {
    return { ok: false, message: "expected object with string type" };
  }
  return { ok: true };
}

const BASE_INTENT_FIELDS = {
  type: validateString,
  next: optional(nullable(validateIntentNext)),
};

function withBaseFields(fields = {}) {
  return createStrictObjectValidator({
    ...BASE_INTENT_FIELDS,
    ...fields,
  });
}

const INTENT_PAYLOAD_CONTRACTS = {
  [INTENTS.SCROLL]: withBaseFields({
    direction: validateScrollDirection,
    amount: validateFiniteNumber,
  }),
  [INTENTS.NAV_BACK]: withBaseFields({
    bufferId: optional(validateInteger),
  }),
  [INTENTS.NAV_FORWARD]: withBaseFields({
    bufferId: optional(validateInteger),
  }),
  [INTENTS.RELOAD_PAGE]: withBaseFields({
    bufferId: optional(validateInteger),
  }),
  [INTENTS.OPEN_URL]: withBaseFields({
    url: validateString,
  }),
  [INTENTS.SEARCH_WEB]: withBaseFields({
    engine: validateString,
    query: validateString,
  }),
  [INTENTS.NEW_BUFFER]: withBaseFields({
    url: optional(validateString),
  }),
  [INTENTS.SWITCH_BUFFER]: withBaseFields({
    id: validateInteger,
  }),
  [INTENTS.CLOSE_BUFFER]: withBaseFields({
    id: optional(nullable(validateInteger)),
  }),
  [INTENTS.BOOKMARKS_ADD_ROOT_ACTIVE]: withBaseFields({
    url: optional(validateString),
    title: optional(validateString),
  }),
  [INTENTS.BOOKMARKS_ADD_SCOPED_PROMPT]: withBaseFields({
    url: optional(validateString),
    title: optional(validateString),
  }),
  [INTENTS.SET_URLLINE_VISIBILITY]: withBaseFields({
    enabled: validateBoolean,
  }),
  [INTENTS.SET_THEME_MODE]: withBaseFields({
    mode: validateThemeMode,
  }),
  [INTENTS.SET_BROWSER_LANGUAGE]: withBaseFields({
    language: validateLanguage,
    reload: optional(validateBoolean),
  }),
  [INTENTS.TOGGLE_COPY_SELECTION_TO_CLIPBOARD]: withBaseFields({
    enabled: optional(validateBoolean),
  }),
  [INTENTS.SHOW_WHICHKEY]: withBaseFields({
    model: optional(nullable(() => ({ ok: true }))),
    timeoutMs: optional(nullable(validateFiniteNumber)),
    delayMs: optional(nullable(validateFiniteNumber)),
  }),
  [INTENTS.UPDATE_WHICHKEY]: withBaseFields({
    model: optional(nullable(() => ({ ok: true }))),
    timeoutMs: optional(nullable(validateFiniteNumber)),
    delayMs: optional(nullable(validateFiniteNumber)),
  }),
  [INTENTS.SUBMIT_EDITOR_COMMAND]: withBaseFields({
    command: validateString,
  }),
  [INTENTS.UNKNOWN_COMMAND]: withBaseFields({
    raw: validateString,
  }),
};

for (const intentType of Object.values(INTENTS)) {
  if (!INTENT_PAYLOAD_CONTRACTS[intentType]) {
    INTENT_PAYLOAD_CONTRACTS[intentType] = withBaseFields();
  }
}

function validateIntentPayload(intentType, intentPayload) {
  const validator = INTENT_PAYLOAD_CONTRACTS[intentType];
  if (!validator) {
    return {
      ok: false,
      message: "missing intent validator",
      details: { intentType },
    };
  }
  return validator(intentPayload);
}

module.exports = {
  INTENT_PAYLOAD_CONTRACTS,
  validateIntentPayload,
};
