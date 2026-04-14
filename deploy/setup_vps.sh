#!/bin/bash
# ════════════════════════════════════════════════════════════════
# Script cài đặt VPS cho Durian App
# Chạy với quyền root trên Ubuntu 22.04
# Cách dùng: bash setup_vps.sh
# ════════════════════════════════════════════════════════════════

set -e
echo "🌱 Bắt đầu cài đặt Durian App Server..."

# ── 1. Cập nhật hệ thống ─────────────────────────────────────────
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl

# ── 2. Tạo user app (không dùng root) ────────────────────────────
adduser --disabled-password --gecos "" durian || true
usermod -aG sudo durian

# ── 3. Clone code từ Git ─────────────────────────────────────────
# Thay YOUR_GIT_REPO bằng link repo của bạn
GIT_REPO="https://github.com/YOUR_USERNAME/durian_app.git"
APP_DIR="/home/durian/app"

su - durian -c "git clone $GIT_REPO $APP_DIR" || true

# ── 4. Cài Python packages ───────────────────────────────────────
cd $APP_DIR/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install fastapi uvicorn[standard] sqlalchemy asyncpg aiofiles \
    bcrypt python-jose pydantic pydantic-settings httpx pillow \
    ultralytics python-multipart pydantic-settings

# ── 5. Tạo file .env trên server ─────────────────────────────────
cat > $APP_DIR/backend/.env << 'EOF'
# THAY CÁC GIÁ TRỊ NÀY:
DATABASE_URL=postgresql+asyncpg://durian_user:YOUR_DB_PASS@localhost:5432/durian_db
SECRET_KEY=REPLACE_WITH_RANDOM_64_CHARS
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
MODEL_PATH=./models/best.pt
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
EOF

echo "⚠️  Nhớ sửa file $APP_DIR/backend/.env trước khi chạy!"

# ── 6. Cài PostgreSQL ────────────────────────────────────────────
apt install -y postgresql postgresql-contrib
sudo -u postgres psql << 'PSQL'
CREATE USER durian_user WITH PASSWORD 'YOUR_DB_PASS';
CREATE DATABASE durian_db OWNER durian_user;
GRANT ALL PRIVILEGES ON DATABASE durian_db TO durian_user;
PSQL

echo "✅ PostgreSQL đã cài xong"
