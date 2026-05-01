export type CvStatus = 'active' | 'archived' | 'deleted';

export interface CvEntity {
  id: number;
  user_id: number;
  title: string;
  target_role: string | null;
  target_company: string | null;
  content_json: Record<string, unknown>;
  content_text: string | null;
  status: CvStatus;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  deleted_at: string | null;
  folder_id: string;
}
