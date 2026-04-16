#!/usr/bin/env python3
"""
export_feedback_dataset.py
──────────────────────────
Export ảnh từ bảng feedback (actual_class != predicted_class) thành
cấu trúc folder dataset để retrain YOLOv26n-CLS.

Usage:
    python export_feedback_dataset.py
    python export_feedback_dataset.py --out ./my_dataset --min-count 5

Output structure:
    exported_dataset/
    ├── train/
    │   ├── Leaf_Algal/       ← ảnh mới từ feedback
    │   ├── Leaf_Blight/
    │   ├── Leaf_Colletotrichum/
    │   ├── Leaf_Healthy/
    │   ├── Leaf_Phomopsis/
    │   └── Leaf_Rhizoctonia/
    └── export_summary.json
"""

import asyncio
import base64
import json
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from config import settings
from models.models import Diagnosis, Feedback

CLASS_NAMES = [
    "Leaf_Algal", "Leaf_Blight", "Leaf_Colletotrichum",
    "Leaf_Healthy", "Leaf_Phomopsis", "Leaf_Rhizoctonia",
]


async def export(out_dir: Path, min_count: int):
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print(f"\n{'='*55}")
    print("  Export Feedback Dataset for Retraining")
    print(f"{'='*55}")
    print(f"  Output dir : {out_dir}")
    print(f"  Min images : {min_count} per class to warn")
    print()

    async with async_session() as db:
        # Query: feedback có actual_class hợp lệ + khác predicted_class
        result = await db.execute(
            select(Feedback, Diagnosis)
            .join(Diagnosis, Feedback.diagnosis_id == Diagnosis.id)
            .where(
                and_(
                    Feedback.actual_class.isnot(None),
                    Feedback.actual_class.in_(CLASS_NAMES),
                    Diagnosis.image_data.isnot(None),
                )
            )
            .order_by(Feedback.created_at.desc())
        )
        rows = result.fetchall()

    print(f"  Tổng feedback có actual_class: {len(rows)}")

    # Phân loại: misclassified vs confirmed correct
    misclassified = [(fb, diag) for fb, diag in rows if fb.actual_class != diag.predicted_class]
    confirmed_ok  = [(fb, diag) for fb, diag in rows if fb.actual_class == diag.predicted_class]

    print(f"  Nhận diện SAI (cần học lại) : {len(misclassified)}")
    print(f"  Nhận diện ĐÚNG (confirmed)  : {len(confirmed_ok)}")
    print()

    # Tạo folder structure
    train_dir = out_dir / "train"
    for cls in CLASS_NAMES:
        (train_dir / cls).mkdir(parents=True, exist_ok=True)

    # Export ảnh
    stats: dict[str, int] = {cls: 0 for cls in CLASS_NAMES}
    exported = []

    for fb, diag in misclassified:
        actual_cls = fb.actual_class
        if actual_cls not in CLASS_NAMES:
            continue

        # Decode base64 image
        try:
            img_data = fb.__dict__.get("image_data") or diag.image_data
            # Strip data URI prefix if present
            if "," in img_data:
                img_data = img_data.split(",", 1)[1]
            img_bytes = base64.b64decode(img_data)
        except Exception as e:
            print(f"  ⚠️  Skip {fb.id}: decode error — {e}")
            continue

        # Save to folder
        filename = f"fb_{fb.id}_{diag.id}.jpg"
        save_path = train_dir / actual_cls / filename
        save_path.write_bytes(img_bytes)

        stats[actual_cls] += 1
        exported.append({
            "feedback_id":     str(fb.id),
            "diagnosis_id":    str(diag.id),
            "predicted_class": diag.predicted_class,
            "actual_class":    actual_cls,
            "confidence":      float(diag.confidence or 0),
            "created_at":      str(fb.created_at),
            "saved_to":        str(save_path.relative_to(out_dir)),
        })

    # Print stats
    print("  Per-class export:")
    total_exported = 0
    for cls in CLASS_NAMES:
        n = stats[cls]
        total_exported += n
        flag = " ⚠️  (cần thêm ảnh)" if n < min_count else " ✅"
        bar  = "█" * min(n, 20)
        print(f"    {cls.replace('Leaf_',''):18s}  n={n:4d}  {bar}{flag}")

    print(f"\n  ✅ Tổng exported: {total_exported} ảnh")

    # Save summary JSON
    summary = {
        "exported_at":       datetime.now().isoformat(),
        "total_feedback":    len(rows),
        "total_misclassified": len(misclassified),
        "total_exported":    total_exported,
        "per_class":         stats,
        "items":             exported,
        "next_steps": [
            "1. Copy thư mục train/ vào Kaggle dataset của bạn",
            "2. Merge với dataset gốc (durian-leaf-final)",
            "3. Chạy lại notebook Giải Pháp 1 (5-fold)",
            "4. Download model_fold5_BEST.pt → backend/models/best.pt",
            "5. git push → Railway tự deploy",
        ],
    }
    summary_path = out_dir / "export_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  📄 Summary: {summary_path}")

    if total_exported < min_count * len(CLASS_NAMES):
        print(f"\n  ⚠️  Chưa đủ ảnh để retrain hiệu quả.")
        print(f"      Khuyến nghị: ít nhất {min_count} ảnh mới mỗi class.")
    else:
        print(f"\n  🚀 Đủ data! Sẵn sàng retrain.")

    print(f"{'='*55}\n")
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export feedback dataset for retraining")
    parser.add_argument("--out",       default="./exported_dataset", help="Output directory")
    parser.add_argument("--min-count", type=int, default=20,         help="Min images per class to consider ready")
    args = parser.parse_args()

    asyncio.run(export(Path(args.out), args.min_count))
