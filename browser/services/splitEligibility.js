/**
 * Shared split eligibility predicate.
 * Used by dispatcher handlers and context menu builders.
 */
function canBufferBeSplit(buffer) {
  if (!buffer) return false;
  if (buffer.isEditable) return false;

  const isDashboard =
    buffer.virtualUrl === "noctra://dashboard" ||
    buffer.url === "noctra://dashboard";
  if (isDashboard) return true;

  if (
    buffer.virtualDocument &&
    typeof buffer.virtualDocument.html === "string" &&
    buffer.virtualDocument.html.trim()
  ) {
    return false;
  }

  return true;
}

module.exports = {
  canBufferBeSplit,
};
