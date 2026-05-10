const {
  validateString,
  validateInteger,
  createEnumValidator,
  createStrictObjectValidator,
  optional,
} = require("./validation");

const validateWindowAction = createEnumValidator(["minimize", "maximize", "close"]);
const validatePane = createEnumValidator(["left", "right"]);
const validateUrllineAction = createEnumValidator(["back", "forward", "reload"]);
const validateEditorMode = createEnumValidator(["NORMAL", "INSERT"]);

const validateEmptyObject = createStrictObjectValidator({});

function optionalEmptyObject(value) {
  if (value === undefined) {
    return { ok: true };
  }
  return validateEmptyObject(value);
}

const IPC_CONTRACTS = {
  "ui-shell:window-action": {
    kind: "event",
    validator: createStrictObjectValidator({ action: validateWindowAction }),
  },
  "ui-shell:open-settings": { kind: "event", validator: optionalEmptyObject },
  "ui-shell:new-tab": { kind: "event", validator: optionalEmptyObject },
  "ui-shell:open-history": { kind: "event", validator: optionalEmptyObject },
  "ui-shell:tab-activate": {
    kind: "event",
    validator: createStrictObjectValidator({ id: validateInteger }),
  },
  "ui-shell:tab-close": {
    kind: "event",
    validator: createStrictObjectValidator({ id: validateInteger }),
  },
  "ui-shell:urlline-start-edit": {
    kind: "event",
    validator: createStrictObjectValidator({ pane: optional(validatePane) }),
  },
  "ui-shell:urlline-action": {
    kind: "event",
    validator: createStrictObjectValidator({
      pane: optional(validatePane),
      action: validateUrllineAction,
    }),
  },
  "settings:editor-toggle-context": { kind: "event", validator: optionalEmptyObject },
  "settings:editor-mode-change": {
    kind: "event",
    validator: createStrictObjectValidator({ mode: validateEditorMode }),
  },
  "settings:editor-focus-request": { kind: "event", validator: optionalEmptyObject },
  "settings:editor-open-command": {
    kind: "event",
    validator: createStrictObjectValidator({ initialText: optional(validateString) }),
  },
  "settings:editor-ready": { kind: "event", validator: optionalEmptyObject },
  "settings:get": { kind: "invoke", validator: optionalEmptyObject },
  "settings:save": {
    kind: "invoke",
    validator: createStrictObjectValidator({ content: validateString }),
  },
  "settings:close": { kind: "invoke", validator: optionalEmptyObject },
  "security:probe-privileged-ipc": { kind: "invoke", validator: optionalEmptyObject },
};

function validateIpcPayload(channel, payload) {
  const contract = IPC_CONTRACTS[channel];
  if (!contract || typeof contract.validator !== "function") {
    return { ok: false, message: "missing ipc validator", details: { channel } };
  }
  return contract.validator(payload);
}

module.exports = {
  IPC_CONTRACTS,
  validateIpcPayload,
};
