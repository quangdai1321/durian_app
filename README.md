# 🌱 Ứng Dụng Nhận Diện Bệnh Lá Sầu Riêng
## Durian Leaf Disease Detection App

**Stack:**
- Frontend: React Native (Expo) — iOS & Android
- Backend: Python FastAPI + YOLOv8/v26
- Database: PostgreSQL + SQLAlchemy
- Auth: JWT
- Storage: Local filesystem / S3-compatible

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
