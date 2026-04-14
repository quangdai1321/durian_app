-- ============================================================
-- DURIAN LEAF DISEASE DETECTION APP
-- Database Schema — PostgreSQL 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100),
    phone         VARCHAR(20),
    role          VARCHAR(20)  NOT NULL DEFAULT 'farmer'
                  CHECK (role IN ('farmer','agronomist','admin')),
    province      VARCHAR(100),
    avatar_url    VARCHAR(500),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── DISEASE CLASSES ──────────────────────────────────────────
CREATE TABLE disease_classes (
    id            SERIAL PRIMARY KEY,
    code          VARCHAR(50)  UNIQUE NOT NULL,
    name_vi       VARCHAR(100) NOT NULL,
    name_en       VARCHAR(100) NOT NULL,
    scientific    VARCHAR(200),
    severity      VARCHAR(20)  DEFAULT 'moderate'
                  CHECK (severity IN ('low','moderate','high','critical')),
    description_vi TEXT,
    description_en TEXT,
    cause_vi      TEXT,
    cause_en      TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── TREATMENT STEPS ──────────────────────────────────────────
CREATE TABLE treatment_steps (
    id            SERIAL PRIMARY KEY,
    disease_id    INTEGER REFERENCES disease_classes(id) ON DELETE CASCADE,
    step_order    SMALLINT NOT NULL,
    step_vi       TEXT NOT NULL,
    step_en       TEXT NOT NULL,
    chemical      VARCHAR(200),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── DIAGNOSES ────────────────────────────────────────────────
CREATE TABLE diagnoses (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    image_path       VARCHAR(500) NOT NULL,
    image_url        VARCHAR(500),
    model_version    VARCHAR(50)  NOT NULL DEFAULT 'YOLOv26n-CLS',
    predicted_class  VARCHAR(50)  REFERENCES disease_classes(code),
    confidence       NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    inference_ms     NUMERIC(8,2),
    top3_predictions JSONB,
    latitude         NUMERIC(10,7),
    longitude        NUMERIC(10,7),
    province         VARCHAR(100),
    device_info      JSONB,
    is_verified      BOOLEAN      DEFAULT FALSE,
    verified_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at      TIMESTAMPTZ,
    notes            TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── DAILY STATISTICS ─────────────────────────────────────────
CREATE TABLE daily_stats (
    id              SERIAL PRIMARY KEY,
    stat_date       DATE NOT NULL,
    province        VARCHAR(100),
    disease_code    VARCHAR(50) REFERENCES disease_classes(code),
    total_scans     INTEGER NOT NULL DEFAULT 0,
    avg_confidence  NUMERIC(5,4),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(stat_date, province, disease_code)
);

-- ── FEEDBACK ─────────────────────────────────────────────────
CREATE TABLE feedback (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    diagnosis_id    UUID REFERENCES diagnoses(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    actual_class    VARCHAR(50) REFERENCES disease_classes(code),
    rating          SMALLINT CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    title_vi        VARCHAR(200) NOT NULL,
    title_en        VARCHAR(200),
    body_vi         TEXT,
    body_en         TEXT,
    type            VARCHAR(50) DEFAULT 'info',
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX idx_diagnoses_user     ON diagnoses(user_id);
CREATE INDEX idx_diagnoses_class    ON diagnoses(predicted_class);
CREATE INDEX idx_diagnoses_created  ON diagnoses(created_at DESC);
CREATE INDEX idx_diagnoses_location ON diagnoses(province);
CREATE INDEX idx_feedback_diag      ON feedback(diagnosis_id);
CREATE INDEX idx_notif_user         ON notifications(user_id, is_read);

-- ── AUTO-UPDATE updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
