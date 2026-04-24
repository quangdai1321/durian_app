import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    # Đọc từ environment variables (Railway inject) hoặc .env khi dev local
    DATABASE_URL:                str
    SECRET_KEY:                  str
    OPENAI_API_KEY:              str = ""          # optional nếu chưa có
    ALGORITHM:                   str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080       # 7 ngày
    MODEL_PATH:                  str = "./models/best.pt"
    UPLOAD_DIR:                  str = "./uploads"
    MAX_FILE_SIZE_MB:            int = 10

    # Production (Railway): chỉ đọc env vars, bỏ qua .env file
    # Local dev: đọc thêm .env nếu file tồn tại
    model_config = SettingsConfigDict(
        env_file=".env" if os.path.exists(".env") else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        """
        Railway cung cấp DATABASE_URL dạng postgres:// hoặc postgresql://
        nhưng asyncpg cần postgresql+asyncpg://
        """
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return "postgresql+asyncpg://" + v[len("postgres://"):]
            if v.startswith("postgresql://") and "+asyncpg" not in v:
                return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

settings = Settings()
