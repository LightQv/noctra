# Noctra Default Browser & Icon Registration Plan

> **Status:** Draft — ready for implementation  
> **Goal:** Make Noctra eligible as a default browser on all platforms, with adaptive theme icons, without ever prompting or forcing the user.

---

## Philosophy

- **Make it possible** — Noctra appears in the OS default browser list.
- **Make it discoverable** — Users can find the option in the app menu if they want it.
- **Never nag** — No first-run dialogs, no prompts, no auto-setting on install.
- **Respect the OS** — Canonical state lives in the OS, not in Noctra's config.

---

## 1. Adaptive Icon System

### Requirement

Use the user-provided `light_icon.png` and `dark_icon.png` from `assets/icons/`, with dark as the fallback. Generate all platform-specific formats from these sources.

### Platform Behavior

| Platform            | Behavior                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **macOS**           | Install both light and dark variants into the `.icns`. macOS Big Sur+ supports adaptive/app icons that switch based on wallpaper (via `NSRequiresAquaSystemAppearance` or `NSSupportsAutomaticGraphicsSwitching` is not the right mechanism; instead we generate a single ICNS with both variants, and the OS picks based on the current appearance. The dark variant is the primary fallback.) |
| **Linux .deb/.rpm** | Install both `noctra-light.png` and `noctra-dark.png` into `/usr/share/icons/hicolor/512x512/apps/`. The `.desktop` file references `noctra` as the icon name. Theme-aware DEs (GNOME, KDE) pick the appropriate variant if both exist. Dark is the fallback.                                                                                                                                   |
| **Linux AppImage**  | Bundle both icons. The `--integrate` command copies the appropriate variant based on the current GTK theme, with dark as fallback.                                                                                                                                                                                                                                                              |

### Files to Generate

| File                              | Source                                         | Sizes                           |
| --------------------------------- | ---------------------------------------------- | ------------------------------- |
| `assets/icons/icon.icns`          | `dark_icon.png` (primary), embed light variant | 16, 32, 64, 128, 256, 512, 1024 |
| `assets/icons/icon_512.png`       | `dark_icon.png`                                | 512×512                         |
| `assets/icons/icon-light_512.png` | `light_icon.png`                               | 512×512                         |
| `assets/icons/icon-dark_512.png`  | `dark_icon.png`                                | 512×512                         |

### Changes

- **Delete:** old `icon.png`, `icon.svg`, `icon_512.png`, `icon.icns`.
- **Update:** `scripts/generate-icons.js` — rewrite to use the new PNG sources instead of SVG generation.
- **Update:** `forge.config.js` — point `icon`, `icon_512.png`, and `icon.icns` references to the new generated paths.
- **Update:** `.desktop` file generation for Linux — reference icon base name `noctra` so theme-aware DEs can resolve `noctra-dark` or `noctra-light`.

---

## 2. Default Browser Registration (Passive)

### macOS

**Already done:**

- `CFBundleURLTypes` in `Info.plist` via `forge.config.js` `extendInfo`.
- `app.on('open-url')` handler in `main.js` routes clicked links to the existing window.

**To implement:**

- [ ] Add `app.on('second-instance')` handler — if Noctra is already running and a URL is clicked, route it to the existing window instead of spawning a duplicate.
- [ ] Add app menu item: `Noctra → Set as Default Browser`.
- [ ] Menu item action: call `app.setAsDefaultProtocolClient('http')` and `app.setAsDefaultProtocolClient('https')`.
- [ ] Menu item state: **disabled** if `app.isDefaultProtocolClient('http')` already returns `true`.
- [ ] No reverse action — if already default, the menu item is simply disabled.

### Linux .deb / .rpm

**To implement:**

- [ ] Add `MimeType=text/html;x-scheme-handler/http;x-scheme-handler/https;` to the generated `.desktop` file via `maker-deb` and `maker-rpm` Forge config options.
- [ ] Add `afterInstall` script (`.deb` only) that runs `update-desktop-database` — **does NOT change the default browser**.
- [ ] Add `afterRemove` script (`.deb` only) that cleans up the desktop database.
- [ ] Add app menu item: `File → Set as Default Browser`.
- [ ] Menu item action: spawn `xdg-settings set default-web-browser noctra.desktop`.
- [ ] Menu item state: **disabled** if `xdg-settings get default-web-browser` already returns `noctra.desktop`.
- [ ] No reverse action — disabled when already default.

### Linux AppImage

**To implement:**

- [ ] Add `--integrate` CLI flag (user-initiated, no auto-run):
  - Write `noctra.desktop` to `~/.local/share/applications/`.
  - Copy `icon-dark_512.png` and `icon-light_512.png` to `~/.local/share/icons/hicolor/512x512/apps/`.
  - Run `update-desktop-database ~/.local/share/applications`.
  - **Does NOT** call `xdg-settings set default-web-browser`.
- [ ] Document manual `xdg-mime` command in README as a fallback.
- [ ] App menu item behaves the same as `.deb`/`.rpm` once integrated.
- [ ] If the app hasn't been integrated yet, the menu item is **disabled** with a tooltip like "Run Noctra with --integrate first".

---

## 3. Second-Instance Handling (All Platforms)

When a user clicks a link while Noctra is already running, or launches Noctra with a URL argument (`noctra https://example.com`):

- [ ] Wire `app.on('second-instance')` to capture the command-line URL.
- [ ] Route the URL to the existing main window.
- [ ] Open the URL in a **new buffer** via `dispatch(win, { type: INTENTS.OPEN_URL, url }, state)`.
- [ ] Ensure the existing window is focused and brought to the foreground.

This prevents duplicate Noctra windows and provides a smooth "click link → new tab" experience regardless of default browser status.

---

## 4. App Menu Toggle

### Placement

- **macOS:** `Noctra` app menu (next to `About Noctra`, `Preferences`, etc.)
- **Linux:** `File` menu (or `Noctra` menu if using a native menubar)

### Behavior

- **Label:** `Set as Default Browser`
- **State:** Disabled when Noctra is already the default.
- **Action:** Platform-specific registration (see Section 2).
- **Persistence:** Runtime-only — reads the OS state each time the menu is opened. No config key is written.
- **No reverse action:** If the user wants to revert, they do it via System Settings, not via Noctra.

### Implementation Notes

- The menu item state should be refreshed every time the app menu is rebuilt (e.g., on `appMenu.sync()` or `appMenu.rebuild()`).
- On macOS, use `app.isDefaultProtocolClient('http')` to check status.
- On Linux, read `xdg-settings get default-web-browser` (async, cache briefly).

---

## 5. Implementation Checklist

### Icon System

- [ ] Delete old icon assets (`icon.png`, `icon.svg`, `icon_512.png`, `icon.icns`).
- [ ] Rewrite `scripts/generate-icons.js` to generate platform formats from `light_icon.png` and `dark_icon.png`.
- [ ] Run the script and verify generated assets.
- [ ] Update `forge.config.js` to reference new icon paths.

### macOS Default Browser

- [ ] Verify `CFBundleURLTypes` is present in `forge.config.js`.
- [ ] Add `app.on('second-instance')` handler in `main.js`.
- [ ] Add `app.on('open-url')` URL queuing for pre-ready state (already done, verify it works with second-instance).
- [ ] Add `Noctra → Set as Default Browser` menu item.
- [ ] Implement menu item enable/disable logic based on `app.isDefaultProtocolClient('http')`.

### Linux .deb / .rpm Default Browser

- [ ] Add `MimeType` to `maker-deb` and `maker-rpm` config options.
- [ ] Create `scripts/linux/after-install.sh` (runs `update-desktop-database`).
- [ ] Create `scripts/linux/after-remove.sh` (cleanup).
- [ ] Reference scripts in `forge.config.js` `maker-deb` config.
- [ ] Add `File → Set as Default Browser` menu item.
- [ ] Implement menu item enable/disable logic based on `xdg-settings get default-web-browser`.

### Linux AppImage Integration

- [ ] Parse `--integrate` from `process.argv` early in `main.js` before `app.whenReady()`.
- [ ] Implement integration logic (write `.desktop`, copy icons, run `update-desktop-database`).
- [ ] Exit after integration completes (do not launch the app).
- [ ] Update README with `--integrate` instructions.

### Second-Instance Handling

- [ ] Wire `app.requestSingleInstanceLock()` at the top of `main.js`.
- [ ] Handle `app.on('second-instance')` to extract URL from `argv`.
- [ ] Route URL to existing window's `dispatch()`.

### Menu Toggle

- [ ] Update `core/adapters/platform/appMenu.js` (or equivalent) to add the new menu item.
- [ ] Implement platform-specific default-browser check functions.
- [ ] Hook menu item state refresh into existing `sync()` / `rebuild()` calls.

---

## 6. Testing Notes

### Icon

- Build DMG, install, verify app icon in Dock and Launchpad.
- Build `.deb`, install on Ubuntu, verify app icon in GNOME/KDE app grid.
- Switch OS theme and verify icon adapts (if DE supports it).

### Default Browser

- Install Noctra, verify it **does NOT** appear in default browser list until menu action is triggered (macOS) or `--integrate` is run (AppImage).
- Trigger menu action, verify Noctra appears in System Settings default browser list.
- Click an external link, verify it opens in a new Noctra buffer (not a second instance).
- Launch `noctra https://example.com` while already running, verify it opens in a new buffer.

---

## 7. Future Considerations (Out of Scope)

- **Windows support:** Not currently targeted, but the same pattern applies — register `http`/`https` URL associations in the registry, add `app.setAsDefaultProtocolClient()` behind a menu item.
- **Homebrew Cask:** When set up, the Cask should reference the DMG and allow `brew install --cask noctra` without additional integration steps (macOS handles the rest via `CFBundleURLTypes`).
- **Reverse action:** If requested later, implement a "Restore Previous Default Browser" menu item that stores the previous default before switching (requires registry/xdg-settings read before write).
