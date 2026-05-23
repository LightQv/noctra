const SEARCH_RUNTIME_GLOBAL_KEY = "__noctraSearchRuntime__";

function buildSearchRuntimeBootstrapScript() {
  return `
    (function bootstrapNoctraSearchRuntime() {
      if (window.${SEARCH_RUNTIME_GLOBAL_KEY}) {
        return true;
      }

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
          root.style.position = "fixed";
          root.style.left = "0";
          root.style.top = "0";
          root.style.right = "0";
          root.style.bottom = "0";
          root.style.pointerEvents = "none";
          root.style.zIndex = "2147483000";
          root.style.setProperty("--search-main", runtime.themeMainColor);
          root.style.setProperty("--search-passive-bg", runtime.themeMainColor + "55");
          root.style.setProperty("--search-active-bg", runtime.themeMainColor + "cc");
          root.style.setProperty("--search-active-border", runtime.themeMainColor);

          document.body.appendChild(root);
          runtime.overlayRoot = root;
          return root;
        },

        updateOverlayTheme(mainColor) {
          const root = runtime.ensureOverlayRoot();
          if (!root) return;
          root.style.setProperty("--search-main", mainColor);
          root.style.setProperty("--search-passive-bg", mainColor + "55");
          root.style.setProperty("--search-active-bg", mainColor + "cc");
          root.style.setProperty("--search-active-border", mainColor);
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
            typeof document.createTreeWalker !== "function" ||
            typeof NodeFilter === "undefined"
          ) {
            const fallbackTotal = Math.min(runtime.maxMatches, Math.max(1, query.length));
            for (let i = 0; i < fallbackTotal; i += 1) {
              runtime.matches.push({ fallback: true, index: i + 1 });
            }
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

        renderHighlights() {
          const root = runtime.ensureOverlayRoot();
          if (!root) return;
          runtime.clearNodes(runtime.highlightNodes);
          runtime.visibleMatchIndexes = [];
          if (!runtime.active || runtime.total <= 0) return;

          for (let i = 0; i < runtime.matches.length; i += 1) {
            const rects = runtime.getMatchRects(runtime.matches[i]);
            let hasVisible = false;
            for (const rect of rects) {
              if (!runtime.rectVisible(rect)) continue;
              hasVisible = true;
              const node = document.createElement("div");
              node.style.position = "fixed";
              node.style.left = String(Math.max(0, rect.left)) + "px";
              node.style.top = String(Math.max(0, rect.top)) + "px";
              node.style.width = String(Math.max(1, rect.width)) + "px";
              node.style.height = String(Math.max(1, rect.height)) + "px";
              node.style.borderRadius = "3px";
              if (i + 1 === runtime.activeIndex) {
                node.style.background = "var(--search-active-bg)";
                node.style.border = "1px solid var(--search-active-border)";
              } else {
                node.style.background = "var(--search-passive-bg)";
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
            const onMove = runtime.throttle(() => runtime.scheduleOverlayRefresh(), 50);
            if (typeof window.addEventListener === "function") {
              window.addEventListener("scroll", onMove, { passive: true });
              window.addEventListener("resize", onMove, { passive: true });
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

        renderHints() {
          runtime.clearNodes(runtime.hintNodes);
          if (runtime.hintLabels.length === 0) return;
          const root = runtime.ensureOverlayRoot();
          if (!root) return;

          const indexes = runtime.visibleMatchIndexes.length
            ? runtime.visibleMatchIndexes
            : runtime.hintLabels.map((entry) => entry.index);

          for (let i = 0; i < runtime.hintLabels.length; i += 1) {
            const hint = runtime.hintLabels[i];
            const targetIndex = indexes[i] || hint.index;
            const rects = runtime.getMatchRects(runtime.matches[targetIndex - 1]);
            const rect = rects.find((candidate) => runtime.rectVisible(candidate));
            if (!rect) continue;

            const node = document.createElement("div");
            node.style.position = "fixed";
            node.style.left = String(Math.max(0, rect.left)) + "px";
            node.style.top = String(Math.max(0, rect.top - 16)) + "px";
            node.style.padding = "1px 4px";
            node.style.borderRadius = "4px";
            node.style.fontSize = "10px";
            node.style.background = "var(--search-active-bg)";
            node.style.border = "1px solid var(--search-active-border)";
            node.textContent = hint.label;
            root.appendChild(node);
            runtime.hintNodes.push(node);
          }
        },

        handleCommand(envelope) {
          const safeEnvelope = envelope && typeof envelope === "object" ? envelope : {};
          const requestId = safeEnvelope.requestId || null;
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
            runtime.themeMainColor = mainColor;
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
            const visibleIndexes = runtime.visibleMatchIndexes.length
              ? runtime.visibleMatchIndexes.slice(0, 24)
              : Array.from({ length: Math.min(runtime.total, 24) }, (_, i) => i + 1);
            const labels = runtime.buildHintLabels(visibleIndexes.length);
            runtime.hintInput = "";
            runtime.hintLabels = labels.map((label, idx) => ({ label, index: visibleIndexes[idx] }));
            runtime.visibleHintCount = runtime.hintLabels.length;
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
      return runtime.handleCommand(${serializedEnvelope});
    })();
  `;
}

module.exports = {
  SEARCH_RUNTIME_GLOBAL_KEY,
  buildSearchRuntimeBootstrapScript,
  buildSearchRuntimeCommandScript,
};
