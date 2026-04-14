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

from .database import engine, Base
from .routers import auth, diagnoses, diseases, news, ai
from .config import settings


async def _migrate_add_columns(conn):
    """Thêm các cột mới vào bảng đã có (idempotent — chạy nhiều lần không lỗi)."""
    from sqlalchemy import text
    migrations = [
        # Thêm cột yield_stats vào bảng users nếu chưa có (PostgreSQL syntax)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS yield_stats TEXT",
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

    # 2. Tạo thư mục upload
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
