function shouldFailFastForCriticalInvariant() {
  if (process.env.NOCTRA_INVARIANTS === "strict") {
    return true;
  }

  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return process.env.CI === "true";
}

function formatInvariantDetails(context = {}) {
  return Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
}

function enforceInvariant(condition, message, context = {}, options = {}) {
  if (condition) {
    return;
  }

  const severity = options.severity === "advisory" ? "advisory" : "critical";
  const details = formatInvariantDetails(context);
  const fullMessage = `[invariant:${severity}] ${message}${details}`;

  if (severity === "critical" && shouldFailFastForCriticalInvariant()) {
    throw new Error(fullMessage);
  }

  console.warn(fullMessage);
}

function warnInvariant(condition, message, context = {}) {
  enforceInvariant(condition, message, context, { severity: "advisory" });
}

function assertInputPipelinePreconditions({ input, priority, focusSnapshot }) {
  enforceInvariant(Boolean(input && input.type === "keyDown"), "input must be normalized keyDown", {
    type: input && input.type,
  });

  enforceInvariant(Boolean(priority && typeof priority === "object"), "priority resolver output missing");

  enforceInvariant(
    Boolean(focusSnapshot && typeof focusSnapshot === "object"),
    "focus snapshot missing for priority resolution",
  );
}

function assertModeWriteBoundary({ mode, state, source }) {
  enforceInvariant(
    mode === state.mode,
    "mode desync after transition",
    {
      expected: mode,
      actual: state.mode,
      source,
    },
    { severity: "advisory" },
  );
}

function assertIntentShape(intent) {
  enforceInvariant(Boolean(intent && typeof intent.type === "string"), "intent must include string type", {
    intentType: intent && intent.type,
  });
}

module.exports = {
  enforceInvariant,
  shouldFailFastForCriticalInvariant,
  warnInvariant,
  assertInputPipelinePreconditions,
  assertModeWriteBoundary,
  assertIntentShape,
};
