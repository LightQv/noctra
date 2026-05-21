function truncateSelection(text, maxLen = 24) {
  const s = String(text || "").trim();
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

function buildWebContextMenuTemplate({ params, runtimeSnapshot, actions }) {
  const {
    canGoBack,
    canGoForward,
    defaultSearchEngine,
    isSplitEnabled,
    isRightPane,
    isBookmarkable,
  } = runtimeSnapshot;

  if (params.mediaType === "video" && params.hasVideoContents) {
    return [];
  }

  const items = [];

  if (params.isEditable) {
    items.push(
      { label: "Cut", click: () => actions.cut() },
      { label: "Copy", click: () => actions.copy() },
      { label: "Paste", click: () => actions.paste() },
      { label: "Delete", click: () => actions.deleteItem() },
      { type: "separator" },
      { label: "Select All", click: () => actions.selectAll() },
      { type: "separator" },
      {
        label: "Inspect Element",
        click: () => actions.inspectElement(params.x, params.y),
      },
    );
    return items;
  }

  if (params.linkURL && params.hasImageContents) {
    const linkText = params.linkText || params.selectionText || "";
    items.push(
      {
        label: "Open Link in New Tab",
        click: () => actions.openLinkInNewTab(params.linkURL),
      },
      {
        label: "Open Link in Split",
        click: () => actions.openLinkInSplit(params.linkURL),
      },
      { label: "Open Link in New Window", enabled: false, click: () => {} },
      { type: "separator" },
      {
        label: "Copy Link Address",
        click: () => actions.copyLinkAddress(params.linkURL),
      },
      { type: "separator" },
    );
    if (linkText) {
      items.push({
        label: `Search "${truncateSelection(linkText)}" in ${defaultSearchEngine}`,
        click: () => actions.searchSelection(linkText),
      });
      items.push({ type: "separator" });
    }
    items.push(
      {
        label: "Open Image in New Tab",
        click: () => actions.openImageInNewTab(params.srcURL),
      },
      {
        label: "Save Image As...",
        click: () => actions.saveImageAs(params.srcURL),
      },
      {
        label: "Copy Image",
        click: () => actions.copyImage(params.x, params.y),
      },
      {
        label: "Copy Image Address",
        click: () => actions.copyImageAddress(params.srcURL),
      },
      {
        label: "Send by Email",
        click: () => actions.sendByEmail(params.srcURL),
      },
      { type: "separator" },
      {
        label: "Inspect Element",
        click: () => actions.inspectElement(params.x, params.y),
      },
    );
    return items;
  }

  if (params.hasImageContents) {
    items.push(
      {
        label: "Open Image in New Tab",
        click: () => actions.openImageInNewTab(params.srcURL),
      },
      {
        label: "Save Image As...",
        click: () => actions.saveImageAs(params.srcURL),
      },
      {
        label: "Copy Image",
        click: () => actions.copyImage(params.x, params.y),
      },
      {
        label: "Copy Image Address",
        click: () => actions.copyImageAddress(params.srcURL),
      },
      {
        label: "Send by Email",
        click: () => actions.sendByEmail(params.srcURL),
      },
      { type: "separator" },
      {
        label: "Inspect Element",
        click: () => actions.inspectElement(params.x, params.y),
      },
    );
    return items;
  }

  if (params.linkURL) {
    const linkText = params.linkText || params.selectionText || "";
    items.push(
      {
        label: "Open Link in New Tab",
        click: () => actions.openLinkInNewTab(params.linkURL),
      },
      {
        label: "Open Link in Split",
        click: () => actions.openLinkInSplit(params.linkURL),
      },
      { label: "Open Link in New Window", enabled: false, click: () => {} },
      { type: "separator" },
      {
        label: "Copy Link Address",
        click: () => actions.copyLinkAddress(params.linkURL),
      },
      { type: "separator" },
    );
    if (linkText) {
      items.push({
        label: `Search "${truncateSelection(linkText)}" in ${defaultSearchEngine}`,
        click: () => actions.searchSelection(linkText),
      });
      items.push({ type: "separator" });
    }
    items.push({
      label: "Inspect Element",
      click: () => actions.inspectElement(params.x, params.y),
    });
    return items;
  }

  if (params.selectionText && params.selectionText.length > 0) {
    items.push(
      { label: "Copy", click: () => actions.copy() },
      { type: "separator" },
      {
        label: `Search "${truncateSelection(params.selectionText)}" in ${defaultSearchEngine}`,
        click: () => actions.searchSelection(params.selectionText),
      },
      { type: "separator" },
      {
        label: "Inspect Element",
        click: () => actions.inspectElement(params.x, params.y),
      },
    );
    return items;
  }

  if (isRightPane) {
    items.push({
      label: "Close Split",
      click: () => actions.closeSplit(),
    });
    items.push({ type: "separator" });
  }

  items.push(
    {
      label: "Previous Page",
      enabled: canGoBack,
      click: () => actions.goBack(),
    },
    {
      label: "Next Page",
      enabled: canGoForward,
      click: () => actions.goForward(),
    },
    { label: "Refresh", click: () => actions.reload() },
    { type: "separator" },
    { label: "Bookmark...", enabled: isBookmarkable, click: () => actions.bookmarkPage() },
    { label: "Save As...", click: () => actions.savePageAs() },
    { type: "separator" },
    {
      label: "DevTools",
      enabled: !isSplitEnabled,
      click: () => actions.toggleDevTools(),
    },
  );

  return items;
}

module.exports = {
  buildWebContextMenuTemplate,
};
