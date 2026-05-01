-- Create cvs table
CREATE TABLE IF NOT EXISTS cvs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  target_role TEXT,
  target_company TEXT,
  content_json JSONB NOT NULL,
  content_text TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT cvs_status_check CHECK (status IN ('active', 'archived', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_cvs_user_id ON cvs (user_id);
CREATE INDEX IF NOT EXISTS idx_cvs_user_id_status ON cvs (user_id, status);
CREATE INDEX IF NOT EXISTS idx_cvs_updated_at_desc ON cvs (updated_at DESC);
