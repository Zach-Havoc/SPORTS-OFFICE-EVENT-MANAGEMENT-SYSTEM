## graphify

This project has a code knowledge graph at graphify-out/ (see the `codebase-map` skill in .claude/skills/ for when and how to use it).

Rules:
- Before changing something many parts use (Event, Score, User, TeamMatch, apiRequest, hooks/api.ts, useAuth, a shared component or util), run `graphify explain "<Name>"` to see what depends on it. Use `graphify path "<A>" "<B>"` to trace how two parts connect.
- The graph resolves TypeScript calls but not PHP method calls (`$x->method()`): for "who calls this PHP method", grep after locating the class in the graph.
- It shows structure, not behaviour — read the code before reasoning about logic.
- For an edit whose file is already known, go straight to it; the graph isn't needed.
- A post-commit hook rebuilds the graph in the background. For uncommitted work or after changing .graphifyignore, run `graphify update .` (add `--force` if the graph shrank).
