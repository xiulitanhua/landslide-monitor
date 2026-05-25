#!/bin/bash
# ============================================
# 滑坡监测系统 - HTTPS 自动配置脚本
# 使用 Let's Encrypt 免费证书 + Certbot
# ============================================
# 前提：
#   1. 已完成 deploy.sh 部署（HTTP 可正常访问）
#   2. 域名已解析到本服务器（A 记录指向本机公网 IP）
#   3. 80 和 443 端口已开放
#
# 使用方法：
#   chmod +x setup-https.sh
#   ./setup-https.sh your-domain.com
# ============================================

set -e

# 获取域名参数
DOMAIN=$1

if [ -z "$DOMAIN" ]; then
    echo "❌ 请提供域名"
    echo "用法: ./setup-https.sh your-domain.com"
    exit 1
fi

echo "🔒 开始为 $DOMAIN 配置 HTTPS..."

# ===== 1. 更新 Nginx 配置中的域名 =====
NGINX_CONF="/etc/nginx/conf.d/landslide.conf"

if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ 找不到 $NGINX_CONF，请先运行 deploy.sh"
    exit 1
fi

echo "⚙️ 更新 Nginx 配置中的域名为: $DOMAIN"
sudo sed -i "s/server_name .*/server_name $DOMAIN;/" "$NGINX_CONF"
sudo nginx -t && sudo nginx -s reload

# ===== 2. 安装 Certbot =====
echo "📦 安装 Certbot..."

if command -v apt &> /dev/null; then
    # Ubuntu/Debian
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
elif command -v yum &> /dev/null; then
    # CentOS/RHEL
    sudo yum install -y epel-release
    sudo yum install -y certbot python3-certbot-nginx
elif command -v dnf &> /dev/null; then
    # Fedora/CentOS 8+
    sudo dnf install -y certbot python3-certbot-nginx
else
    echo "❌ 无法识别包管理器，请手动安装 certbot"
    exit 1
fi

# ===== 3. 申请证书并自动配置 Nginx =====
echo "🔐 申请 Let's Encrypt 证书..."
echo ""
echo "  Certbot 会自动："
echo "    ✅ 申请免费 SSL 证书"
echo "    ✅ 修改 Nginx 配置启用 HTTPS"
echo "    ✅ 设置 HTTP → HTTPS 自动跳转"
echo ""

sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect

# ===== 4. 设置自动续期 =====
echo "⏰ 配置证书自动续期..."

# 添加 crontab 任务：每天凌晨 3 点检查续期
(sudo crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --quiet --deploy-hook 'nginx -s reload'") | sudo crontab -

# 测试续期
echo "🧪 测试证书续期..."
sudo certbot renew --dry-run

echo ""
echo "============================================"
echo "✅ HTTPS 配置完成！"
echo "============================================"
echo ""
echo "🌐 请访问: https://$DOMAIN"
echo ""
echo "📋 证书信息："
echo "   证书路径: /etc/letsencrypt/live/$DOMAIN/"
echo "   有效期:   90 天（已配置自动续期）"
echo "   续期命令: certbot renew"
echo ""
echo "🔧 如需修改配置: vi $NGINX_CONF"
echo "   修改后执行:    nginx -t && nginx -s reload"
echo ""
