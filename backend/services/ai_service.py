"""
═══════════════════════════════════════════════════════════════
AI Inference Service — YOLOv26n-CLS / Ultralytics
═══════════════════════════════════════════════════════════════

CÁCH CONNECT MODEL — 3 bước:
─────────────────────────────────────────────────────────────

BƯỚC 1: Sau khi train xong trên Colab/Kaggle, export model:
    ┌──────────────────────────────────────────────────────┐
    │  from ultralytics import YOLO                        │
    │  model = YOLO("runs/classify/train/weights/best.pt") │
    │  # Kiểm tra class names đúng thứ tự:                │
    │  print(model.names)                                  │
    │  # Phải ra: {0:'Leaf_Algal', 1:'Leaf_Blight', ...}  │
    └──────────────────────────────────────────────────────┘

BƯỚC 2: Copy file .pt vào thư mục backend:
    durian_app/
    └── backend/
        └── models/
            └── yolov26n_durian.pt   ← đặt ở đây

BƯỚC 3: Cập nhật .env:
    MODEL_PATH=./models/yolov26n_durian.pt

Sau đó uvicorn sẽ load model ngay khi khởi động.
Nếu không tìm thấy file .pt → tự động chạy MOCK MODE.
═══════════════════════════════════════════════════════════════

LƯU Ý thứ tự class names — phải khớp với lúc training:
  Index 0 → Leaf_Algal
  Index 1 → Leaf_Blight
  Index 2 → Leaf_Colletotrichum
  Index 3 → Leaf_Healthy
  Index 4 → Leaf_Phomopsis
  Index 5 → Leaf_Rhizoctonia

Nếu thứ tự khác, sửa CLASS_NAMES bên dưới cho đúng.
"""

import time
import base64
import asyncio
import httpx
import numpy as np
from pathlib import Path
from PIL import Image

from ..config import settings

OPENAI_KEY = settings.OPENAI_API_KEY   # đọc từ .env — không hardcode trong code


def _color_has_vegetation(image_path: str) -> tuple[bool, float]:
    """
    Kiểm tra nhanh bằng màu sắc — lá/thực vật có màu xanh lá hoặc nâu vàng.
    Trả về (has_vegetation: bool, score: float)
    """
    try:
        img  = Image.open(image_path).convert("RGB")
        arr  = np.array(img.resize((96, 96)), dtype=float)
        r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
        total = 96 * 96

        # Pixel xanh lá (kể cả lá bệnh vàng nhạt)
        green = np.sum((g > r * 0.75) & (g > b * 0.75) & (g > 35)) / total
        # Pixel nâu/vàng của lá bệnh/khô
        brown = np.sum((r > b * 1.1) & (g > b * 1.0) & (r < 220) & (g < 210) & (b < 160)) / total
        # Pixel xanh da trời (loại trừ nếu quá nhiều)
        sky   = np.sum((b > g * 0.95) & (b > r * 0.95) & (b > 90)) / total

        score = green + brown * 0.7 - sky * 0.3
        return score > 0.12, round(float(score), 3)
    except Exception:
        return True, 0.0  # fail-open nếu lỗi


async def check_is_durian_leaf(image_path: str) -> tuple[bool, str]:
    """
    Hỏi GPT-4o-mini: 'Chủ thể chính của ảnh này là gì?' (1 từ).
    Dùng cách này thay vì yes/no để tránh GPT bị lừa bởi background.
    Fail-closed: nếu API lỗi → reject.
    """
    import io
    try:
        img = Image.open(image_path).convert("RGB")
        img.thumbnail((512, 512))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode()

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_KEY}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model":       "gpt-4o-mini",
                    "max_tokens":  10,
                    "temperature": 0,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "What is the single main subject of this photo? "
                                    "Reply with ONE word only (e.g. 'leaf', 'phone', 'person', 'food', etc.)."
                                ),
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url":    f"data:image/jpeg;base64,{b64}",
                                    "detail": "low",
                                },
                            },
                        ],
                    }],
                },
            )

        if resp.status_code != 200:
            print(f"[LeafCheck] OpenAI error {resp.status_code} -> REJECT")
            return False, f"api_error:{resp.status_code}"

        subject = resp.json()["choices"][0]["message"]["content"].strip().lower()
        print(f"[LeafCheck] GPT subject='{subject}'")

        LEAF_WORDS = {
            "leaf", "leaves", "plant", "foliage", "flora",
            "vegetation", "branch", "herb", "fern", "tree",
            "durian", "shrub", "twig", "frond", "greenery",
            "garden", "grass", "nature", "crop", "agricultural",
            "jungle", "forest", "tropical", "sprout", "seedling",
        }
        is_leaf = any(w in subject for w in LEAF_WORDS)
        print(f"[LeafCheck] -> {'PASS' if is_leaf else 'REJECT'}")
        return is_leaf, subject

    except Exception as e:
        print(f"[LeafCheck] Exception: {e} -> REJECT (fail-closed)")
        return False, f"exception:{str(e)[:80]}"

# ── Thứ tự này PHẢI KHỚP với model.names khi training ────────
# Kiểm tra bằng: print(YOLO("best.pt").names)
CLASS_NAMES = [
    "Leaf_Algal",           # index 0
    "Leaf_Blight",          # index 1
    "Leaf_Colletotrichum",  # index 2
    "Leaf_Healthy",         # index 3
    "Leaf_Phomopsis",       # index 4
    "Leaf_Rhizoctonia",     # index 5
]

# ── Singleton model (load 1 lần khi server start) ─────────────
_model         = None
_model_version = "not loaded"
_model_loaded  = False   # cờ để không load lại nhiều lần


def load_model_on_startup():
    """
    Gọi hàm này 1 lần trong lifespan của FastAPI (main.py).
    Load model vào RAM ngay khi server khởi động — không phải lazy load.
    """
    global _model, _model_version, _model_loaded

    if _model_loaded:
        return  # đã load rồi, bỏ qua

    model_path = Path(settings.MODEL_PATH)

    # ── Trường hợp 1: Có file .pt của mình ──────────────────
    if model_path.exists():
        try:
            from ultralytics import YOLO
            print(f"[AI] Loading model từ: {model_path.resolve()}")
            _model = YOLO(str(model_path))

            # Tự động đọc class names từ model nếu có
            if hasattr(_model, "names") and _model.names:
                detected = list(_model.names.values())
                # So sánh với CLASS_NAMES của mình
                if detected != CLASS_NAMES:
                    print(f"[AI] WARNING: Class names trong model: {detected}")
                    print(f"[AI] WARNING: CLASS_NAMES trong code:  {CLASS_NAMES}")
                    print(f"[AI] WARNING: Neu khac -> sua CLASS_NAMES trong ai_service.py")
                else:
                    print(f"[AI] OK: Class names khop: {CLASS_NAMES}")

            _model_version = f"YOLOv26n-CLS ({model_path.name})"
            _model_loaded  = True
            print(f"[AI] OK: Model loaded thanh cong!")
            return

        except Exception as e:
            print(f"[AI] ERROR: Load model that bai: {e}")
            print(f"[AI] WARNING: Chay MOCK MODE do loi load model")
            _model         = None
            _model_version = "Mock Mode"
            _model_loaded  = True
            return

    # ── Trường hợp 2: Không có file .pt → MOCK MODE ─────────
    print(f"[AI] WARNING: Khong tim thay file model tai: {model_path.resolve()}")
    print(f"[AI] WARNING: Chay MOCK MODE - ket qua ngau nhien (chi dung de test UI)")
    _model         = None
    _model_version = "Mock Mode"
    _model_loaded  = True


def get_model_status() -> dict:
    """Trả về trạng thái model — dùng cho endpoint /health."""
    return {
        "loaded":        _model is not None,
        "version":       _model_version,
        "model_path":    settings.MODEL_PATH,
        "file_exists":   Path(settings.MODEL_PATH).exists(),
        "class_names":   CLASS_NAMES,
        "mode":          "real" if _model is not None else "mock",
    }


async def predict_image(image_path: str) -> dict:
    """
    Async wrapper — chạy inference trong thread pool để không block event loop.
    Gọi từ router: result = await predict_image(path)
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _predict_sync, image_path)


def _predict_sync(image_path: str) -> dict:
    """Chạy YOLO inference đồng bộ trên 1 ảnh (chỉ gọi sau khi đã pass leaf check)."""

    if _model is None:
        return _mock_prediction()

    t0 = time.perf_counter()
    try:
        img        = Image.open(image_path).convert("RGB")
        results    = _model.predict(img, imgsz=224, verbose=False)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        probs = results[0].probs

        top1_idx  = int(probs.top1)
        top1_conf = float(probs.top1conf)
        predicted = CLASS_NAMES[top1_idx] if top1_idx < len(CLASS_NAMES) else f"class_{top1_idx}"

        top5_idx   = probs.top5
        top5_confs = probs.top5conf.tolist()
        top3 = [
            {
                "class":      CLASS_NAMES[i] if i < len(CLASS_NAMES) else f"class_{i}",
                "confidence": round(float(c), 4),
            }
            for i, c in zip(top5_idx[:3], top5_confs[:3])
        ]

        return {
            "predicted_class": predicted,
            "confidence":      round(top1_conf, 4),
            "top3":            top3,
            "inference_ms":    round(elapsed_ms, 2),
            "model_version":   _model_version,
            "is_ood":          False,
        }

    except Exception as e:
        print(f"[AI] Prediction error: {e}")
        return _mock_prediction()


def _mock_prediction() -> dict:
    """Dữ liệu giả — chỉ dùng khi chưa có model (dev/test UI)."""
    import random
    cls    = random.choice(CLASS_NAMES)
    conf   = round(random.uniform(0.82, 0.98), 4)
    others = [c for c in CLASS_NAMES if c != cls]
    top3   = [{"class": cls, "confidence": conf}] + [
        {"class": c, "confidence": round(random.uniform(0.01, 0.10), 4)}
        for c in random.sample(others, 2)
    ]
    return {
        "predicted_class": cls,
        "confidence":      conf,
        "top3":            top3,
        "inference_ms":    round(random.uniform(4.5, 8.0), 2),
        "model_version":   "Mock Mode (no model)",
    }
