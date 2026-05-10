# Tutorial: First 30 Minutes

This tutorial gives you a practical Noctra workflow in under 30 minutes.

## 0-5 min: Launch and orient

1. Start Noctra:

```bash
npm run start
```

2. Confirm you are in `NORMAL` mode.
3. Try navigation keys: `j`, `k`, `h`, `l`, `gg`, `G`.

## 5-10 min: Open and move across buffers

1. Press `:` and run `:tabnew github.com`.
2. Run `:tabnew news.ycombinator.com`.
3. Switch with `H` and `L`.
4. Close one with `:bdelete`.
5. Reopen with `:reopen`.

## 10-15 min: Use insert and command modes

1. Press `i` to enter `INSERT` mode.
2. Interact with a web input field.
3. Press `Escape` to return to `NORMAL`.
4. Press `:` and run `:open docs.github.com`.

## 15-20 min: Panels and split workflow

1. Toggle panel with `<leader> e`.
2. Toggle panel focus with `<leader> o`.
3. Open split with `|` or `:split`.
4. Move focus with `Ctrl+h` and `Ctrl+l`.
5. Close split with `:splitq`.

## 20-25 min: Save and restore session

1. Build a workspace with 2-4 buffers.
2. Run `:session save`.
3. Close a buffer or restart Noctra.
4. Run `:session restore`.

## 25-30 min: Personalize basics

1. Open config with `:settings`.
2. Set `global.ui.urlline.enabled: true` if preferred.
3. Adjust `global.input.leader_key`.
4. Save and run `:config-reload`.

You now have a solid baseline for daily usage.

Continue with:

- `docs/tutorials/customize-keymap.md`
- `docs/tutorials/sessions-history-bookmarks.md`
