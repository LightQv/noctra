const SEARCH_RUNTIME_GLOBAL_KEY = "__noctraSearchRuntime__";
const SEARCH_VIEWPORT_TOP_RATIO = 0.22;
const SEARCH_VIEWPORT_BOTTOM_RATIO = 0.78;
const SEARCH_VIEWPORT_TARGET_RATIO = 0.36;
const SEARCH_VIEWPORT_MARGIN_PX = 16;

function buildSearchRuntimeBootstrapScript() {
  return `
    (function bootstrapNoctraSearchRuntime() {
      if (window.${SEARCH_RUNTIME_GLOBAL_KEY}) {
        return true;
      }

      const viewportTopRatio = ${SEARCH_VIEWPORT_TOP_RATIO};
      const viewportBottomRatio = ${SEARCH_VIEWPORT_BOTTOM_RATIO};
      const viewportTargetRatio = ${SEARCH_VIEWPORT_TARGET_RATIO};
      const viewportMarginPx = ${SEARCH_VIEWPORT_MARGIN_PX};

      const runtime = {
        ready: true,
        active: false,
        query: "",
        activeIndex: 0,
        total: 0,
        visibleHintCount: 0,
        hintInput: "",
        hintLabels: [],
        matches: [],
        visibleMatchIndexes: [],
        maxMatches: 5000,
        themeMainColor: "#89dceb",
        themeSearchActiveTextColor: "",
        themeSearchPassiveTextColor: "",
        overlayRoot: null,
        highlightNodes: [],
        hintNodes: [],
        mutationObserver: null,
        viewportHandlersBound: false,
        overlayFramePending: false,

        normalizeText(value) {
          return String(value || "").toLowerCase();
        },

        ensureOverlayRoot() {
          if (runtime.overlayRoot) return runtime.overlayRoot;
          if (
            typeof document === "undefined" ||
            !document.documentElement ||
            !document.body
          ) {
            return null;
          }

          const root = document.createElement("div");
          root.id = "noctra-search-overlay-root";
          root.setAttribute("aria-hidden", "true");
          root.style.position = "absolute";
          root.style.left = "0";
          root.style.top = "0";
          root.style.width = "100%";
          root.style.height = "100%";
          root.style.pointerEvents = "none";
          root.style.zIndex = "2147483000";
          root.style.setProperty("--search-main", runtime.themeMainColor);
          root.style.setProperty("--search-passive-bg", runtime.themeMainColor + "55");
          root.style.setProperty("--search-active-bg", runtime.themeMainColor + "cc");
          root.style.setProperty("--search-active-border", runtime.themeMainColor);
          const initialText = runtime.getContrastingTextColor(runtime.themeMainColor);
          root.style.setProperty("--search-active-fg", initialText);
          root.style.setProperty("--search-passive-fg", initialText);

          document.body.appendChild(root);
          runtime.overlayRoot = root;
          return root;
        },

        updateOverlayTheme(mainColor) {
          const root = runtime.ensureOverlayRoot();
          if (!root) return;
          const activeText = runtime.themeSearchActiveTextColor || runtime.getContrastingTextColor(mainColor);
          const passiveText = runtime.themeSearchPassiveTextColor || activeText;
          root.style.setProperty("--search-main", mainColor);
          root.style.setProperty("--search-passive-bg", mainColor + "55");
          root.style.setProperty("--search-active-bg", mainColor + "cc");
          root.style.setProperty("--search-active-border", mainColor);
          root.style.setProperty("--search-active-fg", activeText);
          root.style.setProperty("--search-passive-fg", passiveText);
        },

        getContrastingTextColor(color) {
          if (typeof color !== "string") return "#10151d";
          const hex = color.trim().replace(/^#/, "");
          if (!(hex.length === 3 || hex.length === 6)) return "#10151d";
          const normalized = hex.length === 3
            ? hex.split("").map((part) => part + part).join("")
            : hex;
          const r = parseInt(normalized.slice(0, 2), 16);
          const g = parseInt(normalized.slice(2, 4), 16);
          const b = parseInt(normalized.slice(4, 6), 16);
          if (![r, g, b].every((channel) => Number.isFinite(channel))) return "#10151d";
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          return luminance > 0.56 ? "#10151d" : "#f6eddf";
        },

        clearNodes(list) {
          for (const node of list) {
            if (node && node.parentNode && typeof node.parentNode.removeChild === "function") {
              node.parentNode.removeChild(node);
            }
          }
          list.length = 0;
        },

        clearOverlay() {
          runtime.clearNodes(runtime.highlightNodes);
          runtime.clearNodes(runtime.hintNodes);
          if (runtime._hintScrollSettleTimer) {
            clearTimeout(runtime._hintScrollSettleTimer);
            runtime._hintScrollSettleTimer = null;
          }
          if (!runtime.overlayRoot) return;
          const root = runtime.overlayRoot;
          runtime.overlayRoot = null;
          if (root.parentNode) {
            root.parentNode.removeChild(root);
          }
        },

        isVisibleTextNode(node) {
          if (!node || !node.parentElement) return false;
          const parent = node.parentElement;
          const tag = (parent.tagName || "").toLowerCase();
          if (tag === "script" || tag === "style" || tag === "noscript") return false;
          if (parent.closest && parent.closest("script,style,noscript,[hidden],[aria-hidden='true']")) return false;
          const style = typeof window.getComputedStyle === "function" ? window.getComputedStyle(parent) : null;
          if (style && (style.display === "none" || style.visibility === "hidden")) return false;
          return true;
        },

        buildMatches(query) {
          runtime.matches = [];
          runtime.visibleMatchIndexes = [];
          if (!query) return;

          if (
            typeof document === "undefined" ||
            !document.body ||
            typeof document.createTreeWalker !== "function" ||
            typeof NodeFilter === "undefined"
          ) {
            return;
          }

          const normalizedNeedle = runtime.normalizeText(query);
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode(node) {
                if (!runtime.isVisibleTextNode(node)) return NodeFilter.FILTER_REJECT;
                const text = String(node.nodeValue || "");
                if (!text.trim()) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
              },
            },
          );

          while (runtime.matches.length < runtime.maxMatches) {
            const node = walker.nextNode();
            if (!node) break;

            const haystack = runtime.normalizeText(node.nodeValue || "");
            let from = 0;
            while (from <= haystack.length && runtime.matches.length < runtime.maxMatches) {
              const found = haystack.indexOf(normalizedNeedle, from);
              if (found < 0) break;
              runtime.matches.push({
                node,
                start: found,
                end: found + normalizedNeedle.length,
              });
              from = found + Math.max(1, normalizedNeedle.length);
            }
          }
        },

        getMatchRects(match) {
          if (!match || match.fallback) return [];
          if (typeof document.createRange !== "function") return [];
          try {
            const range = document.createRange();
            range.setStart(match.node, match.start);
            range.setEnd(match.node, match.end);
            const rects = Array.from(range.getClientRects ? range.getClientRects() : []);
            return rects.filter((rect) => rect && rect.width > 0 && rect.height > 0);
          } catch {
            return [];
          }
        },

        rectVisible(rect) {
          if (!rect || typeof window === "undefined") return false;
          const w = Number(window.innerWidth || 0);
          const h = Number(window.innerHeight || 0);
          return rect.right > 0 && rect.bottom > 0 && rect.left < w && rect.top < h;
        },

        getScrollOffsets() {
          if (typeof window === "undefined") return { x: 0, y: 0 };
          return {
            x: Number(window.scrollX || window.pageXOffset || 0),
            y: Number(window.scrollY || window.pageYOffset || 0),
          };
        },

        getActiveRect() {
          if (!runtime.active || runtime.activeIndex < 1 || runtime.activeIndex > runtime.matches.length) {
            return null;
          }
          const rects = runtime.getMatchRects(runtime.matches[runtime.activeIndex - 1]);
          return rects.find((rect) => runtime.rectVisible(rect)) || rects[0] || null;
        },

        keepActiveMatchInComfortBand() {
          if (typeof window === "undefined" || typeof window.scrollBy !== "function") return;
          const rect = runtime.getActiveRect();
          if (!rect) return;
          const h = Number(window.innerHeight || 0);
          if (h <= 0) return;

          const topLimit = h * viewportTopRatio + viewportMarginPx;
          const bottomLimit = h * viewportBottomRatio - viewportMarginPx;
          const target = h * viewportTargetRatio;
          const centerY = rect.top + rect.height / 2;
          if (centerY >= topLimit && centerY <= bottomLimit) return;

          const deltaY = centerY - target;
          if (Math.abs(deltaY) < 1) return;
          window.scrollBy({ top: deltaY, behavior: "smooth" });
        },

        renderHighlights() {
          const root = runtime.ensureOverlayRoot();
          if (!root) return;
          runtime.clearNodes(runtime.highlightNodes);
          runtime.visibleMatchIndexes = [];
          if (!runtime.active || runtime.total <= 0) return;

          const scroll = runtime.getScrollOffsets();
          for (let i = 0; i < runtime.matches.length; i += 1) {
            const rects = runtime.getMatchRects(runtime.matches[i]);
            let hasVisible = false;
            for (const rect of rects) {
              if (!runtime.rectVisible(rect)) continue;
              hasVisible = true;
              const node = document.createElement("div");
              node.style.position = "absolute";
              node.style.left = String(Math.max(0, rect.left + scroll.x)) + "px";
              node.style.top = String(Math.max(0, rect.top + scroll.y)) + "px";
              node.style.width = String(Math.max(1, rect.width)) + "px";
              node.style.height = String(Math.max(1, rect.height)) + "px";
              node.style.borderRadius = "0";
              if (i + 1 === runtime.activeIndex) {
                node.style.background = "var(--search-active-bg)";
                node.style.border = "none";
                node.style.color = "var(--search-active-fg)";
              } else {
                node.style.background = "var(--search-passive-bg)";
                node.style.border = "none";
                node.style.color = "var(--search-passive-fg)";
              }
              root.appendChild(node);
              runtime.highlightNodes.push(node);
            }
            if (hasVisible) {
              runtime.visibleMatchIndexes.push(i + 1);
            }
          }
        },

        throttle(fn, waitMs) {
          let last = 0;
          let timer = null;
          return function throttled() {
            const now = Date.now();
            const remaining = waitMs - (now - last);
            if (remaining <= 0) {
              last = now;
              fn();
              return;
            }
            if (timer) return;
            timer = setTimeout(() => {
              timer = null;
              last = Date.now();
              fn();
            }, remaining);
          };
        },

        scheduleOverlayRefresh() {
          if (runtime.overlayFramePending) return;
          runtime.overlayFramePending = true;
          const flush = () => {
            runtime.overlayFramePending = false;
            runtime.renderHighlights();
            runtime.renderHints();
          };
          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(flush);
          } else if (typeof setTimeout === "function") {
            setTimeout(flush, 16);
          } else {
            flush();
          }
        },

        bindObservers() {
          if (!runtime.viewportHandlersBound && typeof window !== "undefined") {
            const onResize = runtime.throttle(() => runtime.scheduleOverlayRefresh(), 100);
            const onScroll = runtime.throttle(() => {
              runtime.scheduleOverlayRefresh();
              if (runtime._hintScrollSettleTimer) {
                clearTimeout(runtime._hintScrollSettleTimer);
              }
              runtime._hintScrollSettleTimer = setTimeout(() => {
                runtime._hintScrollSettleTimer = null;
                if (runtime.hintLabels.length > 0 || runtime.hintInput) {
                  runtime.renderHighlights();
                  runtime.openHintsForCurrentViewport(24);
                }
                runtime.scheduleOverlayRefresh();
              }, 90);
            }, 33);
            if (typeof window.addEventListener === "function") {
              window.addEventListener("scroll", onScroll, { passive: true });
              window.addEventListener("resize", onResize, { passive: true });
              runtime.viewportHandlersBound = true;
            }
          }

          if (
            !runtime.mutationObserver &&
            typeof MutationObserver === "function" &&
            typeof document !== "undefined" &&
            document.body
          ) {
            runtime.mutationObserver = new MutationObserver(
              runtime.throttle(() => {
                if (!runtime.active || !runtime.query) return;
                runtime.buildMatches(runtime.query);
                runtime.total = runtime.matches.length;
                runtime.activeIndex = runtime.total > 0 ? Math.min(runtime.activeIndex || 1, runtime.total) : 0;
                runtime.scheduleOverlayRefresh();
              }, 120),
            );
            runtime.mutationObserver.observe(document.body, {
              subtree: true,
              childList: true,
              characterData: true,
            });
          }
        },

        getHintAlphabet() {
          return "asdfjklqweruiopzxcvnm";
        },

        buildHintLabels(count) {
          const alphabet = runtime.getHintAlphabet();
          const labels = [];
          for (let i = 0; i < count; i += 1) {
            if (i < alphabet.length) {
              labels.push(alphabet[i]);
            } else {
              const first = alphabet[Math.floor(i / alphabet.length) - 1] || "a";
              const second = alphabet[i % alphabet.length];
              labels.push(first + second);
            }
          }
          return labels;
        },

        openHintsForCurrentViewport(limit = 24) {
          const visibleIndexes = runtime.visibleMatchIndexes.length
            ? runtime.visibleMatchIndexes.slice(0, limit)
            : Array.from({ length: Math.min(runtime.total, limit) }, (_, i) => i + 1);
          const labels = runtime.buildHintLabels(visibleIndexes.length);
          runtime.hintInput = "";
          runtime.hintLabels = labels.map((label, idx) => ({ label, index: visibleIndexes[idx] }));
          runtime.visibleHintCount = runtime.hintLabels.length;
        },

        renderHints() {
          runtime.clearNodes(runtime.hintNodes);
          if (runtime.hintLabels.length === 0) return;
          const root = runtime.ensureOverlayRoot();
          if (!root) return;
          const scroll = runtime.getScrollOffsets();

          for (let i = 0; i < runtime.hintLabels.length; i += 1) {
            const hint = runtime.hintLabels[i];
            const targetIndex = Number.isFinite(hint.index)
              ? Math.max(1, Math.floor(hint.index))
              : 1;
            const rects = runtime.getMatchRects(runtime.matches[targetIndex - 1]);
            const rect = rects.find((candidate) => runtime.rectVisible(candidate));
            if (!rect) continue;

            const node = document.createElement("div");
            node.style.position = "absolute";
            node.style.left = String(Math.max(0, rect.left + scroll.x)) + "px";
            node.style.top = String(Math.max(0, rect.top + scroll.y - 18)) + "px";
            node.style.padding = "3px 7px";
            node.style.borderRadius = "6px";
            node.style.fontSize = "12px";
            node.style.fontWeight = "600";
            node.style.lineHeight = "1";
            node.style.display = "inline-flex";
            node.style.alignItems = "center";
            node.style.justifyContent = "center";
            node.style.width = "fit-content";
            node.style.background = "var(--search-active-bg)";
            node.style.border = "1px solid var(--search-active-border)";
            node.style.color = "var(--search-active-fg)";
            node.textContent = hint.label;
            root.appendChild(node);
            runtime.hintNodes.push(node);
          }
        },

        handleCommand(envelope) {
          const safeEnvelope = envelope && typeof envelope === "object" ? envelope : {};
          const requestId = safeEnvelope.requestId || null;
          try {
            const action = typeof safeEnvelope.action === "string" ? safeEnvelope.action : "";
            const payload = safeEnvelope.payload && typeof safeEnvelope.payload === "object"
              ? safeEnvelope.payload
              : {};

          if (action === "ping") {
            return { ok: true, requestId, payload: { ready: true } };
          }

          if (action === "start") {
            const query = typeof payload.query === "string" ? payload.query.trim() : "";
            runtime.bindObservers();
            runtime.active = query.length > 0;
            runtime.query = query;
            runtime.hintInput = "";
            runtime.hintLabels = [];
            runtime.visibleHintCount = 0;
            runtime.buildMatches(query);
            runtime.total = runtime.matches.length;
            runtime.activeIndex = runtime.total > 0 ? 1 : 0;
            runtime.keepActiveMatchInComfortBand();
            runtime.scheduleOverlayRefresh();
            return {
              ok: true,
              requestId,
              payload: {
                total: runtime.total,
                activeIndex: runtime.activeIndex,
                visibleHintCount: runtime.visibleHintCount,
              },
            };
          }

          if (action === "next" || action === "prev") {
            if (!runtime.active || runtime.total <= 0) {
              return {
                ok: true,
                requestId,
                payload: { total: 0, activeIndex: 0, visibleHintCount: 0 },
              };
            }
            const delta = action === "next" ? 1 : -1;
            const nextRaw = runtime.activeIndex + delta;
            runtime.activeIndex = nextRaw < 1 ? runtime.total : ((nextRaw - 1) % runtime.total) + 1;
            runtime.keepActiveMatchInComfortBand();
            runtime.scheduleOverlayRefresh();
            return {
              ok: true,
              requestId,
              payload: {
                total: runtime.total,
                activeIndex: runtime.activeIndex,
                visibleHintCount: runtime.visibleHintCount,
              },
            };
          }

          if (action === "clear") {
            runtime.active = false;
            runtime.query = "";
            runtime.activeIndex = 0;
            runtime.total = 0;
            runtime.visibleHintCount = 0;
            runtime.hintInput = "";
            runtime.hintLabels = [];
            runtime.matches = [];
            runtime.visibleMatchIndexes = [];
            runtime.clearOverlay();
            return {
              ok: true,
              requestId,
              payload: { total: 0, activeIndex: 0, visibleHintCount: 0 },
            };
          }

          if (action === "theme-update") {
            const mainColor =
              typeof payload.mainColor === "string" && payload.mainColor.length > 0
                ? payload.mainColor
                : runtime.themeMainColor;
            const activeTextColor =
              typeof payload.searchActiveTextColor === "string" && payload.searchActiveTextColor.trim().length > 0
                ? payload.searchActiveTextColor.trim()
                : "";
            const passiveTextColor =
              typeof payload.searchPassiveTextColor === "string" && payload.searchPassiveTextColor.trim().length > 0
                ? payload.searchPassiveTextColor.trim()
                : "";
            runtime.themeMainColor = mainColor;
            runtime.themeSearchActiveTextColor = activeTextColor;
            runtime.themeSearchPassiveTextColor = passiveTextColor;
            runtime.updateOverlayTheme(mainColor);
            runtime.scheduleOverlayRefresh();
            return {
              ok: true,
              requestId,
              payload: {
                total: runtime.total,
                activeIndex: runtime.activeIndex,
                visibleHintCount: runtime.visibleHintCount,
              },
            };
          }

          if (action === "hint-open") {
            runtime.renderHighlights();
            runtime.openHintsForCurrentViewport(24);
            runtime.scheduleOverlayRefresh();
            return {
              ok: true,
              requestId,
              payload: {
                total: runtime.total,
                activeIndex: runtime.activeIndex,
                visibleHintCount: runtime.visibleHintCount,
                hints: runtime.hintLabels,
              },
            };
          }

          if (action === "hint-input") {
            const input = typeof payload.input === "string" ? payload.input.toLowerCase() : "";
            runtime.hintInput = input;
            if (!input) {
              runtime.hintLabels = [];
              runtime.visibleHintCount = 0;
              runtime.scheduleOverlayRefresh();
              return {
                ok: true,
                requestId,
                payload: {
                  total: runtime.total,
                  activeIndex: runtime.activeIndex,
                  visibleHintCount: 0,
                },
              };
            }

            const filtered = runtime.hintLabels.filter((entry) => entry.label.startsWith(input));
            runtime.visibleHintCount = filtered.length;
            if (filtered.length === 1 && filtered[0].label === input) {
              runtime.activeIndex = filtered[0].index;
              runtime.keepActiveMatchInComfortBand();
              runtime.openHintsForCurrentViewport(24);
              runtime.scheduleOverlayRefresh();
              return {
                ok: true,
                requestId,
                payload: {
                  total: runtime.total,
                  activeIndex: runtime.activeIndex,
                  visibleHintCount: runtime.visibleHintCount,
                  hints: runtime.hintLabels,
                  jumped: true,
                },
              };
            }

            runtime.hintLabels = filtered;
            runtime.scheduleOverlayRefresh();
            return {
              ok: true,
              requestId,
              payload: {
                total: runtime.total,
                activeIndex: runtime.activeIndex,
                visibleHintCount: runtime.visibleHintCount,
                hints: runtime.hintLabels,
              },
            };
          }

          if (action === "jump") {
            const index = Number.isFinite(payload.index) ? Math.max(1, Math.floor(payload.index)) : 1;
            runtime.activeIndex = Math.min(index, Math.max(runtime.total, 1));
            runtime.keepActiveMatchInComfortBand();
            if (runtime.hintLabels.length > 0 || runtime.hintInput) {
              runtime.openHintsForCurrentViewport(24);
            } else {
              runtime.hintLabels = [];
              runtime.visibleHintCount = 0;
            }
            runtime.scheduleOverlayRefresh();
            return {
              ok: true,
              requestId,
              payload: {
                total: runtime.total,
                activeIndex: runtime.activeIndex,
                visibleHintCount: runtime.visibleHintCount,
                hints: runtime.hintLabels,
              },
            };
          }

          if (action === "debug-state") {
            return {
              ok: true,
              requestId,
              payload: {
                total: runtime.total,
                visibleHintCount: runtime.visibleHintCount,
                hasOverlay: Boolean(runtime.overlayRoot),
                visibleMatches: runtime.visibleMatchIndexes.length,
              },
            };
          }

            return {
              ok: false,
              requestId,
              error: {
                code: "search_runtime_unknown_action",
                message: "Unknown search runtime action",
              },
            };
          } catch (error) {
            return {
              ok: false,
              requestId,
              error: {
                code: "search_runtime_command_exception",
                message:
                  error && typeof error.message === "string" && error.message.length > 0
                    ? error.message
                    : "Search runtime command failed",
              },
            };
          }
        },
      };

      Object.defineProperty(window, "${SEARCH_RUNTIME_GLOBAL_KEY}", {
        configurable: true,
        enumerable: false,
        writable: false,
        value: runtime,
      });

      return true;
    })();
  `;
}

function buildSearchRuntimeCommandScript(envelope) {
  const serializedEnvelope = JSON.stringify(envelope || {});
  return `
    (function runNoctraSearchRuntimeCommand() {
      ${buildSearchRuntimeBootstrapScript()}
      const runtime = window.${SEARCH_RUNTIME_GLOBAL_KEY};
      const envelope = ${serializedEnvelope};
      if (!runtime || typeof runtime.handleCommand !== "function") {
        return {
          ok: false,
          requestId: null,
          error: {
            code: "search_runtime_missing",
            message: "Search runtime not available",
          },
        };
      }
      try {
        return runtime.handleCommand(envelope);
      } catch (error) {
        return {
          ok: false,
          requestId: envelope && envelope.requestId ? envelope.requestId : null,
          error: {
            code: "search_runtime_command_exception",
            message: error && error.message ? error.message : "Search runtime command failed",
          },
        };
      }
    })();
  `;
}

module.exports = {
  SEARCH_RUNTIME_GLOBAL_KEY,
  buildSearchRuntimeBootstrapScript,
  buildSearchRuntimeCommandScript,
};
