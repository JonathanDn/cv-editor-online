export interface RenderReadyTextBlock {
  section: string;
  text: string;
}

export interface RenderReadyCvPayload {
  cv_id: string;
  version_id: string;
  title: string;
  target_role: string | null;
  target_company: string | null;
  section_order: string[];
  text_blocks: RenderReadyTextBlock[];
  render_ready_text: string;
}

export interface KeywordGapItem {
  keyword: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface KeywordAnalysisInput {
  selectedCv: RenderReadyCvPayload;
  jobDescription: string;
}

export interface KeywordAnalysisOutput {
  cvId: string;
  snapshotId: string | 'current';
  gapsBySection: Record<string, KeywordGapItem[]>;
  analyzedAt: string;
}
