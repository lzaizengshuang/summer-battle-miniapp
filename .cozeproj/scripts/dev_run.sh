#!/bin/bash
echo "⚙️ dev_run.sh 开始运行"
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "${COZE_TARO_LOCAL_ACTIVE:-}" != "${ROOT_DIR}" ]]; then
    exec node "$ROOT_DIR/.cozeproj/scripts/local-workspace.cjs" dev "$@"
fi
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-${ROOT_DIR}}"
export COZE_WORKSPACE_PATH
cd "${COZE_WORKSPACE_PATH}"

# ---------------------------------------------------------
# 项目级日志目录
# ---------------------------------------------------------
LOG_DIR="${COZE_LOG_DIR:-${COZE_WORKSPACE_PATH}/logs}"
LOG_FILE="${LOG_DIR}/dev.log"
PID_FILE="${LOG_DIR}/dev.pid"
DEV_PID=""

# ---------------------------------------------------------
# 工具函数
# ---------------------------------------------------------
kill_process_tree() {
    local pid=$1
    local children
    children=$(pgrep -P "${pid}" 2>/dev/null || true)
    for child in ${children}; do
        kill_process_tree "${child}"
    done
    if kill -0 "${pid}" 2>/dev/null; then
        echo "Killing PID ${pid}"
        kill -9 "${pid}" 2>/dev/null || true
    fi
}

# detached 出去的进程没人负责回收，超过这个时长就自己退出，避免端口与内存长期泄露。
MAX_RUNTIME_SECONDS=3600

timeout_watchdog_enabled() {
    [[ -z "${COZE_EVAL:-}" && -z "${COZE_PROJECT_TYPE:-}" ]]
}

# 真正被 detach 的是这层 bash wrapper：它是进程组 leader，组内 watchdog 到点回收整组
# （wrapper -> pnpm -> taro/nest）；被包的进程自己先退出时也顺手清空进程组，不留残余。
RUN_WITH_TIMEOUT="$(declare -f timeout_watchdog_enabled)"'
timeout_seconds=$1
shift

"$@" &
child_pid=$!

# 先忽略 TERM，才能在向整组发 TERM（自己也在组里）之后存活下来补一发 KILL。
if timeout_watchdog_enabled; then
( trap "" TERM
  sleep "${timeout_seconds}"
  echo "[dev] 后台进程运行超过 ${timeout_seconds}s，回收进程组 $$。"
  kill -TERM -- "-$$" 2>/dev/null || true
  sleep 5
  kill -KILL -- "-$$" 2>/dev/null || true
) &
fi

wait "${child_pid}"
kill -KILL -- "-$$" 2>/dev/null || true
'

# coze-daemon 会在 runtime shell 退出时清理原进程组。
# 通过 Node detached spawn 创建独立 session/进程组，并将 stdio 直接写入日志。
# 返回的 PID 是 wrapper 的，同时也是整个进程组的 PGID，后续按组回收。
spawn_detached() {
    local cwd="$1"
    local log_file="$2"
    shift 2

    node - "$cwd" "$log_file" \
        /bin/bash -c "${RUN_WITH_TIMEOUT}" detached-runner "${MAX_RUNTIME_SECONDS}" "$@" <<'NODE'
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const [cwd, logFile, command, ...args] = process.argv.slice(2);
if (!cwd || !logFile || !command) {
  throw new Error('spawn_detached 缺少 cwd、log_file 或 command');
}

const logFd = fs.openSync(logFile, 'a');
try {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    env: process.env,
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  process.stdout.write(String(child.pid));
} finally {
  fs.closeSync(logFd);
}
NODE
}

stop_detached() {
    local pid="${1:-}"
    if [[ -z "${pid}" ]]; then
        return
    fi

    kill -TERM -- "-${pid}" 2>/dev/null || kill -TERM "${pid}" 2>/dev/null || true
    sleep 1
    kill -KILL -- "-${pid}" 2>/dev/null || true
}

process_belongs_to_workspace() {
    local pid=$1
    local cwd=""

    if [[ -L "/proc/${pid}/cwd" ]]; then
        cwd=$(readlink "/proc/${pid}/cwd" 2>/dev/null || true)
    elif command -v lsof >/dev/null 2>&1; then
        cwd=$(lsof -a -p "${pid}" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
    fi

    case "${cwd}" in
        "${COZE_WORKSPACE_PATH}"|"${COZE_WORKSPACE_PATH}"/*) return 0 ;;
    esac

    if [[ -n "${COZE_TARO_SOURCE_PATH:-}" ]]; then
        case "${cwd}" in
            "${COZE_TARO_SOURCE_PATH}"|"${COZE_TARO_SOURCE_PATH}"/*) return 0 ;;
        esac
    fi

    return 1
}

process_group_belongs_to_workspace() {
    local pgid=$1
    local pids
    local found=0

    pids=$(ps -axo pid=,pgid= 2>/dev/null | awk -v pgid="${pgid}" '$2 == pgid {print $1}')
    for pid in ${pids}; do
        found=1
        if ! process_belongs_to_workspace "${pid}"; then
            return 1
        fi
    done

    [[ "${found}" -eq 1 ]]
}

# 优先用 ss，无结果或缺少 ss 时回落到 lsof；两者都不可用则显式告警，避免静默误判为端口空闲
list_port_pids() {
    local port=$1
    local pids=""
    local has_tool=0

    if command -v ss >/dev/null 2>&1; then
        has_tool=1
        pids=$(ss -H -lntp 2>/dev/null | awk -v port="${port}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u | paste -sd' ' - || true)
    fi
    if [[ -z "${pids}" ]] && command -v lsof >/dev/null 2>&1; then
        has_tool=1
        pids=$(lsof -t -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null | sort -u | paste -sd' ' - || true)
    fi
    if [[ "${has_tool}" -eq 0 ]]; then
        echo "Warning: neither ss nor lsof available, cannot inspect port ${port}." >&2
    fi

    echo "${pids}"
}

kill_port_if_listening() {
    local port=$1
    # 用于错误提示的端口环境变量名称，例如 DEPLOY_RUN_PORT 或 SERVER_PORT。
    local port_env_name=$2
    local pids
    local pid
    pids=$(list_port_pids "${port}")
    if [[ -z "${pids}" ]]; then
        echo "Port ${port} is free."
        return
    fi

    # 端口可能由另一个项目占用。必须在杀进程前校验全部 PID，避免清理到一半才发现外部进程。
    for pid in ${pids}; do
        if ! process_belongs_to_workspace "${pid}"; then
            echo "Error: port ${port} is occupied by PID ${pid}, which does not belong to workspace ${COZE_WORKSPACE_PATH}. Refusing to kill it. Set ${port_env_name} to another port and retry." >&2
            return 1
        fi
    done

    echo "Port ${port} in use by PIDs: ${pids} (SIGKILL)"
    for pid in ${pids}; do
        kill_process_tree "${pid}"
    done
    sleep 1
    pids=$(list_port_pids "${port}")
    if [[ -n "${pids}" ]]; then
        echo "Error: port ${port} is still occupied after cleaning up this project's processes, PIDs: ${pids}. Check the remaining processes manually or set ${port_env_name} to another port and retry." >&2
        return 1
    else
        echo "Port ${port} cleared."
    fi
}

# 只清理当前项目上次记录的 detached 进程。
cleanup_previous_run() {
    if [[ ! -f "${PID_FILE}" ]]; then
        return
    fi

    local old_pid
    old_pid=$(cat "${PID_FILE}" 2>/dev/null || true)
    if [[ "${old_pid}" =~ ^[1-9][0-9]*$ ]] && process_group_belongs_to_workspace "${old_pid}"; then
        echo "🧹 Killing previous dev process group (PGID: ${old_pid})..."
        stop_detached "${old_pid}"
    fi
    rm -f "${PID_FILE}"
}

# ---------------------------------------------------------
# 2. 安装依赖
# ---------------------------------------------------------
echo "📦 Installing dependencies..."
PNPM_BIN="$(command -v pnpm)"
if [[ "${COZE_TARO_LOCAL_MIRROR:-}" != "1" ]]; then
    bash "$ROOT_DIR/.cozeproj/scripts/prepare-node-modules.sh" --prefer-frozen-lockfile --prefer-offline
fi
echo "✅ Dependencies installed successfully!"

# ---------------------------------------------------------
# 3. 清理旧进程 + 端口
# ---------------------------------------------------------
# DEPLOY_RUN_PORT 是平台注入的对外端口，项目内统一使用 PORT。
PORT="${DEPLOY_RUN_PORT:-${PORT:-5000}}"
SERVER_PORT="${SERVER_PORT:-3000}"
export PORT
export SERVER_PORT

mkdir -p "${LOG_DIR}"
cleanup_previous_run

echo "Clearing port ${PORT} (web) before start."
kill_port_if_listening "${PORT}" "DEPLOY_RUN_PORT"
echo "Clearing port ${SERVER_PORT} (server) before start."
kill_port_if_listening "${SERVER_PORT}" "SERVER_PORT"

# ---------------------------------------------------------
# 4. 启动服务
# ---------------------------------------------------------
start_service() {
    cd "${COZE_WORKSPACE_PATH}"

    # 动态注入环境变量
    if [ -n "${COZE_PROJECT_DOMAIN_DEFAULT:-}" ]; then
        export PROJECT_DOMAIN="$COZE_PROJECT_DOMAIN_DEFAULT"
        echo "✅ 环境变量已动态注入: PROJECT_DOMAIN=$PROJECT_DOMAIN"
    else
        echo "⚠️  警告: COZE_PROJECT_DOMAIN_DEFAULT 未设置，使用 .env.local 中的配置"
    fi

    # 启动 Taro H5 和 NestJS Server
    echo "Starting Taro H5 Dev Server and NestJS Server..."

    : > "${LOG_FILE}"

    DEV_PID="$(spawn_detached \
        "${COZE_WORKSPACE_PATH}" \
        "${LOG_FILE}" \
        "$(command -v node)" "$ROOT_DIR/.cozeproj/scripts/local-workspace.cjs" watch "${PNPM_BIN}" dev)"
    if [[ -z "${DEV_PID}" ]]; then
        echo "❌ 无法获取 dev 后台进程 PID"
        return 1
    fi
    echo "${DEV_PID}" > "${PID_FILE}"

    sleep 1
    if ! kill -0 "${DEV_PID}" 2>/dev/null; then
        echo "❌ Dev service failed to start. See ${LOG_FILE}." >&2
        tail -n 20 "${LOG_FILE}" >&2 || true
        rm -f "${PID_FILE}"
        return 1
    fi

    echo "📝 Dev process started with PID: ${DEV_PID}"
    if timeout_watchdog_enabled; then
        echo "Auto stop after ${MAX_RUNTIME_SECONDS}s."
    fi
    echo "Log file: ${LOG_FILE}"
    echo "PID file: ${PID_FILE}"
}

warmup_preview() {
    local base="http://127.0.0.1:${PORT}"
    local waited=0

    if ! command -v curl >/dev/null 2>&1; then
        echo "Warmup skipped: curl is not available."
        return 0
    fi

    echo "🔥 Warmup: waiting for web server to accept connections..."
    while (( waited < 60 )); do
        if curl -s -o /dev/null --max-time 3 "${base}/"; then
            break
        fi
        sleep 2
        waited=$(( waited + 2 ))
    done

    local app_config="${COZE_WORKSPACE_PATH}/src/app.config.ts"
    local pages=""
    if [[ -f "${app_config}" ]]; then
        pages=$(grep -oE "[\"']pages/[^\"']+[\"']" "${app_config}" | tr -d "\"'" | sort -u || true)
    fi

    local p
    for p in "/" "/app.config.ts"; do
        echo "🔥 Warmup ${p}"
        curl -s -o /dev/null --max-time 300 "${base}${p}" || echo "Warmup ${p} timed out or failed (ignored)."
    done
    for p in ${pages}; do
        echo "🔥 Warmup /${p}.tsx"
        curl -s -o /dev/null --max-time 300 "${base}/${p}.tsx" || echo "Warmup /${p}.tsx timed out or failed (ignored)."
    done
}

echo "Starting HTTP services on port ${PORT} (web) and ${SERVER_PORT} (server)..."
start_service

if [[ "${COZE_TARO_LOCAL_MIRROR:-}" = "1" && "${COZE_DEV_SKIP_WARMUP:-0}" != "1" ]]; then
    warmup_preview || true
    echo "✅ Warmup finished (or timed out). Preview should load fast now."
fi
