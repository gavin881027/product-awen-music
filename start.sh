#!/bin/bash
# Awen Music 本地启动脚本
# 用法: bash start.sh [端口号]

PORT="${1:-8000}"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  Awen Music 本地服务器"
echo "========================================="
echo ""

# 检查 Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3"
    echo "  推荐使用 Homebrew: brew install python3"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1)
echo "Python: $PYTHON_VERSION"

# 检查 server.py 是否存在
if [ ! -f "$PROJECT_DIR/server.py" ]; then
    echo "❌ 未找到 server.py，请在项目根目录运行此脚本"
    echo "  当前目录: $PROJECT_DIR"
    exit 1
fi

# 检查 docs/index.html 是否存在
if [ ! -f "$PROJECT_DIR/docs/index.html" ]; then
    echo "❌ 未找到 docs/index.html"
    exit 1
fi

echo "项目目录: $PROJECT_DIR"
echo "访问地址: http://127.0.0.1:$PORT/"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "========================================="
echo ""

# Refuse a silent origin change and identify an existing listener.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    python3 "$PROJECT_DIR/check_server.py" --port "$PORT"
    exit $?
fi

# 启动服务器
cd "$PROJECT_DIR"
python3 server.py --port "$PORT"
