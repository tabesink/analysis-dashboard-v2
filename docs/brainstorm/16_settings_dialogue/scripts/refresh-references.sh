#!/usr/bin/env bash
# Refresh local reference copies from live source trees.
# Run from repo root: bash docs/brainstorm/16_settings_dialogue/scripts/refresh-references.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
REF_SRC="$ROOT/.references/context-engine-ui"
REF_DEST="$ROOT/docs/brainstorm/16_settings_dialogue/reference/context-engine-ui"
DASH_DEST="$ROOT/docs/brainstorm/16_settings_dialogue/reference/dashboard"

if [[ ! -d "$REF_SRC" ]]; then
  echo "Missing reference tree: $REF_SRC" >&2
  exit 1
fi

mkdir -p \
  "$REF_DEST/stores" \
  "$REF_DEST/types" \
  "$REF_DEST/lib/api" \
  "$REF_DEST/components/settings/panels" \
  "$REF_DEST/components/layout" \
  "$REF_DEST/components/ui" \
  "$REF_DEST/app" \
  "$DASH_DEST/client/src/app/settings/users" \
  "$DASH_DEST/client/src/components/layout" \
  "$DASH_DEST/client/src/app"

# Context Engine UI — settings dialog core
cp "$REF_SRC/stores/settings-dialog-store.ts" "$REF_DEST/stores/"
cp "$REF_SRC/stores/auth-store.ts" "$REF_DEST/stores/"
cp "$REF_SRC/components/settings/SettingsDialog.tsx" "$REF_DEST/components/settings/"
cp "$REF_SRC/components/settings/panels/GeneralSettingsPanel.tsx" "$REF_DEST/components/settings/panels/"
cp "$REF_SRC/components/settings/panels/AccountSettingsPanel.tsx" "$REF_DEST/components/settings/panels/"
cp "$REF_SRC/components/settings/panels/KnowledgeGraphSettingsPanel.tsx" "$REF_DEST/components/settings/panels/"
cp "$REF_SRC/components/settings/panels/AIModelSettingsPanel.tsx" "$REF_DEST/components/settings/panels/"
cp "$REF_SRC/components/settings/panels/AIModelSettingsPanel.test.tsx" "$REF_DEST/components/settings/panels/"
cp "$REF_SRC/components/settings/panels/DocumentsSettingsPanel.tsx" "$REF_DEST/components/settings/panels/"

# Integration
cp "$REF_SRC/components/layout/AppSideRail.tsx" "$REF_DEST/components/layout/"
cp "$REF_SRC/components/layout/AppSideRail.test.tsx" "$REF_DEST/components/layout/"
cp "$REF_SRC/app/providers.tsx" "$REF_DEST/app/"
cp "$REF_SRC/app/globals.css" "$REF_DEST/app/"

# Supporting
cp "$REF_SRC/types/user.ts" "$REF_DEST/types/"
cp "$REF_SRC/lib/api/users.ts" "$REF_DEST/lib/api/"
cp "$REF_SRC/lib/utils.ts" "$REF_DEST/lib/utils.ts"

# UI primitives
for f in button dialog badge alert-dialog input label select table dropdown-menu card switch; do
  cp "$REF_SRC/components/ui/${f}.tsx" "$REF_DEST/components/ui/"
done

# Dashboard snapshots
cp "$ROOT/client/src/app/settings/users/page.tsx" "$DASH_DEST/client/src/app/settings/users/"
cp "$ROOT/client/src/components/layout/AppSidebar.tsx" "$DASH_DEST/client/src/components/layout/"
cp "$ROOT/client/src/app/providers.tsx" "$DASH_DEST/client/src/app/"

echo "References refreshed:"
echo "  $REF_DEST"
echo "  $DASH_DEST"
