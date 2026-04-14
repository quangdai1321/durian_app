# 🚀 Hướng dẫn Deploy Durian App lên VPS

## Tổng quan kiến trúc

```
Internet
   ↓
[Domain: durian.com]
   ↓
[Nginx — cổng 80/443 + SSL]
   ↓
[FastAPI Uvicorn — cổng 8000]
   ↓
[PostgreSQL Database]
```

---

## BƯỚC 1 — Mua VPS

1. Vào **DigitalOcean.com** → Create Droplet
2. Chọn: **Ubuntu 22.04**, plan $6/tháng (1GB RAM)
3. Chọn datacenter: **Singapore** (gần VN nhất)
4. Thêm SSH key hoặc dùng password
5. Ghi lại **IP của VPS** (ví dụ: 167.71.198.123)

---

## BƯỚC 2 — Mua Domain & Trỏ DNS

1. Mua domain tại **Namecheap.com** (ví dụ: durianapp.com)
2. Vào DNS settings → thêm record:
   ```
   Type: A
   Host: @
   Value: 167.71.198.123  ← IP VPS của bạn
   TTL: Automatic
   
   Type: A  
   Host: www
   Value: 167.71.198.123
   TTL: Automatic
   ```
3. Chờ 5-30 phút để DNS propagate

---

## BƯỚC 3 — SSH vào VPS và cài đặt

```bash
# SSH vào VPS (thay IP của bạn)
ssh root@167.71.198.123

# Chạy script cài đặt
curl -o setup.sh https://raw.githubusercontent.com/YOUR_USERNAME/durian_app/main/deploy/setup_vps.sh
bash setup.sh
```

---

## BƯỚC 4 — Upload code lên VPS

### Cách A: Dùng Git (khuyên dùng)
```bash
# Trên máy tính local — push code lên GitHub trước
cd E:\THs\Project\durian_app
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/durian_app.git
git push -u origin main

# Trên VPS
cd /home/durian/app
git pull origin main
```

### Cách B: Upload trực tiếp bằng SCP
```bash
# Chạy từ máy tính Windows (PowerShell hoặc Git Bash)
scp -r E:\THs\Project\durian_app\backend root@167.71.198.123:/home/durian/app/
scp -r E:\THs\Project\durian_app\models  root@167.71.198.123:/home/durian/app/
```

---

## BƯỚC 5 — Cấu hình .env trên VPS

```bash
# Trên VPS
nano /home/durian/app/backend/.env
```

Điền các giá trị:
```env
DATABASE_URL=postgresql+asyncpg://durian_user:MatKhauManhNe@localhost:5432/durian_db
SECRET_KEY=abc123def456...  # chạy: python3 -c "import secrets; print(secrets.token_hex(32))"
OPENAI_API_KEY=sk-proj-...  # key thật của bạn
```

---

## BƯỚC 6 — Cài Nginx + SSL

```bash
# Copy config nginx
cp /home/durian/app/deploy/nginx.conf /etc/nginx/sites-available/durian

# Sửa domain trong config
sed -i 's/YOUR_DOMAIN.COM/durianapp.com/g' /etc/nginx/sites-available/durian

# Kích hoạt site
ln -s /etc/nginx/sites-available/durian /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Cài SSL miễn phí (Let's Encrypt)
certbot --nginx -d durianapp.com -d www.durianapp.com
# Nhập email, đồng ý điều khoản → xong!
```

---

## BƯỚC 7 — Chạy Backend như service

```bash
# Copy service file
cp /home/durian/app/deploy/durian.service /etc/systemd/system/

# Kích hoạt
systemctl daemon-reload
systemctl enable durian
systemctl start durian

# Kiểm tra
systemctl status durian
curl http://localhost:8000/health
```

---

## BƯỚC 8 — Cập nhật Frontend URL

Trong `frontend/services/api.ts`, đổi:
```typescript
// Từ:
const BASE_URL = "http://localhost:8000/api";

// Sang:
const BASE_URL = "https://durianapp.com/api";
```

---

## BƯỚC 9 — Build App Mobile (Expo)

```bash
# Cài EAS CLI
npm install -g eas-cli
eas login

# Build APK Android
cd frontend
eas build --platform android --profile preview

# Build IPA iOS (cần Apple Developer Account $99/năm)
eas build --platform ios
```

---

## Lệnh hay dùng khi quản lý VPS

```bash
# Xem log backend
journalctl -u durian -f

# Restart backend
systemctl restart durian

# Xem log nginx
tail -f /var/log/nginx/error.log

# Update code
cd /home/durian/app
git pull
systemctl restart durian

# Kiểm tra port đang dùng
netstat -tlnp
```

---

## Chi phí ước tính / tháng

| Dịch vụ | Chi phí |
|---|---|
| VPS DigitalOcean 1GB | $6 (~150K VND) |
| Domain .com (chia 12 tháng) | ~25K VND |
| SSL Certificate | **Miễn phí** (Let's Encrypt) |
| **Tổng** | **~175K VND/tháng** |
