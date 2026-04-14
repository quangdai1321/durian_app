from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    # Tất cả giá trị nhạy cảm đọc từ file .env (KHÔNG hardcode ở đây)
    DATABASE_URL:                str
    SECRET_KEY:                  str
    OPENAI_API_KEY:              str = ""          # optional nếu chưa có
    ALGORITHM:                   str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080       # 7 ngày
    MODEL_PATH:                  str = "./models/best.pt"
    UPLOAD_DIR:                  str = "./uploads"
    MAX_FILE_SIZE_MB:            int = 10

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

    class Config:
        env_file = ".env"           # đọc từ backend/.env
        env_file_encoding = "utf-8"

settings = Settings()
