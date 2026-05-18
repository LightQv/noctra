# Native Context Menu Implementation Plan (Consolidated)

## Objective

Implement native right-click context menus that feel browser-standard while preserving Noctra architecture and product constraints:

- intent-driven actions
- strict process boundaries
- split/buffer-first model
- security policy consistency

## Global Rules (Locked)

- Video: no context menu.
- Noctra UI elements: no context menu for now, except URL-line input.
- History/Bookmarks entries: link-style context menu only.
- Open in new window: present but disabled until multi-window support.
- URL-line input menu: no DevTools item.

## Context Types and Menus

## 1) Input (web page editable fields)

Applies to page inputs/textareas/contenteditable (not URL-line special case).

Actions:

- Cut
- Copy
- Paste
- Delete
- Select all
- DevTools (inspect targeted element)

Implementation note:

- Use native roles (`cut`, `copy`, `paste`, `delete`, `selectAll`) where possible.

## 2) URL-line Input (special input context)

Applies only to URL-line editing surface.

Actions:

- Cut
- Copy
- Paste
- Delete
- Select all

Explicitly excluded:

- DevTools

## 3) Text Selection

Actions:

- Copy
- Search "<selection>" with configured default engine
- DevTools (inspect targeted element)

## 4) Link

Actions:

- Open Link in New Tab
- Open Link in Split
- Open Link in New Window (disabled)
- Copy Link Address
- Search "<selection-or-fallback>" with configured default engine
- DevTools (inspect targeted element)

## 5) Image (direct image interaction)

Image-specific actions (always available for image context):

- Open Image in New Tab
- Save Image As...
- Copy Image
- Copy Image Address
- Send Image by Email...

Then DevTools targeted inspect.

## 6) Linked Image (locked ordering)

When right-clicking an image inside a link, show combined menu with this exact layout:

1. Open Link in New Tab
2. Open Link in Split
3. Open Link in New Window (disabled)
4. Copy Link Address
5. Search "<text>" with <engine>
6. separator
7. Open Image in New Tab
8. Save Image As...
9. Copy Image
10. Copy Image Address
11. Send Image by Email...
12. separator
13. DevTools / Inspect targeted element

Constraint from product decision:

- Image block must appear immediately before DevTools line.

## 7) Everything Else (page background / generic area)

Actions:

- Previous page
- Next page
- Refresh
- Bookmarks...
- Save as...
- DevTools (open normally, non-targeted)

## Detection and Precedence

Use deterministic precedence to avoid ambiguity:

1. blocked-video
2. blocked-noctra-ui (except URL-line input)
3. urlline-input
4. linked-image
5. image
6. link
7. text-selection
8. editable-input
9. default-page

## Architecture and Modules

## Main-process ownership

Main process owns:

- context-menu event handling
- menu template composition
- privileged actions (save dialogs, filesystem-facing actions, devtools open/inspect)

Renderer/shell owns:

- only URL-line context trigger payload (typed, trusted IPC), no direct Electron menu APIs.

## Proposed modules

- `core/adapters/platform/contextMenuBuilder.js`
  - Builds menu templates from normalized context descriptor and runtime capability snapshot.
- `core/adapters/platform/contextMenuActions.js`
  - Executes actions by dispatching intents or invoking platform adapters.
- `runtime/contextMenuRegistration.js` (or platform adapter equivalent)
  - Registers `webContents.on("context-menu")` and cleans up listeners.

## Action Wiring

- Navigation (Previous, Next, Refresh) -> existing intents:
  - `INTENTS.NAV_BACK`
  - `INTENTS.NAV_FORWARD`
  - `INTENTS.RELOAD_PAGE`
- Open link/image in new tab -> `INTENTS.NEW_BUFFER` with validated URL.
- Open in split -> split controller/buffer manager flow, validated URL.
- Bookmarks... -> `INTENTS.BOOKMARKS_SHOW` (or agreed panel-open equivalent).
- Search action -> `buildSearchUrl(defaultEngine, query)` then open URL intent.
- DevTools targeted -> `inspectElement(x, y)` then open devtools.
- DevTools generic -> open devtools without element targeting.
- Save as... (page) -> `showSaveDialog` + `webContents.savePage(..., "HTMLComplete")`.
- Save Image As... -> download/save flow for `srcURL` with policy checks.
- Copy Link/Image Address -> clipboard text.
- Copy Image -> `webContents.copyImageAt(x, y)` fallback strategy if unsupported.
- Send Image by Email... -> open `mailto:` with image URL in body.

## Security and Policy Requirements

- Preserve existing `setWindowOpenHandler` deny-by-default behavior.
- Validate all navigable URLs via existing URL policy before opening.
- Restrict URL-line context menu IPC to trusted shell role.
- Reject malformed/oversized context payloads (typed validation).
- Keep privileged operations in main only (no renderer shortcut).

## Implementation Phases

1. Core context-menu infrastructure
   - Add registration and lifecycle cleanup.
   - Build base descriptor and default/menu branching.
2. Link/image/default action execution
   - Implement all actions except URL-line special IPC path.
3. URL-line context integration
   - Add trusted shell event bridge and URL-line edit menu behavior.
4. Policy hardening
   - Explicit blocks for video and Noctra UI contexts.
5. Tests + smoke validation
   - Add app/security/smoke tests for all branches and ordering rules.

## Test Plan

## App tests

- Template composition per context type:
  - editable input
  - url-line input
  - selection
  - link
  - image
  - linked-image
  - default page
- Assert linked-image exact order with image block before DevTools.
- Assert new-window item present + disabled.

## Security tests

- URL validation enforced for open/search actions.
- Trusted-shell-only access for URL-line context channel.
- Video context suppression.
- Noctra UI context suppression (except URL-line input).

## Smoke tests

- Right-click on page text selection -> Search opens correct engine URL.
- Right-click link -> new tab and split actions work.
- Right-click image -> image block actions present and functioning.
- Right-click linked image -> exact ordered combined menu.
- Right-click video -> no menu.
- Right-click URL-line input -> edit actions only, no DevTools.

## Acceptance Criteria

- Native context menu appears with correct items per context.
- Linked-image menu ordering matches locked rule (image block right before DevTools).
- Video and non-URL-line Noctra UI contexts do not open menus.
- URL-line input has edit actions only.
- All actions align with browser expectations and Noctra security/architecture.
- Tests cover behavior, ordering, and policy boundaries.
