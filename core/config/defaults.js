const defaultConfig = {
  global: {
    input: {
      leader_key: "Space",
      sequence_timeout_ms: 500,
    },
    whichkey: {
      enabled: true,
      display_delay_ms: 180,
      timeout_ms: 1200,
    },
    editor: {
      enabled: true,
      start_in_normal_mode: true,
      relative_line_numbers: true,
      scrolloff_lines: 3,
    },
    ui: {
      sidepanel: {
        width_ratio: 0.2,
        tree_scroll_context_lines: 3,
        delete_operator_timeout_ms: 900,
      },
      tabline: {
        enabled: true,
        show_favicon: false,
      },
      urlline: {
        enabled: false,
      },
      statusline: {
        enabled: true,
      },
    },
    theme: {
      mode: "dark",
      content_mode: "dark",
      overrides: {},
    },
    split: {
      enabled: true,
      regular_ratio: 0.5,
      devtools_ratio: 0.25,
      divider: {
        enabled: true,
      },
      focus_keys: {
        left: "Ctrl+h",
        right: "Ctrl+l",
      },
    },
    storage: {
      history_file: "~/.config/noctra/history.yml",
      favorites_file: "~/.config/noctra/favorites.yml",
      sessions_file: "~/.config/noctra/sessions.yml",
    },
    window: {
      width: 1200,
      height: 800,
      x: null,
      y: null,
      is_maximized: false,
    },
    opening_buffer: {
      mode: "dashboard",
      url: "https://anime-sama.to/",
      dashboard: {
        header: [
          "░▒▓███████▓▒░ ░▒▓██████▓▒░ ░▒▓██████▓▒░▒▓████████▓▒░▒▓███████▓▒░ ░▒▓██████▓▒░",
          "░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░",
          "░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░        ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░",
          "░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░        ░▒▓█▓▒░   ░▒▓███████▓▒░░▒▓████████▓▒░",
          "░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░        ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░",
          "░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░",
          "░▒▓█▓▒░░▒▓█▓▒░░▒▓██████▓▒░ ░▒▓██████▓▒░  ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░",
        ].join("\n"),
        buttons: [],
        footer: "",
      },
    },
  },
  keymap: {
    normal: {
      j: {
        label: "Scroll down",
        action: "scroll_down",
      },
      k: {
        label: "Scroll up",
        action: "scroll_up",
      },
      gg: {
        label: "Scroll to top",
        action: "scroll_top",
      },
      G: {
        label: "Scroll to bottom",
        action: "scroll_bottom",
      },
      h: {
        label: "Scroll left",
        action: "scroll_left",
      },
      l: {
        label: "Scroll right",
        action: "scroll_right",
      },
      gh: {
        label: "Navigate back",
        action: "nav_back",
      },
      gl: {
        label: "Navigate forward",
        action: "nav_forward",
      },
      r: {
        label: "Reload page",
        action: "reload_page",
      },
      ".": {
        label: "Repeat last action",
        action: "repeat_last_action",
      },
      H: {
        label: "Previous buffer",
        action: "buffer_prev",
      },
      L: {
        label: "Next buffer",
        action: "buffer_next",
      },
      i: {
        label: "Enter insert mode",
        action: "enter_insert",
      },
      o: {
        label: "Open URL prompt",
        action: "open_url_prompt",
      },
      b: {
        label: "New buffer",
        action: "new_buffer",
      },
      "|": {
        label: "Vertical split",
        action: "split_vertical",
      },
    },
    mod: {
      d: {
        label: "Half-page down",
        action: "scroll_half_down",
      },
      u: {
        label: "Half-page up",
        action: "scroll_half_up",
      },
      f: {
        label: "Page down",
        action: "page_down",
      },
      b: {
        label: "Page up",
        action: "page_up",
      },
      h: {
        label: "Focus split left",
        action: "focus_split_left",
      },
      l: {
        label: "Focus split right",
        action: "focus_split_right",
      },
      q: {
        label: "Close focused context",
        action: "close_focused",
      },
      t: {
        label: "New buffer",
        action: "new_buffer",
      },
      T: {
        label: "Reopen last closed buffer",
        action: "reopen_buffer",
      },
    },
    leader: {
      ",": {
        label: "Open settings",
        action: "open_settings",
      },
      tab: {
        label: "Toggle focus context",
        action: "toggle_focus_context",
      },
      b: {
        label: "Buffers",
        children: {
          c: {
            label: "Close current buffer",
            action: "close_buffer",
          },
          l: {
            label: "Close right buffers",
            action: "close_right_buffers",
          },
          h: {
            label: "Close left buffers",
            action: "close_left_buffers",
          },
          u: {
            label: "Reopen last closed buffer",
            action: "reopen_buffer",
          },
        },
      },
      c: {
        label: "Close",
        children: {
          c: {
            label: "Close current buffer",
            action: "close_buffer",
          },
          l: {
            label: "Close right buffers",
            action: "close_right_buffers",
          },
          h: {
            label: "Close left buffers",
            action: "close_left_buffers",
          },
        },
      },
      s: {
        label: "Split",
        children: {
          q: {
            label: "Close right split",
            action: "split_close_right",
          },
          d: {
            label: "Open devtools split",
            action: "split_devtools",
          },
        },
      },
      S: {
        label: "Session",
        children: {
          s: {
            label: "Save session snapshot",
            action: "session_save",
          },
          r: {
            label: "Restore session snapshot",
            action: "session_restore",
          },
        },
      },
      u: {
        label: "Toggle URL line",
        action: "toggle_urlline",
      },
      e: {
        label: "Toggle history tree",
        action: "history_toggle",
      },
      f: {
        label: "Toggle favorites tree",
        action: "favorites_toggle",
      },
      o: {
        label: "Toggle tree focus",
        action: "history_toggle_focus",
      },
    },
  },
  browser: {
    language: "en",
    chromium: {
      web_preferences: {
        context_isolation: true,
        node_integration: false,
      },
    },
  },
};

module.exports = { defaultConfig };
