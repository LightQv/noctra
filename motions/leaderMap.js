const { getConfigValue } = require("../core/config/service");
const { ACTION_BUILDERS } = require("./actionBuilders");

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

function isNodeAvailable(node, context = {}) {
  if (!node || typeof node !== "object") {
    return false;
  }

  if (node.children && typeof node.children === "object") {
    return Object.values(node.children).some((child) =>
      isNodeAvailable(child, context),
    );
  }

  if (typeof node.action !== "function") {
    return false;
  }

  if (typeof node.action.isAvailable !== "function") {
    return true;
  }

  return Boolean(node.action.isAvailable(context));
}

function getLeaderNode(path = [], context = {}) {
  let current = { children: getLeaderTree() };

  for (const key of path) {
    if (!current.children || !current.children[key]) {
      return null;
    }
    current = current.children[key];
  }

  if (!isNodeAvailable(current, context)) {
    return null;
  }

  return current;
}

function getWhichKeyModel(path = [], numericBuffer = "", context = {}) {
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

  const node = getLeaderNode(path, context);
  const entries = [];

  if (node && node.children) {
    const childKeys = Object.keys(node.children).sort((left, right) => {
      const primary = left.localeCompare(right, undefined, {
        sensitivity: "base",
      });
      if (primary !== 0) {
        return primary;
      }
      return left.localeCompare(right);
    });
    for (const key of childKeys) {
      const child = node.children[key];
      if (!isNodeAvailable(child, context)) {
        continue;
      }
      entries.push({
        key,
        label: child.label,
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
