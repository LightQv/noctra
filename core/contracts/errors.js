function createContractError({ code, boundary, subject, message, details = {} }) {
  return {
    code,
    boundary,
    subject,
    message,
    details,
  };
}

function createInvalidPayloadError(boundary, subject, details = {}) {
  return createContractError({
    code: "contract_invalid_payload",
    boundary,
    subject,
    message: "Contract validation failed for payload",
    details,
  });
}

function createUnknownIntentError(subject, details = {}) {
  return createContractError({
    code: "contract_unknown_intent",
    boundary: "dispatcher",
    subject,
    message: `Unknown intent type: ${String(subject || "")}`,
    details,
  });
}

function createUnauthorizedSenderError(boundary, subject, details = {}) {
  return createContractError({
    code: "contract_unauthorized_sender",
    boundary,
    subject,
    message: "Sender is not authorized for this channel",
    details,
  });
}

module.exports = {
  createContractError,
  createInvalidPayloadError,
  createUnknownIntentError,
  createUnauthorizedSenderError,
};
