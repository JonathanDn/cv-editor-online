-- Create cv_snapshots table
CREATE TABLE IF NOT EXISTS cv_snapshots (
  id BIGSERIAL PRIMARY KEY,
  cv_id BIGINT NOT NULL,
  content_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL,
  CONSTRAINT cv_snapshots_reason_check CHECK (reason IN ('manual_save', 'autosave_checkpoint')),
  CONSTRAINT cv_snapshots_cv_id_fk FOREIGN KEY (cv_id) REFERENCES cvs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cv_snapshots_cv_id_created_at_desc
  ON cv_snapshots (cv_id, created_at DESC);
