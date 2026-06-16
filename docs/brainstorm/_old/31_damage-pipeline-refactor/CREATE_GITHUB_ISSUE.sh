#!/usr/bin/env bash
set -euo pipefail

# Run this from an authenticated local checkout of:
# https://github.com/tabesink/analysis-dashboard-v2

TITLE="Simplify damage pipeline: schedule upload triggers calculation; Inspect Damage becomes read-only"
BODY_FILE="GITHUB_ISSUE_BODY.md"
LABEL="needs-triage"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is not installed. Install GitHub CLI first." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh CLI is not authenticated. Run: gh auth login" >&2
  exit 1
fi

gh issue create \
  --title "$TITLE" \
  --body-file "$BODY_FILE" \
  --label "$LABEL"
