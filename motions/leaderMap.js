const { INTENTS } = require("../core/intents");
const { getConfigValue } = require("../core/config/service");

const ACTION_BUILDERS = {
  close_buffer: () => ({ type: INTENTS.CLOSE_BUFFER }),
  close_left_buffers: () => ({ type: INTENTS.CLOSE_LEFT_BUFFERS }),
  close_right_buffers: () => ({ type: INTENTS.CLOSE_RIGHT_BUFFERS }),
  split_close_right: () => ({ type: INTENTS.SPLIT_CLOSE_RIGHT }),
  split_devtools: () => ({ type: INTENTS.SPLIT_DEVTOOLS }),
};

function buildTreeNode(node) {
  if (!node || typeof node !== "object") {
    return null;
  }

  const built = {
    label: typeof node.label === "string" ? node.label : "Leader Action",
  };

  if (typeof node.action === "string" && ACTION_BUILDERS[node.action]) {
    built.action = ACTION_BUILDERS[node.action];
  }

  if (node.children && typeof node.children === "object") {
    built.children = {};
    for (const [key, childNode] of Object.entries(node.children)) {
      const builtChild = buildTreeNode(childNode);
      if (builtChild) {
        built.children[key] = builtChild;
      }
    }
  }

  if (!built.action && !built.children) {
    return null;
  }

  return built;
}

function getLeaderTree() {
  const configTree = getConfigValue("keymap.leader", {});
  const runtimeTree = {};

  if (!configTree || typeof configTree !== "object") {
    return runtimeTree;
  }

  for (const [key, node] of Object.entries(configTree)) {
    const built = buildTreeNode(node);
    if (built) {
      runtimeTree[key] = built;
    }
  }

  return runtimeTree;
}

function getLeaderNode(path = []) {
  let current = { children: getLeaderTree() };

  for (const key of path) {
    if (!current.children || !current.children[key]) {
      return null;
    }
    current = current.children[key];
  }

  return current;
}

function getWhichKeyModel(path = [], numericBuffer = "") {
  if (numericBuffer) {
    return {
      prefix: `<leader>${numericBuffer}`,
      entries: [
        {
          key: "<Enter digits>",
          label: `Switch to buffer ${numericBuffer}`,
        },
      ],
    };
  }

  const node = getLeaderNode(path);
  const entries = [];

  if (node && node.children) {
    const childKeys = Object.keys(node.children).sort();
    for (const key of childKeys) {
      const child = node.children[key];
      const suffix = child.children ? "..." : "";
      entries.push({
        key,
        label: `${child.label}${suffix}`,
      });
    }
  }

  if (path.length === 0) {
    entries.push({ key: "0-9", label: "Switch buffer by number" });
  }

  const prefix = path.length ? `<leader> ${path.join(" ")}` : "<leader>";

  return { prefix, entries };
}

module.exports = {
  getLeaderNode,
  getWhichKeyModel,
};
