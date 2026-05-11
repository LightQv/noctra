function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateString(value) {
  if (typeof value !== "string") {
    return { ok: false, message: "expected string" };
  }
  return { ok: true };
}

function validateBoolean(value) {
  if (typeof value !== "boolean") {
    return { ok: false, message: "expected boolean" };
  }
  return { ok: true };
}

function validateFiniteNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, message: "expected finite number" };
  }
  return { ok: true };
}

function validateInteger(value) {
  if (!Number.isInteger(value)) {
    return { ok: false, message: "expected integer" };
  }
  return { ok: true };
}

function createEnumValidator(values) {
  const allowed = new Set(values);
  return (value) => {
    if (!allowed.has(value)) {
      return { ok: false, message: `expected one of: ${values.join(", ")}` };
    }
    return { ok: true };
  };
}

function optional(validator) {
  return (value) => {
    if (value === undefined) {
      return { ok: true };
    }
    return validator(value);
  };
}

function nullable(validator) {
  return (value) => {
    if (value === null) {
      return { ok: true };
    }
    return validator(value);
  };
}

function createStrictObjectValidator(shape = {}) {
  const knownKeys = new Set(Object.keys(shape));
  return (value) => {
    if (!isPlainObject(value)) {
      return {
        ok: false,
        message: "expected object",
        details: { reason: "not_object" },
      };
    }

    const unknownKeys = Object.keys(value).filter((key) => !knownKeys.has(key));
    if (unknownKeys.length > 0) {
      return {
        ok: false,
        message: "unknown keys are not allowed",
        details: { reason: "unknown_keys", unknownKeys },
      };
    }

    for (const [key, validator] of Object.entries(shape)) {
      const result = validator(value[key]);
      if (!result.ok) {
        return {
          ok: false,
          message: `invalid field: ${key} (${result.message})`,
          details: {
            reason: "field_invalid",
            field: key,
            fieldError: result.message,
          },
        };
      }
    }

    return { ok: true };
  };
}

module.exports = {
  isPlainObject,
  validateString,
  validateBoolean,
  validateFiniteNumber,
  validateInteger,
  createEnumValidator,
  createStrictObjectValidator,
  optional,
  nullable,
};
