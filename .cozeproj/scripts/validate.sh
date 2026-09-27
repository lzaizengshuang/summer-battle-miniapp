#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "${COZE_TARO_LOCAL_ACTIVE:-}" != "${ROOT_DIR}" ]]; then
    exec node "$ROOT_DIR/.cozeproj/scripts/local-workspace.cjs" validate "$@"
fi
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-${ROOT_DIR}}"
export COZE_WORKSPACE_PATH

cd "${COZE_WORKSPACE_PATH}"

echo "🔍 Running validate..."
pnpm validate
echo "✅ Validate passed!"
