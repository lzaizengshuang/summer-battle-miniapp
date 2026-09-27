#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "${COZE_TARO_LOCAL_ACTIVE:-}" != "${ROOT_DIR}" ]]; then
  exec node "$ROOT_DIR/.cozeproj/scripts/local-workspace.cjs" prepare "$@"
fi
COZE_WORKSPACE_PATH="${ROOT_DIR}"
export COZE_WORKSPACE_PATH

cd "${COZE_WORKSPACE_PATH}"
if [[ "${COZE_TARO_LOCAL_MIRROR:-}" != "1" ]]; then
    bash "$ROOT_DIR/.cozeproj/scripts/prepare-node-modules.sh" --prefer-frozen-lockfile --prefer-offline
fi
