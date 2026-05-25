#!/bin/bash
# 一键启动本地静态服务器并通过 cpolar 建立公网隧道
# 用法：
#   chmod +x start_tunnel.sh
#   ./start_tunnel.sh
# 可传入环境变量：PORT, CPOLAR_TOKEN

set -euo pipefail

# 默认端口
PORT=${PORT:-5000}
CPOLAR_TOKEN=${CPOLAR_TOKEN:-}

echo "🔧 启动脚本：本地服务端口=$PORT"

# 1. 如果没有 dist，先构建
if [ ! -d "../dist" ]; then
  echo "📦 未发现 dist，开始构建..."
  cd ..
  npm install --no-audit --no-fund || true
  npx vite build
  cd deploy
fi

# 2. 启动本地静态服务器（优先使用 npx serve）
SERVER_CMD=""
if command -v npx >/dev/null 2>&1; then
  SERVER_CMD="npx serve ../dist -l $PORT"
elif command -v python3 >/dev/null 2>&1; then
  SERVER_CMD="python3 -m http.server $PORT --directory ../dist"
elif command -v python >/dev/null 2>&1; then
  SERVER_CMD="python -m http.server $PORT --directory ../dist"
else
  echo "❌ 未找到 npx 或 python 来启动静态服务器，请手动安装 node 或 python。"
  exit 1
fi

echo "▶️ 启动本地静态服务器: $SERVER_CMD"
# 在后台启动并将输出重定向
$SERVER_CMD > server.log 2>&1 &
SERVER_PID=$!
sleep 0.5
if ps -p $SERVER_PID > /dev/null 2>&1; then
  echo "✅ 本地静态服务器已启动 (PID=$SERVER_PID)，日志: deploy/server.log"
else
  echo "⚠️ 本地静态服务器未能启动，请检查 deploy/server.log"
  exit 1
fi

# 3. 启动 cpolar 隧道
if ! command -v cpolar >/dev/null 2>&1; then
  echo "⚠️ 未检测到 cpolar，可访问 https://www.cpolar.com 下载并登录。"
  echo "如果已经安装，请确保 cpolar 在 PATH 中。"
  echo "脚本仍会保持本地服务运行。"
  echo "按 Ctrl+C 结束脚本（服务在后台运行）。"
  exit 0
fi

if [ -n "$CPOLAR_TOKEN" ]; then
  echo "🔐 应用 cpolar authtoken（临时）"
  cpolar authtoken $CPOLAR_TOKEN || echo "⚠️ authtoken 应用失败，可能已配置"
fi

# 在后台启动 cpolar，并将输出写入 cpolar.log
echo "▶️ 启动 cpolar 隧道到端口 $PORT"
nohup cpolar http $PORT > cpolar.log 2>&1 &
CPOLAR_PID=$!
sleep 1

echo "✅ cpolar 已启动 (PID=$CPOLAR_PID)，日志: deploy/cpolar.log"

echo "---------- 状态 ----------"
echo "本地服务端口: $PORT"
echo "本地服务器 PID: $SERVER_PID"
echo "cpolar PID: $CPOLAR_PID"
echo "查看 cpolar 输出: tail -n 200 deploy/cpolar.log"

echo "结束说明："
echo "  - 停止本地服务器: kill $SERVER_PID"
echo "  - 停止 cpolar: kill $CPOLAR_PID (或使用 'cpolar stop' 如果可用)"

echo "脚本结束，服务在后台运行。"
