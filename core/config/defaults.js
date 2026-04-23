const defaultConfig = {
  input: {
    leader_key: "Space",
    sequence_timeout_ms: 500,
  },
  whichkey: {
    enabled: true,
    display_delay_ms: 180,
    timeout_ms: 1200,
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
        label: "Navigate back",
        action: "nav_back",
      },
      l: {
        label: "Navigate forward",
        action: "nav_forward",
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
    ctrl: {
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
      c: {
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
    },
  },
  editor: {
    enabled: true,
    start_in_normal_mode: true,
  },
  ui: {
    tabline: {
      enabled: true,
    },
    statusline: {
      enabled: true,
    },
  },
  theme: {
    name: "default",
    overrides: {},
  },
  split: {
    enabled: true,
    regular_ratio: 0.5,
    devtools_ratio: 0.25,
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
};

module.exports = { defaultConfig };
