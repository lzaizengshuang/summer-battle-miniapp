#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "${COZE_TARO_LOCAL_ACTIVE:-}" != "${ROOT_DIR}" ]]; then
    exec node "$ROOT_DIR/.cozeproj/scripts/local-workspace.cjs" build "$@"
fi
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-${ROOT_DIR}}"
export COZE_WORKSPACE_PATH

cd "${COZE_WORKSPACE_PATH}"
if [ -f "./.cozeproj/scripts/init_env.sh" ]; then
    echo "⚙️ Initializing environment..."
    # 使用 bash 执行，确保即使没有 x 权限也能跑
    bash ./.cozeproj/scripts/init_env.sh
else
    echo "⚠️ Warning: init_env.sh not found, skipping environment init."
fi
echo "Installing dependencies..."
# 安装所有依赖（包含 Taro 核心和 React）
if [[ "${COZE_TARO_LOCAL_MIRROR:-}" != "1" ]]; then
    bash "$ROOT_DIR/.cozeproj/scripts/prepare-node-modules.sh" --prefer-frozen-lockfile --prefer-offline
fi

echo "Building the Taro project..."
pnpm build

echo "Build completed successfully! Assets are in /dist"
