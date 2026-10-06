/** Read-only presentation of saved review evidence. Never authorizes a transition. */
export interface ReviewConcern {
  component: string;
  code: string;
  label: string;
  informationNeeded: string;
  scope: string | null;
  recordedAt: string | null;
}
export interface WorkbenchSermon {
  id: string;
  title: string;
  serviceDate: string;
  speaker: string | null;
  publicationStatus: string;
  rowVersion: number;
  complete: boolean;
  localCompletion?: boolean;
  language?: 'en'|'ar';
  previouslyAccepted: boolean;
  concerns: ReviewConcern[];
}
export interface WorkbenchSnapshot {
  data: WorkbenchSermon[];
  checkedAt: string;
  counts: { total: number; complete: number; attention: number };
}

export function concernLabel(component: string, code: string): string {
  if (/redact|missing_word|source_word|wording/u.test(code)) return "Source wording needs checking";
  if (/negation/u.test(code)) return "Uncertain wording changes the meaning";
  const names: Record<string, string> = {
    identity: "Confirm the sermon identity", speaker: "Identify the speaker",
    passage: "Confirm the primary passage", transcript: "Check the source transcript",
    findings: "Resolve the source findings", media: "Verify the recording",
    description: "Check the description", questions: "Check the Q&A",
    freshness: "Acceptance needs rechecking", completion: "Finish the private review"
  };
  return names[component] ?? "Review the saved evidence";
}

export function reviewDestination(id: string, component: string): string {
  const stage = ({ identity: 1, speaker: 1, passage: 1, findings: 2, transcript: 3,
    description: 4, questions: 5, media: 1, freshness: 6, completion: 6 } as Record<string, number>)[component] ?? 2;
  return `/admin/sermons/${encodeURIComponent(id)}/review?viewStage=${stage}`;
}

export function summarizeWorkbench(data: WorkbenchSermon[], checkedAt: string): WorkbenchSnapshot {
  const complete = data.filter(row => row.complete).length;
  return { data, checkedAt, counts: { total: data.length, complete, attention: data.length - complete } };
}
