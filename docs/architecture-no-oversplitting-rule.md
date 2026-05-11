# Architecture Rule: No Over-Splitting

Use this rule to keep the codebase modular without making flow hard to follow.

## Core Principle

Keep workflow logic readable in one place. Extract infrastructure and cross-cutting mechanics, not every small block.

## Required Boundaries

- Keep manager files as public API and orchestration entry points.
- Keep domain behavior in domain services (`bufferLifecycleService`, `overlayLifecycle`, etc.).
- Keep platform-specific calls in adapter modules.
- Keep modal state writes in ownership modules from `docs/state-ownership-map.md`.

## Do Not Split Further When

- A method is small (about 40 lines or less), single-purpose, and only used once.
- Extraction would force readers to jump across many files to understand one user action.
- The helper would become a vague generic utility with unclear ownership.

## Split When

- Logic is reused by multiple call sites.
- The same event wiring or transition boilerplate repeats.
- A method mixes concerns (UI + policy + persistence + IPC in one place).
- Platform adapter calls leak into non-adapter modules.

## Practical Limits

- Prefer a 3-level depth: manager -> domain service -> adapter.
- Avoid adding extra indirection layers unless there is measurable benefit.
- Prefer explicit domain names over generic `utils` modules.

## Review Checklist

- Can a contributor follow one user action without opening many files?
- Are responsibilities obvious from file/module names?
- Did we reduce duplication or just move code around?
- Did we preserve state ownership and adapter boundaries?
