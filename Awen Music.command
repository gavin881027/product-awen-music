#!/bin/bash
# Awen Music 一键启动
# 双击此文件即可启动服务器并打开浏览器

PORT=8000
PROJECT_DIR="$(dirname "$0")"

# 切换到脚本所在目录
cd "$PROJECT_DIR" 2>/dev/null || {
    # 如果 dirname 失败（从 .command 双击运行时），尝试常见路径
    if [ -f "$HOME/Downloads/Awen-Claude-Handoff-2026-08-29/project/server.py" ]; then
        cd "$HOME/Downloads/Awen-Claude-Handoff-2026-08-29/project"
    else
        echo "❌ 找不到项目目录"
        read -p "按回车键关闭..."
        exit 1
    fi
}

# 确认 server.py 存在
if [ ! -f "server.py" ]; then
    echo "❌ 当前目录找不到 server.py: $(pwd)"
    read -p "按回车键关闭..."
    exit 1
fi

# 检查 Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装："
    echo "  brew install python3"
    read -p "按回车键关闭..."
    exit 1
fi

# Browser storage is origin-specific. Never silently change the port.
if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
    if python3 check_server.py --port 8000; then
        open "http://127.0.0.1:8000/"
        exit 0
    fi
    echo "8000 上的服务不是当前版本。请先停止旧服务，再重新启动；未切换数据端口。"
    exit 1
fi

echo "========================================="
echo "  Awen Music 本地服务器"
echo "========================================="
echo "Python:  $(python3 --version)"
echo "目录:    $(pwd)"
echo "地址:    http://127.0.0.1:$PORT/"
echo "停止:    Ctrl+C 或关闭此窗口"
echo "========================================="
echo ""

# 延迟 1.5 秒后自动打开浏览器
(sleep 1.5 && open "http://127.0.0.1:$PORT/") &

# 启动服务器
python3 server.py --port "$PORT"
