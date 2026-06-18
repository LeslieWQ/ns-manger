#!/bin/bash
# NS 账号管理系统 - 自动部署脚本

set -e

echo "========================================="
echo "🚀 NS 账号管理系统 - 自动部署"
echo "========================================="

DEPLOY_DIR="/opt/ns-manager"

cd $DEPLOY_DIR

# 拉取最新代码（排除数据库文件）
echo ""
echo "📦 拉取最新代码..."
git stash 2>/dev/null || true
git pull origin master 2>&1 || git pull origin main 2>&1

# 安装后端依赖
echo ""
echo "📦 安装后端依赖..."
cd backend
npm install --production 2>&1
cd ..

# 安装前端依赖并构建
echo ""
echo "🔨 构建前端..."
cd frontend
npm install 2>&1
npx vue-cli-service build 2>&1
cd ..

# 确保数据库文件存在
echo ""
echo "💾 检查数据库..."
if [ ! -f "$DEPLOY_DIR/ns_manager.db" ]; then
    echo "⚠️  数据库不存在，从备份恢复或创建新数据库"
    if [ -f "$DEPLOY_DIR/backup/ns_manager.db" ]; then
        cp "$DEPLOY_DIR/backup/ns_manager.db" "$DEPLOY_DIR/ns_manager.db"
        echo "✅ 已从备份恢复"
    fi
fi

# 重启后端
echo ""
echo "🔄 重启 PM2 服务..."
pm2 restart ns-manager-api 2>&1

# 重载 nginx
echo ""
echo "🌐 重载 Nginx..."
/usr/sbin/nginx -t && /usr/sbin/nginx -s reload

echo ""
echo "========================================="
echo "✅ 部署完成!"
echo "========================================="
