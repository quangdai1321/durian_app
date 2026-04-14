FROM python:3.11-slim

WORKDIR /app

# Cài system libs cần cho OpenCV / ultralytics (libGL, libglib2.0)
# python:3.11-slim không có libGL.so.1 mặc định
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
  && rm -rf /var/lib/apt/lists/*

# Cài Python dependencies (cache layer riêng)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ code + model
COPY . .

# Tạo thư mục uploads
RUN mkdir -p uploads

# Railway tự inject biến PORT
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
