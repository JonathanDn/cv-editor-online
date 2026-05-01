import type { CvEntity, CvStatus } from '../models/cv';

export type CvRow = CvEntity;

export interface CreateCvInput {
  user_id: number;
  title: string;
  target_role?: string | null;
  target_company?: string | null;
  content_json: Record<string, unknown>;
  content_text?: string | null;
  status?: CvStatus;
  last_opened_at?: string;
}

export interface UpdateCvInput {
  title?: string;
  target_role?: string | null;
  target_company?: string | null;
  content_json?: Record<string, unknown>;
  content_text?: string | null;
  status?: CvStatus;
  updated_at?: string;
  last_opened_at?: string;
  deleted_at?: string | null;
}
