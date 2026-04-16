# 🌱 Ứng Dụng Nhận Diện Bệnh Lá Sầu Riêng
## Durian Leaf Disease Detection App

**Stack:**
- Frontend: React Native (Expo) — iOS & Android & Web
- Backend: Python FastAPI + YOLOv26n-CLS (Ultralytics)
- Database: PostgreSQL + SQLAlchemy
- Auth: JWT (Bearer token)
- Storage: Base64 trong PostgreSQL (không dùng filesystem — tương thích Railway PaaS)
- Deploy: Railway (backend) + Expo (frontend)

---

## 🤖 AI Model — YOLOv26n-CLS (Giải Pháp 1 · 5-Fold CV)

| Thông số | Giá trị |
|----------|---------|
| Kiến trúc | YOLOv26n Classification (Ultralytics ≥ 8.4.37) |
| Phương pháp train | 5-Fold Stratified Cross-Validation |
| Model được dùng | **Fold 5** (best fold) |
| File | `backend/models/best.pt` (~3.2 MB) |

### Cải tiến so với Baseline (Giải Pháp 1)

| # | Cải tiến | Mục tiêu |
|---|----------|----------|
| 1a | **Focal Loss** (γ=2.0, α=class-balanced, label_smoothing=0.1) | Rhizoctonia recall ↑ |
| 1b | **CutMix=0.5** + Mixup=0.15 + Mosaic + close_mosaic=10 | Blight/Colletotrichum confusion ↓ |
| 1c | **5-Fold Cross-Validation** | Kết quả bền vững, mean±std |

### Thống kê Dataset

| Class | Train | Val | Test | Total |
|-------|-------|-----|------|-------|
| Leaf_Algal | 1243 | 210 | 283 | 1736 |
| Leaf_Blight | 1390 | 225 | 319 | 1934 |
| Leaf_Colletotrichum | 704 | 122 | 123 | 949 |
| Leaf_Healthy | 1021 | 169 | 270 | 1460 |
| Leaf_Phomopsis | 901 | 149 | 239 | 1289 |
| **Leaf_Rhizoctonia** ⚠️ | 278 | 59 | 61 | 398 |

> Imbalance ratio: **5.0×** (Blight/Rhizoctonia) → giải quyết bằng Focal Loss α=2.501 cho Rhizoctonia

### So sánh 3 giai đoạn

| Metric | Baseline | Giải Pháp 1 (single split) | **5-Fold CV (dùng trong app)** |
|--------|----------|---------------------------|-------------------------------|
| Accuracy | 94.71% | 94.52% | **95.58% ± 0.49%** |
| Precision (macro) | 94.07% | 94.16% | **95.12% ± 0.54%** |
| Recall (macro) | 94.05% | 94.64% | **95.36% ± 0.67%** |
| F1 (macro) | 94.02% | 94.38% | **95.22% ± 0.60%** |
| **Rhizoctonia Recall** | 88.3% ← yếu | **95.1%** (+6.8pp) | 93.11% ± 1.61% |

### Per-class metrics — Giải Pháp 1 test set (n=1295)

| Class | Precision | Recall | F1 | n |
|-------|-----------|--------|----|---|
| Leaf_Algal | 0.927 | 0.947 (+1.9pp) | 0.937 | 283 |
| Leaf_Blight | 0.961 | 0.918 (+0.3pp) | 0.939 | 319 |
| Leaf_Colletotrichum | 0.899 | 0.943 (-1.5pp) | 0.921 | 123 |
| Leaf_Healthy | 0.974 | 0.981 (-1.1pp) | 0.978 | 270 |
| Leaf_Phomopsis | 0.937 | 0.937 (-3.0pp) | 0.937 | 239 |
| **Leaf_Rhizoctonia** ⭐ | **0.951** | **0.951 (+6.8pp)** | **0.951** | 61 |

### Kết quả từng fold (5-Fold CV)

| Fold | Accuracy | F1 Macro |
|------|----------|----------|
| Fold 1 | 96.06% | 95.78% |
| Fold 2 | 95.52% | 95.18% |
| Fold 3 | 94.98% | — |
| Fold 4 | 95.14% | — |
| **Fold 5 ✅ BEST** | **96.22%** | **96.00%** |

> **Cite trong paper:** Accuracy=95.58%±0.49%, Macro F1=95.22%±0.60%, Rhizoctonia Recall=93.11%±1.61%

## Cấu trúc dự án / Project Structure
```
durian_app/
├── frontend/          # React Native Expo app
│   ├── app/           # Screens (Expo Router)
│   ├── components/    # Reusable components
│   ├── services/      # API calls
│   ├── hooks/         # Custom hooks
│   └── constants/     # Colors, config
├── backend/           # FastAPI server
│   ├── main.py        # App entry point
│   ├── routers/       # API routes
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas
│   ├── services/      # Business logic + AI inference
│   └── utils/         # Helpers
└── database/          # SQL scripts
    ├── schema.sql     # Full DB schema
    └── seed.sql       # Sample data
```

## Khởi chạy nhanh / Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npx expo start
```

---

## Cơ sở dữ liệu / Database Schema

PostgreSQL — 6 bảng chính:

---

### 1. `users` — Tài khoản người dùng

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID (PK) | Định danh duy nhất |
| `username` | String(50) UNIQUE | Tên đăng nhập |
| `email` | String(255) UNIQUE | Địa chỉ email |
| `password_hash` | String(255) | Mật khẩu đã hash (bcrypt) |
| `full_name` | Unicode(100) | Họ và tên đầy đủ |
| `phone` | Unicode(20) | Số điện thoại |
| `role` | String(20) | Vai trò: `farmer` / `expert` / `admin` |
| `province` | Unicode(100) | Tỉnh/thành cư trú |
| `avatar_url` | Unicode(500) | URL ảnh đại diện (legacy) |
| `avatar_data` | Text | Ảnh đại diện dạng base64 JPEG (lưu trong DB để tránh mất khi Railway restart) |
| `yield_stats` | JSON | Danh sách bản ghi sản lượng theo năm (list of YieldRecord) |
| `is_active` | Boolean | Tài khoản còn hoạt động không |
| `created_at` | DateTime | Thời điểm tạo tài khoản |
| `updated_at` | DateTime | Thời điểm cập nhật gần nhất |

---

### 2. `disease_classes` — Danh mục 6 lớp bệnh

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | Integer (PK) | Định danh |
| `code` | String(50) UNIQUE | Mã lớp bệnh (ví dụ: `Leaf_Algal`, `Leaf_Healthy`) |
| `name_vi` | Unicode(100) | Tên bệnh tiếng Việt |
| `name_en` | Unicode(100) | Tên bệnh tiếng Anh |
| `scientific` | Unicode(200) | Tên khoa học của tác nhân gây bệnh |
| `severity` | String(20) | Mức độ nghiêm trọng: `low` / `moderate` / `high` |
| `description_vi` | UnicodeText | Mô tả triệu chứng (tiếng Việt) |
| `description_en` | UnicodeText | Mô tả triệu chứng (tiếng Anh) |
| `cause_vi` | UnicodeText | Nguyên nhân gây bệnh (tiếng Việt) |
| `cause_en` | UnicodeText | Nguyên nhân gây bệnh (tiếng Anh) |
| `created_at` | DateTime | Thời điểm tạo bản ghi |

**6 lớp bệnh hiện tại:**

| Code | Tên tiếng Việt | Tác nhân |
|------|----------------|----------|
| `Leaf_Algal` | Bệnh đốm tảo | *Cephaleuros virescens* |
| `Leaf_Blight` | Bệnh cháy lá | *Phytophthora palmivora* |
| `Leaf_Colletotrichum` | Bệnh thán thư | *Colletotrichum gloeosporioides* |
| `Leaf_Healthy` | Lá khỏe mạnh | — |
| `Leaf_Phomopsis` | Bệnh Phomopsis | *Phomopsis durionis* |
| `Leaf_Rhizoctonia` | Bệnh lở cổ rễ / đốm lá | *Rhizoctonia solani* |

---

### 3. `treatment_steps` — Các bước xử lý / điều trị bệnh

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | Integer (PK) | Định danh |
| `disease_id` | Integer (FK → `disease_classes.id`) | Liên kết đến lớp bệnh |
| `step_order` | SmallInteger | Thứ tự bước (1, 2, 3, …) |
| `step_vi` | UnicodeText | Hướng dẫn bước thực hiện (tiếng Việt) |
| `step_en` | UnicodeText | Hướng dẫn bước thực hiện (tiếng Anh) |
| `chemical` | Unicode(500) | Tên hoạt chất / thuốc BVTV được khuyến nghị |
| `created_at` | DateTime | Thời điểm tạo bản ghi |

---

### 4. `diagnoses` — Lịch sử chẩn đoán bệnh

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID (PK) | Định danh chẩn đoán |
| `user_id` | UUID (FK → `users.id`) | Người thực hiện chẩn đoán |
| `image_path` | String(500) | Đường dẫn file tạm (dùng khi inference) |
| `image_url` | String(500) | URL ảnh (legacy) |
| `image_data` | Text | Ảnh gốc dạng base64 JPEG (lưu trong DB) |
| `model_version` | String(50) | Phiên bản model AI (ví dụ: `YOLOv26n-CLS`) |
| `predicted_class` | String(50) (FK → `disease_classes.code`) | Lớp bệnh được dự đoán |
| `confidence` | Numeric(5,4) | Độ tin cậy dự đoán (0.0000 – 1.0000) |
| `inference_ms` | Numeric(8,2) | Thời gian inference (mili-giây) |
| `top3_predictions` | JSON | Top 3 lớp dự đoán kèm độ tin cậy |
| `latitude` | Numeric(10,7) | Vĩ độ GPS nơi chụp ảnh |
| `longitude` | Numeric(10,7) | Kinh độ GPS nơi chụp ảnh |
| `province` | String(100) | Tỉnh/thành (từ GPS hoặc hồ sơ người dùng) |
| `device_info` | JSON | Thông tin thiết bị (OS, model, platform) |
| `is_verified` | Boolean | Đã được chuyên gia xác minh chưa |
| `verified_by` | UUID (FK → `users.id`) | Chuyên gia xác minh |
| `verified_at` | DateTime | Thời điểm xác minh |
| `notes` | Text | Ghi chú thêm của người dùng |
| `created_at` | DateTime | Thời điểm chẩn đoán |

---

### 5. `feedback` — Phản hồi / đánh giá kết quả chẩn đoán

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID (PK) | Định danh phản hồi |
| `diagnosis_id` | UUID (FK → `diagnoses.id`) | Chẩn đoán được đánh giá |
| `user_id` | UUID (FK → `users.id`) | Người gửi phản hồi |
| `actual_class` | String(50) (FK → `disease_classes.code`) | Lớp bệnh thực tế (người dùng đính chính) |
| `rating` | SmallInteger | Đánh giá độ chính xác (1–5 sao) |
| `comment` | Text | Nhận xét chi tiết |
| `created_at` | DateTime | Thời điểm gửi phản hồi |

---

### 6. `notifications` — Thông báo hệ thống

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID (PK) | Định danh thông báo |
| `user_id` | UUID (FK → `users.id`) | Người nhận thông báo |
| `title_vi` | String(200) | Tiêu đề thông báo (tiếng Việt) |
| `title_en` | String(200) | Tiêu đề thông báo (tiếng Anh) |
| `body_vi` | Text | Nội dung thông báo (tiếng Việt) |
| `body_en` | Text | Nội dung thông báo (tiếng Anh) |
| `type` | String(50) | Loại thông báo: `info` / `warning` / `alert` |
| `is_read` | Boolean | Đã đọc chưa |
| `created_at` | DateTime | Thời điểm gửi thông báo |

---

### Quan hệ giữa các bảng

```
users ──────────────────────── diagnoses (1 : n)
                                    │
                                    ├──── disease_classes (n : 1)  [predicted_class]
                                    └──── feedback (1 : n)
                                               └──── disease_classes (n : 1) [actual_class]

disease_classes ──────────── treatment_steps (1 : n)

users ──────────────────────── notifications (1 : n)
```
