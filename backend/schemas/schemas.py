from __future__ import annotations
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ────────────────────────────────────────────────────
class UserRegister(BaseModel):
    username:  str
    email:     EmailStr
    password:  str
    full_name: Optional[str] = None
    phone:     Optional[str] = None
    province:  Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut

class UserOut(BaseModel):
    id:          UUID
    username:    str
    email:       str
    full_name:   Optional[str]
    phone:       Optional[str]
    role:        str
    province:    Optional[str]
    avatar_url:  Optional[str]
    avatar_data: Optional[str] = None   # base64 data URI — dùng khi avatar_url 404
    created_at:  datetime
    model_config = {"from_attributes": True}

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone:     Optional[str] = None
    province:  Optional[str] = None
    model_config = {"from_attributes": True}


# ── Disease ──────────────────────────────────────────────────
class TreatmentStepOut(BaseModel):
    step_order: int
    step_vi:    str
    step_en:    str
    chemical:   Optional[str]
    model_config = {"from_attributes": True}

class DiseaseOut(BaseModel):
    id:             int
    code:           str
    name_vi:        str
    name_en:        str
    scientific:     Optional[str]
    severity:       str
    cause_vi:       Optional[str]
    cause_en:       Optional[str]
    symptoms_vi:    Optional[str] = None
    season_vi:      Optional[str] = None
    steps:          List[TreatmentStepOut] = []
    model_config = {"from_attributes": True}


# ── Diagnosis ────────────────────────────────────────────────
class DiagnosisCreate(BaseModel):
    latitude:  Optional[float] = None
    longitude: Optional[float] = None
    province:  Optional[str]   = None
    notes:     Optional[str]   = None

class PredictionResult(BaseModel):
    predicted_class: str
    confidence:      float
    top3:            List[dict]
    inference_ms:    float
    model_version:   str

class DiagnosisOut(BaseModel):
    id:               UUID
    image_url:        Optional[str]
    image_data:       Optional[str] = None   # base64 data URI — dùng khi image_url 404
    model_version:    str
    predicted_class:  Optional[str]
    confidence:       float
    inference_ms:     Optional[float]
    top3_predictions: Optional[Any]
    latitude:         Optional[float]
    longitude:        Optional[float]
    province:         Optional[str]
    is_verified:      bool
    notes:            Optional[str]
    created_at:       datetime
    disease:          Optional[DiseaseOut] = None
    is_ood:           Optional[bool]  = False
    leaf_score:       Optional[float] = None
    model_config = {"from_attributes": True}

class DiagnosisList(BaseModel):
    total:  int
    items:  List[DiagnosisOut]


# ── Feedback ─────────────────────────────────────────────────
class FeedbackCreate(BaseModel):
    actual_class: Optional[str] = None
    rating:       int
    comment:      Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v):
        if not 1 <= v <= 5:
            raise ValueError("Rating must be 1–5")
        return v

class FeedbackOut(BaseModel):
    id:           UUID
    actual_class: Optional[str]
    rating:       int
    comment:      Optional[str]
    created_at:   datetime
    model_config = {"from_attributes": True}


# ── Notification ─────────────────────────────────────────────
class NotificationOut(BaseModel):
    id:         UUID
    title_vi:   str
    title_en:   Optional[str]
    body_vi:    Optional[str]
    body_en:    Optional[str]
    type:       str
    is_read:    bool
    created_at: datetime
    model_config = {"from_attributes": True}
