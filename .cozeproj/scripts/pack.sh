#!/bin/bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "${COZE_TARO_LOCAL_ACTIVE:-}" != "${ROOT_DIR}" ]]; then
    exec node "$ROOT_DIR/.cozeproj/scripts/local-workspace.cjs" pack "$@"
fi
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-${ROOT_DIR}}"
export COZE_WORKSPACE_PATH

cd "${COZE_WORKSPACE_PATH}"

LOG_DIR="${COZE_LOG_DIR:-/tmp}"
mkdir -p "$LOG_DIR"
PID_FILE="$LOG_DIR/coze-build_weapp.pid"

# 杀掉上次的构建进程组
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        echo "正在终止上次的构建进程组 (PID: $OLD_PID)..."
        # 关键：kill 负数 PID = 杀掉整个进程组
        kill -9 -"$OLD_PID" 2>/dev/null
        sleep 1
    fi
    rm -f "$PID_FILE"
fi

# 用 setsid 创建新的进程组，方便下次整组杀掉；无 setsid 的环境退化为普通后台进程。
if command -v setsid >/dev/null 2>&1; then
    setsid pnpm build:pack &
else
    pnpm build:pack &
fi
BUILD_PID=$!
echo "$BUILD_PID" > "$PID_FILE"

echo "构建已启动 (PID: $(cat $PID_FILE))"

wait "$BUILD_PID"
rm -f "$PID_FILE"
