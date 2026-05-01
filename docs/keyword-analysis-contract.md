# Keyword Analysis Contract (Future Module)

This contract keeps My CVs API unchanged while allowing a keyword/gap analysis module to plug in.

## Input

- `selectedCv`: CV payload selected by user (current or snapshot render-ready data).
- `jobDescription`: raw job description text (string).

```ts
interface KeywordAnalysisInput {
  selectedCv: RenderReadyCvPayload;
  jobDescription: string;
}
```

## Output

- `gapsBySection`: missing or weak alignment grouped by CV section.
- Output is descriptive only; no write-back to CV APIs.

```ts
interface KeywordGapItem {
  keyword: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

interface KeywordAnalysisOutput {
  cvId: string;
  snapshotId: string | 'current';
  gapsBySection: Record<string, KeywordGapItem[]>;
  analyzedAt: string;
}
```

## Integration Notes

1. Consumer fetches `/api/cvs/:id/render-ready-text?version=current|<snapshotId>`.
2. Consumer sends response as `selectedCv` input to analysis module.
3. Analysis module returns `KeywordAnalysisOutput` and UI renders gap insights.
4. No changes required for existing `/api/cvs` CRUD endpoints.
