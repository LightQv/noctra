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
    leader: {
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
    history_file: "~/.config/vim-browser/history.yml",
    favorites_file: "~/.config/vim-browser/favorites.yml",
    sessions_file: "~/.config/vim-browser/sessions.yml",
  },
};

module.exports = { defaultConfig };
