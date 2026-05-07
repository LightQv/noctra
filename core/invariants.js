function warnInvariant(condition, message, context = {}) {
  if (condition) {
    return;
  }

  const details = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
  console.warn(`[invariant] ${message}${details}`);
}

function assertInputPipelinePreconditions({ input, priority, focusSnapshot }) {
  warnInvariant(Boolean(input && input.type === "keyDown"), "input must be normalized keyDown", {
    type: input && input.type,
  });

  warnInvariant(Boolean(priority && typeof priority === "object"), "priority resolver output missing");

  warnInvariant(
    Boolean(focusSnapshot && typeof focusSnapshot === "object"),
    "focus snapshot missing for priority resolution",
  );
}

function assertModeWriteBoundary({ mode, state, source }) {
  warnInvariant(
    mode === state.mode,
    "mode desync after transition",
    {
      expected: mode,
      actual: state.mode,
      source,
    },
  );
}

function assertIntentShape(intent) {
  warnInvariant(Boolean(intent && typeof intent.type === "string"), "intent must include string type", {
    intentType: intent && intent.type,
  });
}

module.exports = {
  warnInvariant,
  assertInputPipelinePreconditions,
  assertModeWriteBoundary,
  assertIntentShape,
};
