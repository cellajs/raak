# CLAUDE.md

Primary agent guidelines for this repo live in @cella/AGENTS.md: read it.

## Before you finish
**Always run `pnpm check` at the repo root after any code change, and only report the work done once it passes clean.** It runs `sdk` regen + typecheck + `lint:fix` and is the single gate for whether a change is sound. Never claim a change is complete without a clean `pnpm check`; if it fails, fix it or say so explicitly.

## Comments: default to none
Add a comment ONLY to explain a *why* or a non-obvious constraint/consequence the code cannot show. Never restate what the code does. Test: if a competent reader could reconstruct the comment by reading the line, delete it. JSDoc stays on exports (one line). Density is not lintable, so this is on judgment, not CI.

Bad (restates the field):
```ts
// Make public (date) / make private (null): per-task visibility.
publicAt: z.string().nullable(),
```
Good:
```ts
publicAt: z.string().nullable(),
```
Keep (a non-obvious why the code cannot show):
```ts
stx: sql`stx - 'changedFields'`, // server-origin: CDC attributes the write from the WAL diff
```

## Route state in app modules
One way per question in `frontend/src/modules/{task,project,workspace,label}`. Upstream modules keep their own patterns.

- **A component under one route** reads it through `getRouteApi('<route id>')` with `select` (workspace: `workspaceRouteApi`).
- **A component shared by several routes** reads a search param with `useSearch({ strict: false, select: (search) => search.q })`: one call per param, a primitive back, no cast. An object-returning `select` re-renders on every URL write. `useSearchParams` is only for a component that also writes the param (search box, table sort): it re-renders on every search change, a task sheet opening included.
- **Which page it is on** comes from a prop, or from the active match where passing one down is impractical: `useIsWorkspaceRoute()`, or `useMatch({ from, shouldThrow: false, select })`. Never `useMatchRoute`: while a navigation commits it still tests the page being left.
- **A search write with several call sites** gets one helper (`task/helpers/board-navigation.ts`), so `replace` and `resetScroll` are decided once.
