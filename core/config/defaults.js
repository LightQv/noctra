const defaultConfig = {
  global: {
    input: {
      leader_key: "Space",
      sequence_timeout_ms: 500,
    },
    whichkey: {
      enabled: true,
      display_delay_ms: 180,
      timeout_ms: null,
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
      telescope: {
        prompt_position: "top",
      },
    },
    theme: {
      mode: "dark",
      content_mode: "dark",
      overrides: {
        appBackground: "#0f131a",
        surfaceBackground: "#171b22",
        panelBackground: "#161b24",
        shellBackground: "#151a22",
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
        editorCursorColor: "#89dceb",
        editorCursorTextColor: "#10151d",
        editorActiveLineBackground: "rgba(137, 220, 235, 0.08)",
        editorMatchingBracketBackground: "rgba(142, 197, 255, 0.2)",
        editorMatchingBracketColor: "#d8e3f8",
        editorDialogBackground: "#141a23",
        editorDialogBorderColor: "#2a3140",
        editorTokenKeywordColor: "#8ec5ff",
        editorTokenAtomColor: "#ffb4c2",
        editorTokenNumberColor: "#f3b889",
        editorTokenDefColor: "#89dceb",
        editorTokenVariableColor: "#d8e3f8",
        editorTokenVariable2Color: "#9dd7ff",
        editorTokenVariable3Color: "#f8d38e",
        editorTokenPropertyColor: "#b8d3ff",
        editorTokenOperatorColor: "#c8d6f0",
        editorTokenCommentColor: "#7f8ca3",
        editorTokenStringColor: "#a7d9a8",
        editorTokenString2Color: "#8ed8c9",
        editorTokenMetaColor: "#b6c7e8",
        editorTokenQualifierColor: "#f6c177",
        editorTokenBuiltinColor: "#c4b5fd",
        editorTokenTagColor: "#7dc4e4",
        editorTokenAttributeColor: "#f9cb8c",
        editorTokenHeaderColor: "#89dceb",
        editorTokenQuoteColor: "#98d3a5",
        editorTokenLinkColor: "#89b4ff",
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
      bookmarks_file: "~/.config/noctra/bookmarks.yml",
      sessions_file: "~/.config/noctra/sessions.yml",
      notifications_file: "~/.config/noctra/notifications.yml",
    },
    notifications: {
      enabled: true,
      toast: {
        info: true,
        warning: true,
        error: true,
      },
      timeout_ms: {
        info: 2200,
        warning: 3600,
        error: 6500,
      },
      persist_errors: true,
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
      url: "https://github.com/LightQv/noctra",
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
      j: "scroll_down",
      k: "scroll_up",
      gg: "scroll_top",
      G: "scroll_bottom",
      h: "scroll_left",
      l: "scroll_right",
      gh: "nav_back",
      gl: "nav_forward",
      r: "reload_page",
      ".": "repeat_last_action",
      H: "buffer_prev",
      L: "buffer_next",
      i: "enter_insert",
      o: "open_url_prompt",
      b: "new_buffer",
      "|": "split_vertical",
    },
    mod: {
      d: "scroll_half_down",
      u: "scroll_half_up",
      f: "page_down",
      b: "page_up",
      h: "focus_split_left",
      l: "focus_split_right",
      q: "close_focused",
      t: "new_buffer",
      T: "reopen_buffer",
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
        label: "Buffers...",
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
        label: "Close...",
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
        label: "Split...",
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
        label: "Session...",
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
      y: {
        label: "Toggle selection copy",
        action: "toggle_copy_selection_to_clipboard",
      },
      e: {
        label: "Toggle side-tree",
        action: "history_toggle",
      },
      d: {
        label: "Bookmarks...",
        children: {
          r: {
            label: "Quick to root level",
            action: "bookmarks_add_root_active",
          },
          d: {
            label: "Choose path",
            action: "bookmarks_add_scoped_prompt",
          },
        },
      },
      f: {
        label: "Find...",
        children: {
          h: {
            label: "History",
            action: "telescope_open_history",
          },
          d: {
            label: "Bookmarks",
            action: "telescope_open_bookmarks",
          },
          b: {
            label: "Buffers",
            action: "telescope_open_buffers",
          },
          Enter: {
            label: "Resume last find",
            action: "telescope_reopen_last",
          },
        },
      },
      o: {
        label: "Toggle tree focus",
        action: "history_toggle_focus",
      },
      n: {
        label: "Open notifications",
        action: "open_notifications",
      },
    },
  },
  browser: {
    language: "en",
    copy_selection_to_clipboard: false,
    allow_http_loopback: true,
    allow_http_private_lan: true,
    trusted_http_hosts: [],
  },
};

module.exports = { defaultConfig };
