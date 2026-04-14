import uuid
from datetime import datetime
from sqlalchemy import (Column, String, Unicode, UnicodeText, Boolean, DateTime, Numeric,
                        Integer, SmallInteger, Text, ForeignKey, JSON)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from ..database import Base

def UUID(as_uuid=False):
    return PG_UUID(as_uuid=as_uuid)


class User(Base):
    __tablename__ = "users"
    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username      = Column(String(50), unique=True, nullable=False)
    email         = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name     = Column(Unicode(100))
    phone         = Column(Unicode(20))
    role          = Column(String(20), default="farmer")
    province      = Column(Unicode(100))
    avatar_url    = Column(Unicode(500))
    avatar_data   = Column(Text)                 # base64 JPEG — persistent khi Railway restart
    yield_stats   = Column(JSON, default=list)   # list of YieldRecord dicts
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at    = Column(DateTime(timezone=True), default=datetime.utcnow)
    diagnoses     = relationship("Diagnosis", back_populates="user", foreign_keys="Diagnosis.user_id")


class DiseaseClass(Base):
    __tablename__ = "disease_classes"
    id             = Column(Integer, primary_key=True)
    code           = Column(String(50), unique=True, nullable=False)
    name_vi        = Column(Unicode(100), nullable=False)
    name_en        = Column(Unicode(100), nullable=False)
    scientific     = Column(Unicode(200))
    severity       = Column(String(20), default="moderate")
    description_vi = Column(UnicodeText)
    description_en = Column(UnicodeText)
    cause_vi       = Column(UnicodeText)
    cause_en       = Column(UnicodeText)
    created_at     = Column(DateTime(timezone=True), default=datetime.utcnow)
    steps          = relationship("TreatmentStep", back_populates="disease", order_by="TreatmentStep.step_order")


class TreatmentStep(Base):
    __tablename__ = "treatment_steps"
    id         = Column(Integer, primary_key=True)
    disease_id = Column(Integer, ForeignKey("disease_classes.id"))
    step_order = Column(SmallInteger, nullable=False)
    step_vi    = Column(UnicodeText, nullable=False)
    step_en    = Column(UnicodeText, nullable=False)
    chemical   = Column(Unicode(500))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    disease    = relationship("DiseaseClass", back_populates="steps")


class Diagnosis(Base):
    __tablename__ = "diagnoses"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    image_path       = Column(String(500), nullable=False)
    image_url        = Column(String(500))
    image_data       = Column(Text)          # base64 JPEG — persistent khi Railway restart
    model_version    = Column(String(50), default="YOLOv26n-CLS")
    predicted_class  = Column(String(50), ForeignKey("disease_classes.code"))
    confidence       = Column(Numeric(5, 4), nullable=False)
    inference_ms     = Column(Numeric(8, 2))
    top3_predictions = Column(JSON)
    latitude         = Column(Numeric(10, 7))
    longitude        = Column(Numeric(10, 7))
    province         = Column(String(100))
    device_info      = Column(JSON)
    is_verified      = Column(Boolean, default=False)
    verified_by      = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    verified_at      = Column(DateTime(timezone=True))
    notes            = Column(Text)
    created_at       = Column(DateTime(timezone=True), default=datetime.utcnow)
    user             = relationship("User", back_populates="diagnoses", foreign_keys=[user_id])
    disease          = relationship("DiseaseClass", foreign_keys=[predicted_class], primaryjoin="Diagnosis.predicted_class == DiseaseClass.code")
    feedbacks        = relationship("Feedback", back_populates="diagnosis")


class Feedback(Base):
    __tablename__ = "feedback"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    diagnosis_id = Column(UUID(as_uuid=True), ForeignKey("diagnoses.id"))
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    actual_class = Column(String(50), ForeignKey("disease_classes.code"))
    rating       = Column(SmallInteger)
    comment      = Column(Text)
    created_at   = Column(DateTime(timezone=True), default=datetime.utcnow)
    diagnosis    = relationship("Diagnosis", back_populates="feedbacks")


class Notification(Base):
    __tablename__ = "notifications"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title_vi   = Column(String(200), nullable=False)
    title_en   = Column(String(200))
    body_vi    = Column(Text)
    body_en    = Column(Text)
    type       = Column(String(50), default="info")
    is_read    = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
