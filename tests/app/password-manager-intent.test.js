const test = require("node:test");
const assert = require("node:assert/strict");

const { parseCommand } = require("../../core/commandParser");
const { createMiscHandlers } = require("../../core/dispatcher/handlers/misc");
const { INTENTS } = require("../../core/intents");
const { ACTION_BUILDERS } = require("../../motions/actionBuilders");

function createDeps(overrides = {}) {
  const notifications = [];
  return {
    app: { quit: () => {} },
    notifications,
    notificationsService: {
      notify(entry) {
        notifications.push(entry);
      },
    },
    ...overrides,
  };
}

test("password manager command aliases parse to intent", () => {
  assert.deepEqual(parseCommand("password-manager"), {
    type: INTENTS.PASSWORD_MANAGER_OPEN,
  });
  assert.deepEqual(parseCommand("pm"), {
    type: INTENTS.PASSWORD_MANAGER_OPEN,
  });
});

test("password manager action builder returns intent", () => {
  assert.deepEqual(ACTION_BUILDERS.password_manager_open({}, 1), {
    type: INTENTS.PASSWORD_MANAGER_OPEN,
  });
});

test("password manager dispatcher opens service when available", async () => {
  let openCount = 0;
  const deps = createDeps({
    passwordManagerService: {
      getStatus: () => ({ canOpen: true, state: "loaded", label: "Bitwarden" }),
      open: async () => {
        openCount += 1;
        return { canOpen: true, state: "loaded", label: "Bitwarden" };
      },
    },
  });
  const handlers = createMiscHandlers(deps);

  await handlers[INTENTS.PASSWORD_MANAGER_OPEN]({
    win: null,
    intent: { type: INTENTS.PASSWORD_MANAGER_OPEN },
    state: {},
  });

  assert.equal(openCount, 1);
  assert.equal(deps.notifications.length, 0);
});

test("password manager dispatcher reports disabled state", async () => {
  let openCount = 0;
  const deps = createDeps({
    passwordManagerService: {
      getStatus: () => ({
        canOpen: false,
        state: "disabled",
        label: "Password manager",
      }),
      open: async () => {
        openCount += 1;
      },
    },
  });
  const handlers = createMiscHandlers(deps);

  await handlers[INTENTS.PASSWORD_MANAGER_OPEN]({
    win: null,
    intent: { type: INTENTS.PASSWORD_MANAGER_OPEN },
    state: {},
  });

  assert.equal(openCount, 0);
  assert.equal(deps.notifications.at(-1).code, "password_manager_unavailable");
  assert.equal(deps.notifications.at(-1).message, "Password manager is disabled.");
});

test("password manager dispatcher reports open failure", async () => {
  const deps = createDeps({
    passwordManagerService: {
      getStatus: () => ({ canOpen: true, state: "loaded", label: "Bitwarden" }),
      open: async () => {
        throw new Error("popup failed");
      },
    },
  });
  const handlers = createMiscHandlers(deps);

  await handlers[INTENTS.PASSWORD_MANAGER_OPEN]({
    win: null,
    intent: { type: INTENTS.PASSWORD_MANAGER_OPEN },
    state: {},
  });

  assert.equal(deps.notifications.at(-1).code, "password_manager_open_failed");
  assert.equal(deps.notifications.at(-1).message, "popup failed");
});
