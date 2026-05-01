ALTER TABLE cvs ADD COLUMN IF NOT EXISTS folder_id TEXT NOT NULL DEFAULT 'inbox';

CREATE TABLE IF NOT EXISTS cv_tags (
  cv_id BIGINT NOT NULL REFERENCES cvs(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cv_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_cvs_user_id_folder_id ON cvs (user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_cv_tags_tag ON cv_tags (tag);
