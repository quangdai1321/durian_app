"""
AI Chat Proxy — chuyển tiếp request từ frontend đến OpenAI
Lý do proxy qua backend:
  • OPENAI_API_KEY không bị lộ trong code frontend / app bundle
  • Có thể rate-limit, log, kiểm soát chi phí từ server
"""
from fastapi import APIRouter, Depends, HTTPException
import httpx

from .deps import get_optional_user
from ..models.models import User
from ..config import settings

router = APIRouter(prefix="/ai", tags=["AI Chat"])


@router.post("/chat")
async def ai_chat(body: dict, current_user: User | None = Depends(get_optional_user)):
    """
    Proxy chat completion request đến OpenAI gpt-4o-mini.
    Frontend gửi: { messages: [...], max_tokens: int }
    Không yêu cầu đăng nhập — guest cũng dùng được.
    """
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="AI service chưa được cấu hình (OPENAI_API_KEY trống)")

    messages   = body.get("messages", [])
    max_tokens = int(body.get("max_tokens", 400))
    temperature = float(body.get("temperature", 0.7))

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model":       "gpt-4o-mini",
                    "messages":    messages,
                    "max_tokens":  max_tokens,
                    "temperature": temperature,
                },
            )
        if resp.status_code != 200:
            err_body = resp.json()
            detail   = err_body.get("error", {}).get("message", f"OpenAI error {resp.status_code}")
            print(f"[AI Chat] OpenAI {resp.status_code}: {detail}")
            raise HTTPException(status_code=502, detail=detail)
        return resp.json()

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Không kết nối được AI: {str(e)[:120]}")
