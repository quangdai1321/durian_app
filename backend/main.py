"""
Durian Leaf Disease Detection — FastAPI Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chạy server:
    uvicorn backend.main:app --reload --port 8000

Swagger UI:   http://localhost:8000/docs
Health check: http://localhost:8000/health
"""
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from .database import engine, Base, AsyncSessionLocal
from .routers import auth, diagnoses, diseases, news, ai
from .config import settings


async def _migrate_add_columns(conn):
    """Thêm các cột mới vào bảng đã có (idempotent — chạy nhiều lần không lỗi)."""
    from sqlalchemy import text
    migrations = [
        # Thêm cột yield_stats vào bảng users nếu chưa có (PostgreSQL syntax)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS yield_stats TEXT",
        # Thêm cột image_data vào diagnoses để lưu ảnh base64 persistent
        "ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS image_data TEXT",
        # Thêm cột avatar_data vào users để lưu avatar base64 persistent
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT",
    ]
    for sql in migrations:
        try:
            await conn.execute(text(sql))
        except Exception:
            pass  # Cột đã tồn tại → bỏ qua


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Tạo tables DB nếu chưa có
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _migrate_add_columns(conn)

    # 2. Seed dữ liệu bệnh nếu DB mới (Railway PostgreSQL)
    from .seed import seed_disease_classes
    async with AsyncSessionLocal() as db:
        await seed_disease_classes(db)

    # 3. Tạo thư mục upload
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

    # 3. Load AI model vào RAM ngay lúc server start
    #    → request đầu tiên không bị delay do load model
    from .services.ai_service import load_model_on_startup
    load_model_on_startup()

    yield  # server chạy từ đây


app = FastAPI(
    title="Durian Disease Detection API",
    description="YOLOv26n-CLS based leaf disease classification — HUTECH 2025",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded images at /uploads/<filename>
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# API routers
app.include_router(auth.router,      prefix="/api")
app.include_router(diagnoses.router, prefix="/api")
app.include_router(diseases.router,  prefix="/api")
app.include_router(news.router,      prefix="/api")
app.include_router(ai.router,        prefix="/api")


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def landing():
    from .services.ai_service import get_model_status
    ai = get_model_status()
    mode_badge = "🟢 Real AI" if ai["mode"] == "real" else "🟡 Mock Mode"
    return HTMLResponse(content=f"""
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Durian App API</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f1117; color: #e2e8f0; min-height: 100vh;
            display: flex; align-items: center; justify-content: center; }}
    .card {{ background: #1a1d2e; border: 1px solid #2d3748; border-radius: 16px;
             padding: 48px; max-width: 560px; width: 90%; text-align: center; }}
    .emoji {{ font-size: 64px; margin-bottom: 16px; }}
    h1 {{ font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 8px; }}
    .sub {{ color: #718096; margin-bottom: 32px; font-size: 15px; }}
    .badge {{ display: inline-block; background: #22543d; color: #68d391;
              padding: 4px 14px; border-radius: 20px; font-size: 13px;
              font-weight: 600; margin-bottom: 32px; }}
    .links {{ display: flex; flex-direction: column; gap: 12px; }}
    a.btn {{ display: block; padding: 12px 24px; border-radius: 10px;
             text-decoration: none; font-weight: 600; font-size: 15px;
             transition: opacity .2s; }}
    a.btn:hover {{ opacity: .85; }}
    .primary {{ background: #38a169; color: #fff; }}
    .secondary {{ background: #2d3748; color: #e2e8f0; }}
    .footer {{ margin-top: 32px; font-size: 12px; color: #4a5568; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">🌵</div>
    <h1>Durian Disease Detection</h1>
    <p class="sub">API backend nhận diện bệnh lá sầu riêng bằng AI<br/>HUTECH 2025</p>
    <div class="badge">✅ Server Online &nbsp;|&nbsp; {mode_badge}</div>
    <div class="links">
      <a class="btn primary" href="/docs">📖 Swagger API Docs</a>
      <a class="btn secondary" href="/health">💚 Health Check</a>
      <a class="btn secondary" href="/redoc">📋 ReDoc</a>
    </div>
    <p class="footer">Backend: FastAPI + PostgreSQL · Deployed on Railway</p>
  </div>
</body>
</html>
""")


@app.get("/health", tags=["System"])
async def health():
    """
    Kiểm tra trạng thái server + model.
    mode='real'  → model đã load thành công.
    mode='mock'  → chưa có .pt file, đang chạy dữ liệu giả.
    """
    from .services.ai_service import get_model_status
    return {
        "status": "ok",
        "ai":     get_model_status(),
    }
