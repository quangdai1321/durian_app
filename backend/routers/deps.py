from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..services.auth_service import decode_token, get_user_by_id
from ..models.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await get_user_by_id(db, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_optional_user(
    token: str | None = Depends(oauth2_optional),
    db: AsyncSession = Depends(get_db)
) -> User | None:
    """Returns current user if authenticated, None if guest."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user = await get_user_by_id(db, payload.get("sub"))
    return user if (user and user.is_active) else None


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
