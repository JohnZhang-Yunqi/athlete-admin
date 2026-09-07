#!/bin/bash
# 运动员管理系统本地启动脚本（macOS）
cd "$(dirname "$0")" || exit 1
PORT=8765
echo "正在启动：http://127.0.0.1:${PORT}"
open "http://127.0.0.1:${PORT}/index.html"
python3 -m http.server "${PORT}"
