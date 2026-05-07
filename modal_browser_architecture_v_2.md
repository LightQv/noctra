# Modal Browser Architecture v2

## Core Principle

Everything begins with a keystroke.
Everything ends with an application action.

The system is not:

```txt
key -> behavior
```

It is:

```txt
key
 -> interpretation layers
 -> semantic intent
 -> application action
```

---

# High-Level Tree

```txt
Application
│
├── Input Layer
│   └── Keystroke
│
├── Priority Resolver
│   ├── Global shortcuts
│   ├── System locks
│   └── Emergency overrides
│
├── Focus Layer
│   ├── Main viewport
│   ├── Side panel
│   ├── Prompt
│   ├── Floating modal
│   └── Future overlays
│
├── Context Layer
│   ├── Web
│   ├── History
│   ├── Bookmarks
│   ├── Editor
│   ├── Tabs
│   └── Future modules
│
├── Mode Layer
│   ├── NORMAL
│   ├── INSERT
│   ├── VISUAL
│   ├── COMMAND
│   ├── OPERATOR_PENDING
│   └── LEADER
│
├── Grammar Layer
│   ├── Operators
│   ├── Motions
│   ├── Text objects
│   ├── Counts
│   ├── Sequences
│   └── Modifiers
│
├── Intent Layer
│   ├── DELETE
│   ├── MOVE
│   ├── OPEN
│   ├── CLOSE
│   ├── SPLIT
│   ├── SEARCH
│   └── UI actions
│
├── Action Dispatcher
│   ├── Browser actions
│   ├── UI actions
│   ├── State mutations
│   └── Electron/platform actions
│
└── Renderer
    ├── Chromium
    ├── UI overlay
    ├── Panels
    └── Window system
```

---

# Correct Mental Model

## Focus

Focus answers:

```txt
Where is the user interacting?
```

Examples:

- main viewport
- sidebar
- command prompt
- popup

Focus determines:

```txt
which subtree receives input
```

---

## Context

Context answers:

```txt
What kind of object is active?
```

Examples:

| Context | Semantic object |
|---|---|
| Web | browser page |
| History | history entries |
| Bookmarks | bookmarks |
| Editor | editable text |
| Tabs | buffers/tabs |

Contexts should expose semantic capabilities.

NOT raw keybindings.

Correct:

```js
historyContext = {
  delete(target),
  open(target),
  select(target)
}
```

Wrong:

```js
historyContext = {
  d: ..., 
  x: ...
}
```

Contexts define:

```txt
what can be done
```

not:

```txt
which key does it
```

---

## Modes

Modes answer:

```txt
How should input be interpreted?
```

Examples:

| Mode | Meaning |
|---|---|
| NORMAL | motions/operators |
| INSERT | raw text input |
| COMMAND | command line |
| VISUAL | range selection |
| LEADER | namespace mode |

Modes are interpretation systems.

Not application states.

---

# Grammar Layer

This is the real Vim-like engine.

The grammar layer composes:

```txt
operator + motion + count
```

Examples:

| Sequence | Meaning |
|---|---|
| d2j | delete target spanning 2 downward motions |
| dG | delete until end |
| gg | move to start |
| 5j | move down 5 |

Important:

Motions do NOT execute actions directly.

They define:

```txt
targets
ranges
movements
```

Operators consume targets.

---

# Example Resolution Flow

Input:

```txt
d2j
```

Pipeline:

```txt
Keystroke
↓
Focus Resolver
↓
Sidebar focused
↓
Context Resolver
↓
History context
↓
Mode Resolver
↓
NORMAL mode
↓
Grammar Layer
↓
operator = delete
motion = 2j
↓
target range resolved
↓
Intent
↓
DELETE_HISTORY_ITEMS
↓
Dispatcher
↓
UI update
```

---

# Key Categories

Keys should be categorized by interpretation priority.

## 1. Global

Highest priority.

Examples:

- Ctrl+Q
- Ctrl+W
- Escape emergency close

These bypass context resolution.

---

## 2. Mode Grammar

Core modal system.

Examples:

- hjkl
- gg
- G
- d
- y
- counts

Handled by grammar layer.

---

## 3. Leader Namespace

Application-level modal commands.

Examples:

- <leader>sf
- <leader>bh
- <leader>tt

Used for:

- layouts
- tabs
- UI toggles
- app workflows

Leader is NOT a motion system.

It is a namespace router.

---

## 4. Command Mode

Text command subsystem.

Examples:

- :open
- :tabnew
- :split

This is a line-editor subsystem.

Not motion parsing.

---

# Correct Architectural Rules

## Rule 1

```txt
Input never directly mutates UI.
```

Always:

```txt
Input -> intent -> dispatcher -> renderer
```

---

## Rule 2

```txt
Contexts expose semantics.
Modes expose interpretation.
```

Never invert them.

---

## Rule 3

```txt
Motions never execute.
```

Motions only:

- move
- define ranges
- define targets

Operators/actions execute.

---

## Rule 4

```txt
Focus decides ownership.
```

Only one subtree owns input at a time.

---

## Rule 5

```txt
Everything resolves downward.
```

Never upward.

Correct:

```txt
key
 -> focus
 -> context
 -> mode
 -> grammar
 -> intent
 -> action
```

Wrong:

```txt
mode directly overrides context
```

That creates unstable priority systems.

---

# Suggested Runtime Modules

```txt
src/
│
├── input/
│   ├── keystroke.js
│   ├── resolver.js
│   ├── focusResolver.js
│   └── priorityResolver.js
│
├── modes/
│   ├── normal/
│   ├── insert/
│   ├── command/
│   ├── visual/
│   └── leader/
│
├── grammar/
│   ├── motions/
│   ├── operators/
│   ├── textObjects/
│   ├── counts/
│   └── parser.js
│
├── contexts/
│   ├── web/
│   ├── history/
│   ├── bookmarks/
│   ├── editor/
│   └── tabs/
│
├── intents/
│   └── definitions.js
│
├── dispatcher/
│   └── dispatcher.js
│
├── renderer/
│   ├── overlays/
│   ├── panels/
│   └── splits/
│
└── platform/
    └── electron/
```

---

# Final Principle

The application should behave like:

```txt
a modal operating shell over browsing contexts
```

Not:

```txt
a browser with vim shortcuts
```

That distinction determines whether the architecture remains coherent as complexity grows.