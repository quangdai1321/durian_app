import uuid
import aiofiles
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional

from ..database import get_db
from ..models.models import Diagnosis, DiseaseClass, User, Feedback
from ..schemas.schemas import DiagnosisOut, DiagnosisList, FeedbackCreate, FeedbackOut
from ..services.ai_service import predict_image, check_is_durian_leaf
from ..services.auth_service import get_user_by_id
from ..config import settings
from .deps import get_current_user, get_optional_user

router = APIRouter(prefix="/diagnoses", tags=["Diagnosis"])

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_BYTES    = settings.MAX_FILE_SIZE_MB * 1024 * 1024


@router.post("", response_model=DiagnosisOut, status_code=201)
async def create_diagnosis(
    file:      UploadFile = File(...),
    latitude:  Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    province:  Optional[str]   = Form(None),
    notes:     Optional[str]   = Form(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate file — allow .jpg uploaded as "blob" (no extension on web)
    fname = file.filename or "leaf.jpg"
    ext = Path(fname).suffix.lower()
    if not ext:
        ext = ".jpg"   # default for web blob uploads
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"File type not allowed. Use: {ALLOWED_EXT}")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit")

    # Save image + resize về max 800×800 để tăng tốc xử lý
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename   = f"{uuid.uuid4()}{ext}"
    image_path = upload_dir / filename

    # Resize bằng PIL trước khi lưu (giảm thời gian OpenAI + YOLO)
    try:
        from PIL import Image as PILImage
        import io
        pil_img = PILImage.open(io.BytesIO(content)).convert("RGB")
        pil_img.thumbnail((512, 512), PILImage.LANCZOS)  # max 512×512 — tối ưu cho OpenAI low + YOLO 224
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        content = buf.getvalue()
    except Exception:
        pass  # Nếu lỗi → dùng ảnh gốc

    async with aiofiles.open(image_path, "wb") as f:
        await f.write(content)

    # Lưu base64 để hiển thị ảnh khi filesystem bị xóa (Railway ephemeral)
    import base64
    image_data_b64 = "data:image/jpeg;base64," + base64.b64encode(content).decode()

    # ── Bước 1: Kiểm tra ảnh có phải lá sầu riêng không (GPT-4o vision) ──
    is_leaf, leaf_answer = await check_is_durian_leaf(str(image_path))
    if not is_leaf:
        # Xoá file đã upload (không cần lưu)
        try: image_path.unlink()
        except: pass
        # Phân biệt lỗi API vs ảnh thật sự không phải lá
        is_api_error = leaf_answer.startswith("api_error:") or leaf_answer.startswith("exception:")
        raise HTTPException(
            status_code=422,
            detail={
                "code":    "NOT_DURIAN_LEAF",
                "message": "Ảnh không phải lá sầu riêng" if not is_api_error else "Không thể xác minh ảnh",
                "hint":    (
                    "Hãy chụp rõ một lá sầu riêng, đủ sáng, không bị che khuất."
                    if not is_api_error else
                    "Dịch vụ kiểm tra ảnh tạm thời không khả dụng. Vui lòng thử lại sau."
                ),
            }
        )

    # ── Bước 2: Chạy YOLO inference ──────────────────────────────────────
    prediction = await predict_image(str(image_path))

    # Save to DB (guest users: user_id=None, not saved to history)
    user_province = province or (current_user.province if current_user else None)
    diagnosis = Diagnosis(
        user_id=current_user.id if current_user else None,
        image_path=str(image_path),
        image_url=f"/uploads/{filename}",
        image_data=image_data_b64,
        model_version=prediction["model_version"],
        predicted_class=prediction["predicted_class"],
        confidence=prediction["confidence"],
        inference_ms=prediction["inference_ms"],
        top3_predictions=prediction["top3"],
        latitude=latitude,
        longitude=longitude,
        province=user_province,
        notes=notes,
        device_info={"is_ood": prediction.get("is_ood", False), "leaf_score": prediction.get("leaf_score")},
    )
    db.add(diagnosis)
    await db.flush()

    # Eager-load disease info
    result = await db.execute(
        select(Diagnosis)
        .options(selectinload(Diagnosis.disease).selectinload(DiseaseClass.steps))
        .where(Diagnosis.id == diagnosis.id)
    )
    diag_obj = result.scalar_one()
    # Attach OOD info (not stored as column, injected from prediction)
    diag_obj.is_ood     = prediction.get("is_ood", False)
    diag_obj.leaf_score = prediction.get("leaf_score")
    return diag_obj


@router.get("", response_model=DiagnosisList)
async def list_diagnoses(
    skip:  int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_q = select(Diagnosis).where(Diagnosis.user_id == current_user.id)
    total  = (await db.execute(select(func.count()).select_from(base_q.subquery()))).scalar()
    rows   = (await db.execute(
        base_q.options(selectinload(Diagnosis.disease).selectinload(DiseaseClass.steps))
               .order_by(desc(Diagnosis.created_at))
               .offset(skip).limit(limit)
    )).scalars().all()
    return DiagnosisList(total=total, items=rows)


@router.get("/{diagnosis_id}", response_model=DiagnosisOut)
async def get_diagnosis(
    diagnosis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Diagnosis)
        .options(selectinload(Diagnosis.disease).selectinload(DiseaseClass.steps))
        .where(Diagnosis.id == diagnosis_id, Diagnosis.user_id == current_user.id)
    )
    diag = result.scalar_one_or_none()
    if not diag:
        raise HTTPException(404, "Diagnosis not found")
    return diag


@router.post("/{diagnosis_id}/feedback", response_model=FeedbackOut, status_code=201)
async def submit_feedback(
    diagnosis_id: uuid.UUID,
    body: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    diag = await db.get(Diagnosis, diagnosis_id)
    if not diag:
        raise HTTPException(404, "Diagnosis not found")

    fb = Feedback(
        diagnosis_id=diagnosis_id,
        user_id=current_user.id,
        actual_class=body.actual_class,
        rating=body.rating,
        comment=body.comment,
    )
    db.add(fb)
    await db.flush()
    await db.refresh(fb)
    return fb
