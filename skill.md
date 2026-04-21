# Skill Map — Durian Disease Detection App

> Tài liệu này liệt kê toàn bộ kỹ năng kỹ thuật được áp dụng trong dự án,
> phân theo tầng hệ thống. Dùng như tài liệu tham chiếu / checklist cho thành viên mới.

---

## Mục lục

1. [AI / Machine Learning](#1-ai--machine-learning)
2. [Backend — FastAPI](#2-backend--fastapi)
3. [Database](#3-database)
4. [Frontend — React Native Expo](#4-frontend--react-native-expo)
5. [API Design](#5-api-design)
6. [Image Processing](#6-image-processing)
7. [Authentication & Security](#7-authentication--security)
8. [Weather & External API](#8-weather--external-api)
9. [Deployment & DevOps](#9-deployment--devops)
10. [Data Engineering](#10-data-engineering)
11. [Testing & Benchmarking](#11-testing--benchmarking)

---

## 1. AI / Machine Learning

### 1.1 Model Architecture
| Skill | Chi tiết |
|---|---|
| **YOLOv11n-CLS** | Mô hình phân loại ảnh nano — 47 layers, 1.53M params, C3k2/C2PSA backbone |
| **Multi-class Classification** | 6 lớp bệnh lá sầu riêng: Algal, Blight, Colletotrichum, Healthy, Phomopsis, Rhizoctonia |
| **Imbalanced Dataset Handling** | Focal Loss (γ=2.0, α=class-balanced) để giảm thiểu ảnh hưởng class thiểu số |
| **Label Smoothing** | `label_smoothing=0.1` — tránh overfit, cải thiện calibration |
| **Data Augmentation** | CutMix=0.5, Mixup=0.15 — giảm nhầm lẫn Blight ↔ Colletotrichum |

### 1.2 Training Strategy
| Skill | Chi tiết |
|---|---|
| **K-Fold Cross Validation** | 5-Fold Stratified CV — đánh giá chính xác hơn single split |
| **Stratified Split** | Đảm bảo phân phối class đồng đều ở mỗi fold |
| **Hyperparameter Tuning** | Thử nghiệm lr, batch size, augmentation params |
| **Early Stopping** | Dừng training khi val metric không cải thiện |
| **Model Selection** | Chọn fold best dựa trên macro-F1, không chỉ accuracy |

### 1.3 Model Optimization & Deployment
| Skill | Chi tiết |
|---|---|
| **ONNX Export** | Chuyển `.pt` → `.onnx` (FP32 → INT8 Dynamic Quantization) |
| **ONNX Runtime** | Load & inference với `onnxruntime`, thread pool tuning |
| **Dynamic INT8 Quantization** | Giảm size 2× (3MB → 1.58MB), tăng tốc ~40% trên CPU |
| **OpenVINO IR Export** | Chuyển sang Intel IR format (.xml + .bin), 2.95× speedup |
| **Softmax từ raw logits** | Tự implement `softmax(x - x.max())` khi ONNX không có layer cuối |
| **NCHW preprocessing** | Chuẩn hóa ảnh: PIL → numpy → transpose(2,0,1) → batch dim |
| **Thread Pool Executor** | `loop.run_in_executor(None, _predict_sync)` — không block async event loop |
| **Warm-up Inference** | Chạy 3–5 lần dummy trước khi benchmark để stabilize JIT/cache |

### 1.4 Performance Metrics
| Skill | Chi tiết |
|---|---|
| **Confusion Matrix** | Hiểu nhầm lẫn giữa các class |
| **Precision / Recall / F1** | Per-class và macro-average |
| **Latency Analysis** | mean, p50, p95, p99 (ms) — phân tích tail latency |
| **Throughput** | img/s — so sánh deployment options |
| **3-Model Benchmark** | So sánh: SingleSplit vs Fold5 .pt vs OpenVINO FP32 |

### 1.5 GPT-4o Vision Integration
| Skill | Chi tiết |
|---|---|
| **Vision Pre-check** | Gửi ảnh lên GPT-4o-mini → xác nhận chủ thể chính là lá |
| **Fail-Closed Design** | API lỗi → reject ảnh (bảo vệ model khỏi ảnh random) |
| **Base64 Image Encoding** | PIL → BytesIO → base64 → gửi qua JSON |
| **Token Optimization** | `max_tokens=10`, `detail="low"` — tiết kiệm chi phí |
| **LEAF_WORDS matching** | Tập từ khóa linh hoạt — phát hiện nhiều variant (leaf/foliage/plant/...) |

---

## 2. Backend — FastAPI

### 2.1 Framework & Server
| Skill | Chi tiết |
|---|---|
| **FastAPI** | Async web framework, tự sinh OpenAPI docs |
| **Uvicorn** | ASGI server, `--host 0.0.0.0 --port $PORT` |
| **Lifespan Context Manager** | `@asynccontextmanager` — load model + seed DB khi start |
| **CORS Middleware** | `allow_origins=["*"]` cho dev, có thể restrict sau |
| **Dependency Injection** | `Depends()` — inject db session, current user vào routes |
| **Background Tasks** | Sử dụng thread pool cho inference nặng |

### 2.2 Request / Response
| Skill | Chi tiết |
|---|---|
| **Pydantic v2** | Schema validation tự động, type coercion |
| **FormData Upload** | Nhận file ảnh qua `UploadFile`, validate MIME type + size |
| **HTTPException** | Error response chuẩn với status code + detail |
| **Response Models** | `response_model=` để control output schema |
| **Query Parameters** | `skip`, `limit` cho pagination |

### 2.3 Business Logic
| Skill | Chi tiết |
|---|---|
| **Singleton Pattern** | Model YOLO load 1 lần, tái dùng mọi request |
| **Fallback Chain** | ONNX → PyTorch .pt → Mock Mode |
| **Image Validation** | Kiểm tra extension, MIME, size trước khi xử lý |
| **GPS Tagging** | Lưu lat/lng/province vào diagnosis record |
| **RSS Scraping** | Parse Google News RSS feed với `xml.etree` |
| **Price Scraping** | Regex extract giá sầu riêng từ news headline |

---

## 3. Database

### 3.1 ORM & Migrations
| Skill | Chi tiết |
|---|---|
| **SQLAlchemy 2.0 Async** | `AsyncSession`, `async_engine` — hoàn toàn async |
| **Declarative Base** | ORM models với relationship, cascade |
| **asyncpg** | PostgreSQL async driver |
| **Auto Table Creation** | `Base.metadata.create_all()` khi startup |
| **Seed Data** | `seed.py` — tự insert 6 disease classes + treatment steps |

### 3.2 Schema Design
| Skill | Chi tiết |
|---|---|
| **UUID Primary Key** | `uuid4()` — tránh enumeration attack |
| **Soft Delete** | `is_active` flag thay vì hard delete |
| **JSON Column** | `top3_predictions`, `device_info`, `yield_stats` dùng JSON |
| **Relationship FK** | User → Diagnoses → Feedback (cascade) |
| **Base64 Image Storage** | Không dùng filesystem (Railway ephemeral) → store JPEG base64 trong DB |
| **Bilingual Fields** | `name_vi` / `name_en`, `step_vi` / `step_en` |
| **Enum Fields** | `role` (farmer/expert/admin), `severity` (low/moderate/high) |

### 3.3 Queries
| Skill | Chi tiết |
|---|---|
| **Async CRUD** | `session.execute(select(...))`, `session.add()`, `session.commit()` |
| **Filter & Paginate** | `.where()`, `.offset(skip).limit(limit)` |
| **Eager Loading** | `selectinload()` — load relationships tránh N+1 |
| **Connection Pool** | SQLAlchemy pool_size, max_overflow |

---

## 4. Frontend — React Native Expo

### 4.1 Navigation
| Skill | Chi tiết |
|---|---|
| **Expo Router** | File-based routing (tương tự Next.js) |
| **Tab Navigator** | Bottom tab bar: Camera / History / Treatment / News / Profile |
| **Stack Navigator** | Root stack với hidden header |
| **Protected Routes** | `AuthGuard` component — redirect nếu chưa login |
| **Deep Linking** | Hỗ trợ URL routing cho web build |

### 4.2 Camera & Media
| Skill | Chi tiết |
|---|---|
| **expo-camera** | Live camera preview, chụp ảnh |
| **expo-image-picker** | Chọn ảnh từ thư viện |
| **Image Resize (web)** | Canvas API — resize ảnh trước khi upload |
| **FormData Upload** | Gửi file qua `multipart/form-data` |
| **Data URI** | Hiển thị ảnh từ base64 `data:image/jpeg;base64,...` |

### 4.3 State Management
| Skill | Chi tiết |
|---|---|
| **React Context** | `AuthContext` — global auth state |
| **useState / useEffect** | Local component state |
| **AsyncStorage** | Persist token, user, last_diagnosis, reminders, yield data |
| **Custom Hooks** | `useAuth`, `useWeather` — tách logic khỏi UI |
| **useFocusEffect** | Re-check auth khi screen focus (expo-router) |

### 4.4 UI & UX
| Skill | Chi tiết |
|---|---|
| **StyleSheet API** | Inline styles, theme colors |
| **FlatList** | Danh sách diagnosis history, news articles |
| **ScrollView** | Treatment guide, disease detail |
| **Modal** | Feedback form, reminder picker |
| **ActivityIndicator** | Loading state |
| **Pull-to-Refresh** | `onRefresh` trong FlatList |
| **Animated** | Smooth transitions |
| **Platform.OS** | Xử lý khác biệt iOS / Android / Web |

### 4.5 Notifications & Location
| Skill | Chi tiết |
|---|---|
| **expo-notifications** | Schedule local push notification cho reminders |
| **expo-location** | Request GPS, `getCurrentPositionAsync()` |
| **Nominatim Reverse Geocode** | Chuyển lat/lng → tên tỉnh |
| **Permission Handling** | Request + check `requestForegroundPermissionsAsync()` |

---

## 5. API Design

| Skill | Chi tiết |
|---|---|
| **RESTful Conventions** | GET/POST/PATCH/PUT/DELETE đúng ngữ nghĩa |
| **Versioned Prefix** | `/api/` prefix cho tất cả endpoints |
| **Pagination** | `skip` + `limit` query params |
| **Error Codes** | 400 validation, 401 auth, 403 forbidden, 404 not found, 422 schema |
| **Auth Header** | `Authorization: Bearer <token>` |
| **OpenAPI Docs** | FastAPI tự sinh `/docs` (Swagger UI) |
| **CORS** | Cross-origin setup cho mobile + web client |
| **Proxy Pattern** | Backend proxy OpenAI API — ẩn key khỏi frontend bundle |

---

## 6. Image Processing

| Skill | Chi tiết |
|---|---|
| **Pillow (PIL)** | Open, convert("RGB"), resize, save JPEG |
| **Thumbnail** | `img.thumbnail((512, 512))` — giữ tỉ lệ |
| **Color Analysis** | Numpy slice — kiểm tra pixel xanh/nâu/vàng để detect thực vật |
| **JPEG Quality** | `quality=85` — cân bằng size vs chất lượng |
| **Base64 Encode/Decode** | `base64.b64encode(buf.getvalue()).decode()` |
| **BytesIO Buffer** | Encode ảnh trong memory, không cần write file |
| **Avatar Resize** | Crop & resize về 200×200 JPEG cho profile picture |
| **MIME Validation** | Kiểm tra `image/jpeg`, `image/png`, `image/webp` |

---

## 7. Authentication & Security

| Skill | Chi tiết |
|---|---|
| **JWT (HS256)** | `python-jose` — sign/verify token, 7-day expiry |
| **bcrypt** | `passlib[bcrypt]` — hash password với salt |
| **Bearer Token** | Extract từ `Authorization` header |
| **Dependency Injection Auth** | `get_current_user()` dùng `Depends()` |
| **Fail-Closed** | GPT verify lỗi → reject, không fallback allow |
| **Secret Key** | Đọc từ `.env`, không hardcode |
| **Role-Based** | `role` field: farmer / expert / admin |
| **Token Storage** | Client lưu token trong AsyncStorage |

---

## 8. Weather & External API

### 8.1 Open-Meteo (Weather)
| Skill | Chi tiết |
|---|---|
| **Free API, No Key** | `open-meteo.com` — không cần API key |
| **7-Day Forecast** | `daily`: precipitation_sum, humidity, temp_max/min |
| **Province Coordinates** | Hardcode lat/lng cho 63 tỉnh thành VN |
| **Cache Strategy** | Cache 1 giờ — tránh gọi API liên tục |
| **Neighboring Provinces** | Tính khoảng cách → lấy 2 tỉnh lân cận |

### 8.2 Risk Engine
| Skill | Chi tiết |
|---|---|
| **Disease Risk Score** | Kết hợp rain + humidity + temp → low/medium/high/very_high |
| **Season Detection** | Phát hiện mùa khô/mưa/chuyển tiếp theo tháng |
| **Best Spray Day** | Tìm ngày ít mưa (<2mm), ẩm thấp (<78%), mát (<36°C) |
| **Smart Recommendations** | Rule engine: disease + weather → tư vấn cụ thể |
| **Disease-Specific Advice** | Mỗi bệnh × điều kiện thời tiết → thuốc + biện pháp riêng |

### 8.3 GPT-4o Integration
| Skill | Chi tiết |
|---|---|
| **Chat Completion API** | `POST /v1/chat/completions` với `httpx` async |
| **Vision API** | Gửi ảnh base64 qua `image_url.url = data:image/jpeg;base64,...` |
| **Cost Control** | `max_tokens`, `detail="low"`, `temperature=0` |
| **Error Handling** | Kiểm tra `status_code != 200`, log + reject |

---

## 9. Deployment & DevOps

### 9.1 Containerization
| Skill | Chi tiết |
|---|---|
| **Dockerfile** | Python 3.11-slim, multi-dep install, non-root CMD |
| **System Dependencies** | `libgl1`, `libglib2.0-0`, `libsm6` cho OpenCV/PIL |
| **ENV Variables** | `$PORT` từ Railway, đọc `.env` qua pydantic-settings |
| **Working Directory** | `/app`, COPY requirements trước code (layer caching) |

### 9.2 Railway
| Skill | Chi tiết |
|---|---|
| **railway.toml** | `[build]` + `[deploy]` config |
| **PostgreSQL Add-on** | Railway managed Postgres, auto inject `DATABASE_URL` |
| **Ephemeral Filesystem** | Hiểu giới hạn → không dùng local file storage |
| **Environment Variables** | Quản lý secret qua Railway dashboard |

### 9.3 Expo / Mobile
| Skill | Chi tiết |
|---|---|
| **EAS Build** | Expo Application Services — build APK/IPA trên cloud |
| **app.json Config** | Bundle ID, permissions, plugins |
| **eas.json** | Build profiles (development, preview, production) |
| **Vercel Deploy** | `vercel.json` — deploy web build |
| **OTA Updates** | Expo Updates — push JS bundle updates không cần store |

---

## 10. Data Engineering

### 10.1 Dataset Management
| Skill | Chi tiết |
|---|---|
| **MD5 Hashing** | Detect ảnh trùng lặp giữa train/val/test và giữa các class |
| **Cross-class Duplicate Detection** | Tìm ảnh bị đặt nhầm folder (mislabeled) |
| **Data Leakage Detection** | Tìm ảnh xuất hiện ở cả train lẫn test split |
| **Dataset Statistics** | Đếm ảnh per class, phân tích phân phối |
| **CSV Logging** | Ghi danh sách ảnh lỗi để review thủ công |

### 10.2 Dataset Analysis
| Skill | Chi tiết |
|---|---|
| **Class Imbalance Analysis** | Phát hiện Leaf_Rhizoctonia (398) và Leaf_Colletotrichum (921) thấp |
| **External Dataset Evaluation** | Đánh giá tập Vinh Long — kết luận không tương thích |
| **Augmentation Planning** | Lên kế hoạch tăng Rhizoctonia từ 398 → 1,200 ảnh |
| **zipfile / pathlib** | Extract zip, glob patterns, cross-platform paths |

---

## 11. Testing & Benchmarking

| Skill | Chi tiết |
|---|---|
| **Full Test Set Evaluation** | Chạy inference trên 1,236 ảnh test thực tế |
| **Per-class Metrics** | Precision, Recall, F1, Support cho từng class |
| **Latency Profiling** | `time.perf_counter()` — đo từng request |
| **Percentile Analysis** | p50, p95, p99 — phát hiện outlier/spike |
| **Throughput Measurement** | `total_images / elapsed_time` |
| **3-Way Model Comparison** | SingleSplit vs Fold5 .pt vs OpenVINO — systematic |
| **Confusion Matrix** | Numpy 2D array, seaborn heatmap visualization |
| **JSON Result Export** | Lưu kết quả structured để review sau |
| **Kaggle Notebook** | Viết notebook benchmark chạy được trên Kaggle CPU |

---

## Tóm tắt kỹ năng theo vai trò

| Vai trò | Kỹ năng chính |
|---|---|
| **AI Engineer** | YOLOv11, K-Fold CV, Focal Loss, ONNX, OpenVINO, INT8 Quantization, Benchmark |
| **Backend Dev** | FastAPI, SQLAlchemy async, JWT, Pydantic, PostgreSQL, REST API |
| **Mobile Dev** | React Native, Expo Router, expo-camera, AsyncStorage, push notifications |
| **Data Engineer** | Dataset cleaning, duplicate detection, mislabel detection, statistics |
| **DevOps** | Docker, Railway, EAS Build, env management, ephemeral fs handling |
| **Integrations** | GPT-4o Vision, Open-Meteo, Google News RSS, Nominatim |

---

*Cập nhật lần cuối: 2026-04-20*
