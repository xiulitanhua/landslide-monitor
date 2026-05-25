#!/bin/bash
# ============================================
# 滑坡监测系统 - 服务器端部署脚本
# ============================================
# 使用方法：
#   1. 将 dist.zip 上传到服务器任意目录
#   2. 将此脚本也上传到同一目录
#   3. chmod +x deploy.sh && ./deploy.sh
# ============================================

set -e

# ===== 配置区域（根据实际修改） =====
DEPLOY_DIR="/var/www/landslide-monitor"
NGINX_CONF_DIR="/etc/nginx/conf.d"
ZIP_FILE="dist.zip"
# =====================================

echo "🚀 开始部署滑坡监测系统..."

# 1. 检查 zip 文件
if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ 找不到 $ZIP_FILE，请先上传"
    exit 1
fi

# 2. 安装 Nginx（如未安装）
if ! command -v nginx &> /dev/null; then
    echo "📦 安装 Nginx..."
    if command -v apt &> /dev/null; then
        sudo apt update && sudo apt install -y nginx unzip
    elif command -v yum &> /dev/null; then
        sudo yum install -y nginx unzip
    fi
fi

# 3. 创建部署目录
echo "📁 创建部署目录: $DEPLOY_DIR"
sudo mkdir -p "$DEPLOY_DIR"

# 4. 解压文件
echo "📦 解压 dist.zip..."
sudo unzip -o "$ZIP_FILE" -d "$DEPLOY_DIR"

# 5. 设置权限
echo "🔒 设置文件权限..."
sudo chown -R nginx:nginx "$DEPLOY_DIR" 2>/dev/null || sudo chown -R www-data:www-data "$DEPLOY_DIR"
sudo chmod -R 755 "$DEPLOY_DIR"

# 6. 复制 Nginx 配置
if [ -f "nginx.conf" ]; then
    echo "⚙️ 复制 Nginx 配置..."
    sudo cp nginx.conf "$NGINX_CONF_DIR/landslide.conf"
fi

# 7. 测试 Nginx 配置
echo "🧪 测试 Nginx 配置..."
sudo nginx -t

# 8. 重新加载 Nginx
echo "🔄 重新加载 Nginx..."
sudo nginx -s reload || sudo systemctl reload nginx

# ====== 自动化远程上传（本地执行） ======
# 用法：bash deploy.sh 或在 CI 中执行
# 脚本会提示输入服务器信息（回车使用默认）
read -p "是否需要执行本地打包并上传到远程 Nginx？(y/N): " DO_DEPLOY
DO_DEPLOY=${DO_DEPLOY:-N}
if [[ "$DO_DEPLOY" =~ ^[Yy]$ ]]; then
    # 本地打包
    echo "📦 本地打包中..."
    cd ..
    npx vite build
    cd deploy

    # 读取远程信息
    read -p "服务器 IP (例如 192.168.1.100): " SERVER_IP
    read -p "SSH 用户名 (默认 root): " SERVER_USER
    SERVER_USER=${SERVER_USER:-root}
    read -p "远程网站根目录 (默认 /usr/share/nginx/html): " NGINX_ROOT
    NGINX_ROOT=${NGINX_ROOT:-/usr/share/nginx/html}
    read -p "SSH 端口 (默认 22): " SSH_PORT
    SSH_PORT=${SSH_PORT:-22}
    read -p "SSH 私钥路径 (可留空使用密码/ssh-agent): " SSH_KEY

    SSH_OPTS="-p $SSH_PORT"
    if [ -n "$SSH_KEY" ]; then
        SSH_OPTS+=" -i $SSH_KEY"
    fi

    echo "🔐 使用 SSH: $SERVER_USER@$SERVER_IP:$SSH_PORT"

    # 备份/清理远程旧文件（谨慎）
    read -p "远程目录 $NGINX_ROOT 将被清空并覆盖，确定继续吗？(y/N): " CONFIRM_CLEAR
    CONFIRM_CLEAR=${CONFIRM_CLEAR:-N}
    if [[ "$CONFIRM_CLEAR" =~ ^[Yy]$ ]]; then
        ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "rm -rf $NGINX_ROOT/*"
    else
        echo "已取消清理旧文件，退出。"
        exit 0
    fi

    # 上传新文件
    echo "⬆️ 上传 dist/* 到 $SERVER_USER@$SERVER_IP:$NGINX_ROOT ..."
    scp $SSH_OPTS -r ../dist/* $SERVER_USER@$SERVER_IP:$NGINX_ROOT/

    # 重载 Nginx
    echo "🔄 重载 Nginx 服务..."
    ssh $SSH_OPTS $SERVER_USER@$SERVER_IP "sudo nginx -t && sudo systemctl reload nginx || sudo nginx -s reload"

    echo "✅ 部署完成，请刷新网页查看效果。"
fi

echo ""
echo "✅ 部署完成！"
echo "🌐 请访问: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "⚠️ 注意事项："
echo "   1. 请修改 $NGINX_CONF_DIR/landslide.conf 中的 server_name 为你的域名"
echo "   2. 建议配置 HTTPS（Cesium Ion 地形需要）"
echo "   3. 修改后执行: sudo nginx -t && sudo nginx -s reload"
