---
name: codebase-map
description: Use the graphify knowledge graph of SportsAxis (graphify-out/) to check what a change will affect before editing a widely-used piece (Event, Score, User, TeamMatch, apiRequest, hooks/api.ts, useAuth, a shared component or util), to orient in an unfamiliar area, to trace how two parts connect, or to answer "what calls / imports / depends on X". Also for refreshing the graph and producing architecture material for the capstone paper. Not needed for an edit whose file you already know.
---

# Codebase map (graphify) — how to use it in SportsAxis

The repo has a code knowledge graph in `graphify-out/` (git-ignored, built
locally). ~4,400 nodes: files, classes, functions, components; edges:
imports, calls, extends, method-of, contains. Scope is the app — web,
backend, mobile, OCR service — `.graphifyignore` keeps tooling out.

## When to reach for it

| Situation | Command |
|---|---|
| About to change something many parts use (model, API helper, hook, shared component) | `graphify explain "<Name>"` — every importer/caller, with file:line |
| "How does A reach B?" (e.g. live score → head-to-head record) | `graphify path "<A>" "<B>"` |
| First time in an area of the code | `graphify explain` on its main class/component, then read only the files it lists |
| Broad architecture question | `graphify query "<question>" --budget 1500` — broad (BFS), expect noise |
| Big-picture review | `graphify-out/GRAPH_REPORT.md` (god nodes, surprising connections, import cycles) |

Names: classes/components by name (`TryoutController`, `GameCard`), functions
and methods with parentheses (`scoreboardFor()`, `.isScorableBy()`).

Skip it when the file and line are already known — a direct edit or a
targeted grep is faster, and the Grep hook's reminder can be ignored then.

## What it can and can't see — verify accordingly

- **TypeScript / React (web + mobile): reliable.** Imports and function /
  component calls are resolved to the calling line. `explain` gives a true
  "who uses this" list.
- **PHP: classes, imports, routes, inheritance — yes. Method calls — NO.**
  `$event->isScorableBy()` from ScoreController is not an edge; the graph
  shows `.isScorableBy()` with no callers. For "who calls this PHP method",
  **grep** (`->isScorableBy(`, `::recalculateRankings(`) after using the
  graph to find the class.
- **Structure, not behaviour.** It says `updateStatus()` calls
  `addToRoster()`, not what either decides. Read the code for logic and bugs.
- **Staleness.** Check `GRAPH_REPORT.md` → "Built from commit" against
  `git rev-parse --short HEAD`. A post-commit git hook rebuilds it in the
  background after every commit; uncommitted edits aren't in it yet.

## Keeping it current

- Automatic: `.git/hooks/post-commit` (installed by `graphify hook install`)
  rebuilds in the background after each commit — commits aren't slowed.
- Manual: `graphify update .` (~15 s, no API cost). After changing
  `.graphifyignore`, or when the map shrinks after deletions:
  `graphify update . --force`.

## Capstone paper / documentation

- `graphify export wiki` → `graphify-out/wiki/` (one article per cluster;
  `index.md` is the entry point) — raw material for a technical appendix.
- `graphify export callflow-html` → Mermaid call-flow diagrams per cluster.
- `graphify-out/graph.html` → interactive map to explore / screenshot.
- `graphify export svg` → whole-graph SVG (~13 MB, 2–3 min; too dense to use
  as a figure as-is).

Honest caveat: clusters are named after files/libraries (`cn`, `lucide-react`,
`hooks/api.ts`) and several call-flow section titles come from graphify's
generic template, so none of this is figure-ready. Use it to find the real
module boundaries and flows, then draw the paper's diagrams from that.

## Setup on another machine

```
uv tool install "graphifyy[sql]" --with matplotlib --with scipy
graphify update .
graphify hook install
```
