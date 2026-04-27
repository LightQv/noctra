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
      tabline: {
        enabled: true,
      },
      urlline: {
        enabled: false,
      },
      statusline: {
        enabled: true,
      },
    },
    theme: {
      name: "default",
      overrides: {
        appBackground: "#0f131a",
        surfaceBackground: "#171b22",
        panelBackground: "#161b24",
        statuslineBackground: "#151a22",
        elevatedBackground: "#1a2230",
        subtleBackground: "#202633",
        windowControlBackground: "#212734",
        dangerBackground: "#3a1f27",
        borderColor: "#2f3440",
        borderStrongColor: "#2a3140",
        borderMutedColor: "#2f3a4d",
        splitDividerColor: "#252a35",
        textColor: "#d8e3f8",
        brightTextColor: "#f4f7ff",
        softTextColor: "#b6c7e8",
        mutedTextColor: "#7d8aa3",
        secondaryActiveTextColor: "#84b7cb",
        accentIconColor: "#8ec5ff",
        mainColor: "#89dceb",
        accentPillBackground: "#2c3e46",
        accentPillBorder: "#557b88",
        dangerTextColor: "#ffb4c2",
        editorBackground: "#10151d",
        editorGutterBackground: "#0f131a",
        editorGutterBorderColor: "#222731",
        editorLineNumberColor: "#5f6d86",
        editorSelectionBackground: "rgba(137, 220, 235, 0.22)",
        editorDialogBackground: "#141a23",
        editorDialogBorderColor: "#2a3140",
        fontFamily:
          '"JetBrainsMono Nerd Font Mono", "JetBrainsMono Nerd Font", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        scrollbarThumbColor: "rgba(137, 220, 235, 0.58)",
        scrollbarThumbActiveColor: "rgba(137, 220, 235, 0.92)",
      },
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
    opening_buffer: {
      mode: "blank",
      url: "",
      dashboard: {
        header: "",
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
      q: {
        label: "Close focused context",
        action: "close_focused",
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
      u: {
        label: "Toggle URL line",
        action: "toggle_urlline",
      },
    },
  },
  browser: {
    chromium: {
      web_preferences: {
        context_isolation: true,
        node_integration: false,
      },
    },
  },
};

module.exports = { defaultConfig };
