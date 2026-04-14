import uuid
import aiofiles
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.models import User
from ..schemas.schemas import UserRegister, UserLogin, Token, UserOut, UserUpdate
from ..services.auth_service import hash_password, authenticate_user, create_access_token, get_user_by_id
from ..config import settings
from .deps import get_current_user

ALLOWED_IMG = {".jpg", ".jpeg", ".png", ".webp"}
MAX_AVATAR  = 5 * 1024 * 1024  # 5 MB

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    import uuid as _uuid
    existing = await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Username or email already exists")

    user = User(
        id=str(_uuid.uuid4()),
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        phone=body.phone,
        province=body.province,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(current_user, field):
            setattr(current_user, field, value)
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.get("/me/yield-stats")
async def get_yield_stats(current_user: User = Depends(get_current_user)):
    """Trả về danh sách bản ghi thống kê sản lượng của user hiện tại."""
    return {"records": current_user.yield_stats or []}


@router.put("/me/yield-stats")
async def set_yield_stats(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lưu toàn bộ danh sách bản ghi thống kê sản lượng (replace all)."""
    current_user.yield_stats = body.get("records", [])
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return {"records": current_user.yield_stats or []}


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    fname = file.filename or "avatar.jpg"
    ext   = Path(fname).suffix.lower() or ".jpg"
    if ext not in ALLOWED_IMG:
        raise HTTPException(400, f"File type not allowed: {ext}")

    content = await file.read()
    if len(content) > MAX_AVATAR:
        raise HTTPException(413, "Avatar exceeds 5 MB limit")

    # Resize avatar về 200×200 để giảm dung lượng base64 lưu DB
    try:
        from PIL import Image as PILImage
        import io
        pil_img = PILImage.open(io.BytesIO(content)).convert("RGB")
        pil_img.thumbnail((200, 200), PILImage.LANCZOS)
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        content = buf.getvalue()
        ext = ".jpg"
    except Exception:
        pass  # Nếu lỗi → dùng ảnh gốc

    # Lưu base64 vào DB để tránh mất ảnh khi Railway restart
    import base64
    avatar_b64 = "data:image/jpeg;base64," + base64.b64encode(content).decode()

    # Vẫn lưu file cho local dev (không ảnh hưởng production)
    try:
        upload_dir = Path(settings.UPLOAD_DIR) / "avatars"
        upload_dir.mkdir(parents=True, exist_ok=True)
        filename   = f"avatar_{current_user.id}{ext}"
        save_path  = upload_dir / filename
        async with aiofiles.open(save_path, "wb") as f:
            await f.write(content)
        current_user.avatar_url = f"/uploads/avatars/{filename}"
    except Exception:
        pass

    current_user.avatar_data = avatar_b64
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)
    return current_user
