#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-${ROOT_DIR}}"
export COZE_WORKSPACE_PATH

cd "${COZE_WORKSPACE_PATH}"

echo "✅ 初始化完成"
