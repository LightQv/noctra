function isBookmarkableBuffer(buffer) {
  if (!buffer || buffer.isEditable || buffer.kind === "extension") {
    return false;
  }

  const url = typeof buffer.url === "string" ? buffer.url.trim() : "";
  if (!url || url === "about:blank") {
    return false;
  }

  if (url.startsWith("noctra://dashboard")) {
    return false;
  }

  return true;
}

module.exports = {
  isBookmarkableBuffer,
};
