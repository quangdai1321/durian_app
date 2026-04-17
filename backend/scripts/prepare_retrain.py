#!/usr/bin/env python3
"""
prepare_retrain.py
──────────────────
Chuẩn bị dataset để retrain trên Kaggle:
1. Export feedback images từ DB
2. Merge với dataset gốc (nếu có sẵn local)
3. In hướng dẫn upload lên Kaggle

Usage:
    python prepare_retrain.py
    python prepare_retrain.py --original-dataset ./durian_leaf_original
"""

import asyncio
import json
import os
import shutil
import sys
import argparse
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

CLASS_NAMES = [
    "Leaf_Algal", "Leaf_Blight", "Leaf_Colletotrichum",
    "Leaf_Healthy", "Leaf_Phomopsis", "Leaf_Rhizoctonia",
]

SPLITS = ["train", "val", "test"]


def count_images(folder: Path) -> int:
    if not folder.exists():
        return 0
    return sum(1 for f in folder.glob("*")
               if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"})


async def run(original_dataset: Path | None, out_dir: Path, min_count: int):
    print(f"\n{'='*60}")
    print("  Prepare Retrain Dataset")
    print(f"{'='*60}\n")

    # ── Bước 1: Export feedback ──────────────────────────────────
    print("📥 Bước 1: Export feedback từ DB...")
    feedback_dir = out_dir / "feedback_images"

    from export_feedback_dataset import export
    await export(feedback_dir, min_count)

    # Đếm feedback images
    feedback_stats = {}
    for cls in CLASS_NAMES:
        feedback_stats[cls] = count_images(feedback_dir / "train" / cls)

    total_feedback = sum(feedback_stats.values())
    print(f"\n✅ Tổng feedback images: {total_feedback}")

    if total_feedback == 0:
        print("⚠️  Chưa có feedback data. Dùng dataset gốc để retrain.")

    # ── Bước 2: Merge với dataset gốc ───────────────────────────
    merged_dir = out_dir / "merged_dataset"
    print(f"\n📦 Bước 2: Tạo merged dataset tại: {merged_dir}")

    for split in SPLITS:
        for cls in CLASS_NAMES:
            (merged_dir / split / cls).mkdir(parents=True, exist_ok=True)

    merged_stats = {split: {cls: 0 for cls in CLASS_NAMES} for split in SPLITS}

    # Copy từ dataset gốc (nếu có)
    if original_dataset and original_dataset.exists():
        print(f"  📂 Copy từ dataset gốc: {original_dataset}")
        for split in SPLITS:
            for cls in CLASS_NAMES:
                src = original_dataset / split / cls
                dst = merged_dir / split / cls
                if src.exists():
                    for f in src.glob("*"):
                        if f.suffix.lower() in {".jpg", ".jpeg", ".png"}:
                            shutil.copy2(f, dst / f.name)
                            merged_stats[split][cls] += 1
    else:
        print("  ⚠️  Không tìm thấy dataset gốc local.")
        print("     → Chỉ dùng feedback images (thêm vào train split)")

    # Thêm feedback images vào train split
    if total_feedback > 0:
        print(f"  ➕ Thêm {total_feedback} feedback images vào train split...")
        for cls in CLASS_NAMES:
            src_dir = feedback_dir / "train" / cls
            dst_dir = merged_dir / "train" / cls
            if src_dir.exists():
                for f in src_dir.glob("*.jpg"):
                    # Đặt tên riêng để tránh trùng
                    dst_name = f"fb_{f.name}"
                    shutil.copy2(f, dst_dir / dst_name)
                    merged_stats["train"][cls] += 1

    # ── Bước 3: In thống kê ──────────────────────────────────────
    print(f"\n📊 Bước 3: Thống kê merged dataset:")
    print(f"\n  {'Class':<25} {'Train':>7} {'Val':>7} {'Test':>7} {'Total':>7} {'Feedback':>10}")
    print(f"  {'-'*65}")
    for cls in CLASS_NAMES:
        tr = merged_stats["train"][cls]
        va = merged_stats.get("val", {}).get(cls, 0)
        te = merged_stats.get("test", {}).get(cls, 0)
        fb = feedback_stats.get(cls, 0)
        total = tr + va + te
        flag = " ⭐" if fb > 0 else ""
        print(f"  {cls:<25} {tr:>7} {va:>7} {te:>7} {total:>7} {fb:>8}{flag}")

    # ── Bước 4: Tạo notebook config patch ───────────────────────
    config_patch = {
        "retrain_date":     datetime.now().isoformat(),
        "total_feedback":   total_feedback,
        "merged_stats":     merged_stats,
        "kaggle_instructions": {
            "step1": f"Upload thư mục '{merged_dir.name}' lên Kaggle Dataset mới",
            "step2": "Đổi DATASET_PATH trong Cell 2 của notebook thành path mới",
            "step3": "Chạy lại toàn bộ notebook (Run All)",
            "step4": "Download model_fold5_BEST.pt từ /kaggle/working/",
            "step5": "Copy vào backend/models/best.pt → git push → Railway deploy",
        },
        "notebook_cell2_patch": {
            "DATASET_PATH": "/kaggle/input/YOUR_NEW_DATASET/merged_dataset",
            "note": "Thay YOUR_NEW_DATASET bằng slug dataset bạn vừa upload"
        }
    }

    config_path = out_dir / "retrain_config.json"
    config_path.write_text(
        json.dumps(config_patch, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    # ── Bước 5: Hướng dẫn ───────────────────────────────────────
    print(f"\n{'='*60}")
    print("  ✅ Chuẩn bị xong! Các bước tiếp theo:")
    print(f"{'='*60}")
    print(f"""
  1. Upload '{merged_dir}' lên Kaggle:
     kaggle datasets create -p "{merged_dir}" -u

  2. Mở notebook Giải Pháp 1 trên Kaggle
     Đổi Cell 2 — DATASET_PATH:
     DATASET_PATH = Path("/kaggle/input/YOUR_DATASET/merged_dataset")

  3. Run All → chờ ~30 phút (2x Tesla T4)

  4. Download model_fold5_BEST.pt:
     kaggle kernels output YOUR_NOTEBOOK -p ./

  5. Deploy:
     cp model_fold5_BEST.pt ../backend/models/best.pt
     cd ../
     git add backend/models/best.pt
     git commit -m "feat: retrain model v{datetime.now().strftime('%Y%m%d')} with {total_feedback} new feedback images"
     git push origin main
     # Railway tự deploy!

  📄 Chi tiết: {config_path}
""")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--original-dataset", default=None,
                        help="Path tới dataset gốc local (train/val/test folders)")
    parser.add_argument("--out",       default="./retrain_output")
    parser.add_argument("--min-count", type=int, default=10)
    args = parser.parse_args()

    original = Path(args.original_dataset) if args.original_dataset else None
    asyncio.run(run(original, Path(args.out), args.min_count))
