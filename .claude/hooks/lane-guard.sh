#!/usr/bin/env bash
# PreToolUse guard: keep the frontend-dev / backend-dev / qa-tester agents in their lanes.
#
# Reads the hook payload on stdin. Allows (exit 0) whenever it cannot positively
# identify one of the three lane agents, so the main session and every other agent
# are unaffected. Denies only the mechanical, unambiguous boundaries — the nuanced
# rules (who owns which test file) stay in the agent briefs.

set -uo pipefail

# Resolve the repo root independently of where the script is invoked from, and of
# whether it was reached through a symlink.
REPO="$(git -C "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" rev-parse --show-toplevel 2>/dev/null)"
[ -z "$REPO" ] && REPO="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../.." && pwd)"
DEBUG_LOG="$REPO/.claude/hooks/lane-guard-unknown.log"

payload="$(cat)"

# The field carrying the subagent identity has varied across Claude Code versions,
# so check every plausible spelling in the JSON, then the environment.
agent="$(printf '%s' "$payload" | jq -r '
  [ .agent_type, .subagent_type, .agentType, .subagentType,
    .agent_name, .agentName, .agent, .subagent ]
  | map(select(type == "string" and . != ""))
  | first // ""' 2>/dev/null)"

if [ -z "$agent" ]; then
  agent="${CLAUDE_AGENT_TYPE:-${CLAUDE_SUBAGENT_TYPE:-${CLAUDE_AGENT_NAME:-}}}"
fi

case "$agent" in
  planner|frontend-dev|backend-dev|qa-tester) ;;
  "")
    # Unidentified caller: allow, but record one sample so the identity field can be
    # confirmed. Only the key names are logged, never file contents.
    if [ ! -f "$DEBUG_LOG" ]; then
      printf '%s json_keys=%s env=%s\n' \
        "$(date -Is)" \
        "$(printf '%s' "$payload" | jq -rc 'keys' 2>/dev/null)" \
        "$(env | grep -i '^CLAUDE' | cut -d= -f1 | tr '\n' ',')" \
        >> "$DEBUG_LOG" 2>/dev/null
    fi
    exit 0
    ;;
  *) exit 0 ;;
esac

file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // ""' 2>/dev/null)"
[ -z "$file" ] && exit 0

# Repo-relative path; a file outside the repo (e.g. a scratchpad) is left alone.
case "$file" in
  "$REPO"/*) rel="${file#"$REPO"/}" ;;
  /*) exit 0 ;;
  *) rel="$file" ;;
esac

deny() {
  jq -nc --arg r "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $r
    }
  }'
  exit 0
}

# Nobody in the team rewrites the team's own configuration.
case "$rel" in
  .claude/*)
    deny "Lane guard: $agent may not edit $rel. Agent definitions, hooks and settings are the main session's to change. Report what you need instead."
    ;;
esac

# Plans belong to the planner; the implementers read them and report against them.
if [ "$agent" != "planner" ]; then
  case "$rel" in
    docs/plans/*)
      deny "Lane guard: $agent may not edit $rel. Plans belong to the planner. If the plan is wrong, say so in your report rather than rewriting it."
      ;;
  esac
fi

case "$agent" in
  planner)
    # The planner writes plans and nothing else.
    case "$rel" in
      docs/plans/*) ;;
      *)
        deny "Lane guard: planner may not edit $rel — the planner writes plans, not code. Allowed: docs/plans/**. Put the change in the plan and assign it to backend-dev, frontend-dev or qa-tester."
        ;;
    esac
    ;;

  frontend-dev)
    case "$rel" in
      SportAxisWeb/backend/*)
        deny "Lane guard: frontend-dev may not edit $rel. The Laravel backend belongs to backend-dev. Finish the client-side work and report the API change you need (route, method, request body, response shape)."
        ;;
    esac
    ;;

  backend-dev)
    case "$rel" in
      SportAxisWeb/src/*|SportAxisApp/*)
        deny "Lane guard: backend-dev may not edit $rel. The React and Expo clients belong to frontend-dev. Report the contract delta instead and let the frontend apply it."
        ;;
    esac
    ;;

  qa-tester)
    # QA writes tests and nothing else.
    case "$rel" in
      SportAxisWeb/backend/tests/*) ;;
      SportAxisWeb/src/test/*) ;;
      *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) ;;
      *__tests__/*) ;;
      *)
        deny "Lane guard: qa-tester may not edit $rel — QA writes tests, not fixes. Allowed: SportAxisWeb/backend/tests/**, SportAxisWeb/src/test/**, *.test.ts(x), *.spec.ts(x), **/__tests__/**. Report this as a defect (file, line, trigger) and hand it to frontend-dev or backend-dev."
        ;;
    esac
    ;;
esac

exit 0
