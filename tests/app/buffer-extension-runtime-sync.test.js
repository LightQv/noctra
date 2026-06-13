const test = require("node:test");
const assert = require("node:assert/strict");

const { BufferManager } = require("../../browser/manager");

function makeBuffer(id, tag) {
  return {
    id,
    tag,
    isEditable: false,
    kind: "web",
    webContents: {
      id,
      isDestroyed: () => false,
    },
    toJSON() {
      return { id, tag };
    },
  };
}

function makeRuntime() {
  return {
    registered: [],
    selected: [],
    removed: [],
    registerBuffer(buffer, windowRef) {
      this.registered.push({ buffer, windowRef });
      return true;
    },
    selectBuffer(buffer, windowRef) {
      this.selected.push({ buffer, windowRef });
      return true;
    },
    removeBuffer(buffer, windowRef) {
      this.removed.push({ buffer, windowRef });
      return true;
    },
  };
}

test("setExtensionRuntime registers existing buffers and selects active", () => {
  const manager = new BufferManager();
  const first = makeBuffer(1, "first");
  const second = makeBuffer(2, "second");
  const runtime = makeRuntime();
  manager.window = { id: 1 };
  manager.buffers = [first, second];
  manager.activeIndex = 1;

  manager.setExtensionRuntime(runtime);

  assert.deepEqual(
    runtime.registered.map((entry) => entry.buffer),
    [first, second],
  );
  assert.deepEqual(runtime.selected.map((entry) => entry.buffer), [second]);
});

test("active extension buffer follows right split source, not mirror pane", () => {
  const manager = new BufferManager();
  const left = makeBuffer(1, "left");
  const rightSource = makeBuffer(2, "right-source");
  const rightMirror = makeBuffer(99, "right-mirror");
  const runtime = makeRuntime();
  manager.window = { id: 1 };
  manager.buffers = [left, rightSource];
  manager.activeIndex = 0;
  manager.split.enabled = true;
  manager.split.mode = "regular";
  manager.split.rightPaneSourceBuffer = rightSource;
  manager.split.rightPaneBuffer = rightMirror;
  manager.focusedPane = "right";
  manager.setExtensionRuntime(runtime);
  runtime.selected.length = 0;

  manager.notify({ kind: "structure", activeChanged: true });

  assert.deepEqual(runtime.selected.map((entry) => entry.buffer), [rightSource]);
});

test("metadata notifications do not resync active extension buffer", () => {
  const manager = new BufferManager();
  const active = makeBuffer(1, "active");
  const runtime = makeRuntime();
  manager.window = { id: 1 };
  manager.buffers = [active];
  manager.activeIndex = 0;
  manager.setExtensionRuntime(runtime);
  runtime.selected.length = 0;

  manager.notify({ kind: "metadata", activeChanged: false });

  assert.deepEqual(runtime.selected, []);
});
