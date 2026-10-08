import { renderCms } from './cms/editor';
import {
  allowedDashboardActions,
  buildControlledMediaInputs,
  buildDeletionSeoDisposition,
  expectedPublicSermonUrl,
  isResolvedReviewDecision,
  shouldWarnAboutSlugChange,
  unresolvedReviewQueue
} from "./dashboard-model";
import type { SermonStatus } from "../domain/sermon";
import { renderWorkbench, workbenchBanner } from "./workbench";
import type { WorkbenchSnapshot } from "../domain/admin-workbench";
import {renderCompletedSermon} from './completed-sermon';
import { remainingPrivateReviewRequirements, substantiveDecisionLabel, type DelegatedContentStatus } from "../domain/delegated-review-status";
import type { RemainingReviewStatus } from "../domain/remaining-ai-review";
import { privateComponentAccepted, privateCompletionAttribution, privateCompletionIsCurrent, remainingComponentLabel } from "../domain/remaining-review-display";
import { bibleBooks } from "../domain/bible-passage";
import { selectedReviewBook, changedReviewBookSelection, reviewBookOptions } from "../domain/review-metadata";
import {
  isSupersededWave1SourceReference,
  parseGroundedSermonEnrichmentSourceReference
} from "../enrichment/sermon-enrichment-policy";

type Relationship = { id: string; name: string; slug: string };
type Readiness = {
  isComplete: boolean;
  isContentComplete: boolean;
  hasOneSpeaker: boolean;
  hasRequiredBibleBook: boolean;
  hasRequiredPassageDecision: boolean;
  hasApprovedDescription: boolean;
  hasApprovedTranscript: boolean;
  approvedQuestionCount: number;
  totalQuestionCount: number;
  hasRequiredQuestionAnswers: boolean;
  allQuestionsApproved: boolean;
  hasValidControlledMedia: boolean;
  issues: Array<{ path: string; code: string; message: string }>;
};
type SermonSummary = {
  delegatedReview?: DelegatedContentStatus;
  remainingReview?: RemainingReviewStatus;
  id: string;
  title: string;
  slug: string;
  status: SermonStatus;
  serviceDate: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  rowVersion: number;
  updatedAt: string;
  speaker: Relationship | null;
  series: Relationship[];
  historicalBackfillRequired: boolean;
  enrichmentReview: {
    currentStage: number;
    completedAt: string | null;
    pendingItemCount: number;
    totalItemCount: number;
  } | null;
  primaryPassage?: {
    state: "proposed_passage" | "confirmed_passage" | "pending_review" | "no_primary_passage" | "no_proposal_detected" | "proposal_rejected";
    displayText: string | null;
  };
  youtubeSource: { videoId: string; canonicalUrl: string } | null;
  readiness: Readiness;
};
type ScriptureReference = {
  id: string;
  displayText: string;
  canonicalBookId: number | null;
  startChapter: number | null;
  startVerse: number | null;
  endChapter: number | null;
  endVerse: number | null;
  parseStatus: string;
  relationshipRole: "primary" | "supporting" | "unclassified";
  isLead: boolean;
  originalReferenceText: string | null;
  provenance: "legacy_import" | "administrator" | "title_proposal" | "administrator_correction";
  reviewStatus: "unreviewed" | "proposed" | "confirmed" | "rejected";
  reviewerSubject: string | null;
  reviewedAt: string | null;
  parserVersion: string | null;
  rowVersion: number;
};
type ControlledMedia = {
  id: string;
  provider: "youtube" | "sermonaudio";
  mediaType: "video" | "audio";
  externalId: string | null;
  canonicalUrl: string;
  title: string;
};
type SermonDetail = SermonSummary & {
  summary: string | null;
  summaryStatus: "missing" | "draft" | "in_review" | "approved";
  summarySourceKind: "manual" | "imported" | "generated_draft";
  summarySourceReference: string | null;
  summaryCreatedAt: string | null;
  summaryUpdatedAt: string | null;
  summaryReviewedAt: string | null;
  summaryApprovedAt: string | null;
  summaryRowVersion: number;
  seoDescription: string | null;
  body: string | null;
  books: Relationship[];
  scriptureReferences: ScriptureReference[];
  primaryPassageReview: {
    proposalOutcome: "proposed" | "no_reference" | "manual_review_required" | "administrator_entered";
    evidenceSource: "local_youtube_title" | "administrator";
    parserVersion: string;
    reviewStatus: "pending" | "confirmed_passage" | "confirmed_none" | "rejected";
    reviewedBySubject: string | null;
    reviewedAt: string | null;
    rowVersion: number;
  } | null;
  media: ControlledMedia[];
  transcript: {
    bodyText: string;
    status: "missing" | "draft" | "in_review" | "approved";
    sourceKind: string;
    sourceReference: string | null;
    rowVersion: number;
    reviewedAt: string | null;
    approvedAt: string | null;
  } | null;
  questionAnswers: Array<{
    id: string;
    question: string;
    answer: string;
    displayOrder: number;
    status: "draft" | "in_review" | "approved";
    sourceKind: string;
    sourceReference: string | null;
    rowVersion: number;
    reviewedAt: string | null;
    approvedAt: string | null;
  }>;
  generatedTextMechanicalQa: {
    version: "generated-text-mechanical-qa-v1";
    completed: true;
    outcome: "passed" | "passed_with_review_flags" | "failed";
    blockingIssueCount: number;
    reviewIssueCount: number;
    issues: Array<{
      code: string;
      severity: "blocking" | "review";
      contentArea: "description" | "question" | "answer";
      itemIndex: number | null;
      characterIndex: number;
      autoCorrectable: boolean;
    }>;
  } | null;
  enrichmentSource: {
    provider: "youtube";
    videoId: string;
    canonicalUrl: string;
    captionLanguage: string;
    captionTrackType: "manual" | "automatic" | "unknown";
    originalFilename: string;
    sourceContentSha256: string;
    retrievalAttribution: "authorised_youtube_studio_export" | "authorised_youtube_data_api";
    sourceCharacterCount: number;
    cleanedCharacterCount: number;
    apparentCompleteness: "apparently_complete" | "requires_manual_review";
    uncertaintyMarkerCount: number;
    warnings: Array<{ code: string; safeDetail: string }>;
    warningResolutionStatus: "unresolved" | "resolved_by_completed_review";
    unresolvedPassages: Array<{ marker: string; safeReason: string }>;
    processingVersion: string;
    importedAt: string;
    processedAt: string;
    processingDurationMs: number;
    estimatedReviewMinutes: number;
    manualAttentionRequired: boolean;
    accuracyReviewStatus: "required";
  } | null;
};
type Taxonomy = Relationship & {
  kind: "speakers" | "series" | "books";
  description: string | null;
  canonicalBookId: number | null;
  administratorSermonCount: number;
  publicSermonCount: number;
  rowVersion: number;
  updatedAt: string;
};
type ListResponse = {
  data: SermonSummary[];
  countsByStatus: Record<SermonStatus, number>;
  readinessProgress: {
    total: number;
    complete: number;
    remaining: number;
    withOneSpeaker: number;
    withRequiredBibleBook: number;
    withRequiredPassageDecision: number;
    contentComplete: number;
    withApprovedDescription: number;
    withApprovedTranscript: number;
    withRequiredQuestionAnswers: number;
    withValidControlledMedia: number;
  };
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};
type EnrichmentReviewItem = {
  id: string;
  identitySha256: string;
  sourceRecordKey: string;
  category: "caption_error" | "name_or_scripture_reference";
  displayOrder: number;
  categoryOrdinal: number;
  label: string;
  detail: string;
  supportingParagraphs: number[];
  sourceMarker: string | null;
  decisionStatus: "pending" | "accepted" | "corrected" | "left_unresolved" | "rejected";
  correctionText: string | null;
  transcriptRowVersion: number;
  decidedBySubject: string | null;
  decidedAt: string | null;
  rowVersion: number;
  associatedWording: string | null;
  associationStatus: "exact" | "missing" | "ambiguous";
  context: { before: string; flagged: string; after: string } | null;
  supportingContext: Array<{ paragraphNumber: number; text: string }>;
};
type EnrichmentReviewResponse = {
  sermon: SermonDetail;
  recordPosition: number;
  recordCount: number;
  review: {
    identityStatus: "pending" | "confirmed";
    currentStage: number;
    emptyItemSetAcknowledgedBySubject: string | null;
    emptyItemSetAcknowledgedAt: string | null;
    completedAt: string | null;
    rowVersion: number;
  };
  items: EnrichmentReviewItem[];
  progress: {
    resolvedItemCount: number;
    unresolvedItemCount: number;
    totalItemCount: number;
    presentItemCount: number;
    itemSetMatches: boolean;
    transcriptMatchesExpected: boolean;
    reviewSetVerified: boolean;
    requiresEmptyItemSetAcknowledgement: boolean;
    stageCompletion: {
      identity: boolean;
      findings: boolean;
      transcript: boolean;
      description: boolean;
      questionAnswers: boolean;
      final: boolean;
    };
    completedStageCount: number;
    percentReviewed: number;
    canFinish: boolean;
  };
};

class DashboardRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly issues: Array<{ path: string; message: string }> = []
  ) {
    super(code);
  }
}

const main = document.querySelector<HTMLElement>("#admin-main")!;
const announcer = document.querySelector<HTMLElement>("#admin-announcer")!;
const menuButton = document.querySelector<HTMLButtonElement>(".menu-button")!;
let dirty = false;

const stateDescriptions: Record<SermonStatus, string> = {
  draft: "Work in progress; not public.",
  pending: "Submitted for editorial review; not public.",
  scheduled: "Complete and set to publish later; not public yet.",
  published: "Visible on the public website.",
  unpublished: "Previously published but currently hidden.",
  archived: "Removed from active editing and public view."
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function humanDate(value: string | null): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(date);
}

function announce(message: string): void {
  announcer.textContent = "";
  window.setTimeout(() => (announcer.textContent = message), 20);
}

function setBusy(value: boolean): void {
  main.setAttribute("aria-busy", String(value));
}

function feedback(message: string, error = false): string {
  return `<div class="feedback${error ? " error" : ""}" role="${error ? "alert" : "status"}">${escapeHtml(message)}</div>`;
}

function youtubeSourceLink(
  source: SermonSummary["youtubeSource"],
  visibleText: "Open video" | "Watch source video on YouTube" = "Watch source video on YouTube"
): string {
  if (!source) return '<span class="no-source-link">No YouTube link</span>';
  return `<a class="source-video-link" href="${escapeHtml(source.canonicalUrl)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="${escapeHtml(visibleText)} — source sermon video (opens in a new tab)">${escapeHtml(visibleText)} <span class="external-link-icon" aria-hidden="true">↗</span></a>`;
}

function errorMessage(error: unknown): string {
  if (error instanceof DashboardRequestError) {
    if (error.status === 409 && error.code === "stale_write") {
      return "This sermon changed after you opened it. Reload the record before trying again.";
    }
    if (error.issues.length) return error.issues.map((issue) => `${issue.path || "request"}: ${issue.message}`).join(" · ");
    const known: Record<string, string> = {
      authentication_required: "Local administrator access was not accepted.",
      forbidden: "This identity is not approved for administration.",
      duplicate_value: "That slug is already in use.",
      redirect_conflict: "The previous URL already has an unrelated SEO disposition.",
      not_found: "The requested record was not found.",
      invalid_request: "Review the highlighted values and try again."
    };
    return known[error.code] ?? `The request failed (${error.code}).`;
  }
  return "An unexpected local error occurred. No production system was contacted.";
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (document.body.hasAttribute("data-cms-runtime")) {
    if (!["GET", "HEAD"].includes(init.method ?? "GET")) {
      const sessionResponse = await fetch("/api/v1/admin/cms/session");
      if (!sessionResponse.ok) throw new DashboardRequestError(401, "unauthenticated");
      const session = await sessionResponse.json() as { csrfToken: string };
      headers.set("x-csrf-token", session.csrfToken);
    }
  } else headers.set("x-local-identity", "admin");
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as {
    error?: { code?: string; issues?: Array<{ path: string; message: string }> };
  };
  if (!response.ok) {
    throw new DashboardRequestError(
      response.status,
      payload.error?.code ?? "request_failed",
      payload.error?.issues ?? []
    );
  }
  return payload as T;
}

function routeKey(pathname: string): string {
  if (pathname.startsWith("/admin/cms")) return "cms";
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
  if (pathname === "/admin/sermons/new") return "new";
  if (pathname === "/admin/remaining-reviews") return "remaining-reviews";
  if (pathname === "/admin/ai-reviews") return "ai-reviews";
  if (pathname.startsWith("/admin/sermons")) return "sermons";
  if (pathname.includes("/taxonomies/speakers")) return "speakers";
  if (pathname.includes("/taxonomies/series")) return "series";
  if (pathname.includes("/taxonomies/books")) return "books";
  if (pathname.startsWith("/admin/audit")) return "audit";
  return "dashboard";
}

function updateNavigation(): void {
  const current = routeKey(location.pathname);
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-nav]")) {
    if (link.dataset.nav === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function confirmDiscard(): boolean {
  return !dirty || window.confirm("Discard your unsaved changes?");
}

async function navigate(path: string, replace = false): Promise<void> {
  if (!confirmDiscard()) return;
  dirty = false;
  if (replace) history.replaceState({}, "", path);
  else history.pushState({}, "", path);
  setNavigationOpen(false);
  await renderRoute();
}

function pageHeading(title: string, description: string, action = ""): string {
  return `<header class="page-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action}</header>`;
}

function sermonRows(sermons: SermonSummary[]): string {
  if (!sermons.length) return `<tr><td colspan="6" class="empty-state"><strong>No sermons match these filters.</strong><br />Try clearing a filter or choosing another content task.</td></tr>`;
  return sermons.map((sermon) => {
    const passage = sermon.primaryPassage ?? { state: "no_proposal_detected" as const, displayText: null };
    const stateLabels = {
      proposed_passage: "Proposed passage",
      confirmed_passage: "Reviewed passage",
      pending_review: "Pending review",
      no_primary_passage: "No single primary passage",
      no_proposal_detected: "No proposal detected",
      proposal_rejected: "Proposal rejected"
    } as const;
    return `<tr>
    <td data-label="Sermon" class="sermon-identity"><a href="/admin/sermons/${sermon.id}${sermon.enrichmentReview ? "/review" : ""}" data-route>${escapeHtml(sermon.title)}</a><div class="subtle">${escapeHtml(humanDate(sermon.serviceDate))} · ${escapeHtml(sermon.speaker?.name ?? "Speaker unresolved")}</div>${sermon.series.length ? `<div class="subtle">Series: ${escapeHtml(sermon.series.map((item) => item.name).join(", "))}</div>` : ""}</td>
    <td data-label="Primary passage"><div>${passage.displayText ? `<strong>${escapeHtml(passage.displayText)}</strong><div class="subtle">${escapeHtml(stateLabels[passage.state])}</div>` : escapeHtml(stateLabels[passage.state])}${sermon.remainingReview?.components.passage.accepted ? `<div class="subtle">${escapeHtml(remainingComponentLabel(sermon.remainingReview,"passage"))}</div>` : ""}</div></td>
    <td data-label="Private review">${compactPrivateReviewStatus(sermon)}</td>
    <td data-label="Publication"><div><span class="status-pill ${escapeHtml(sermon.status)}">${escapeHtml(sermon.status)}</span>${sermon.scheduledFor ? `<div class="subtle">Scheduled: ${escapeHtml(humanDate(sermon.scheduledFor))}</div>` : ""}</div></td>
    <td data-label="YouTube">${youtubeSourceLink(sermon.youtubeSource, "Open video")}</td>
    <td data-label="Open"><div><a class="button quiet" href="/admin/sermons/${sermon.id}${sermon.enrichmentReview ? "/review" : ""}" data-route>${sermon.enrichmentReview ? "Review" : "Open"}</a><a class="metadata-link" href="/admin/sermons/${sermon.id}" data-route>Metadata</a></div></td>
  </tr>`;
  }).join("");
}

async function renderDashboard(): Promise<void> {
  const snapshot = await api<WorkbenchSnapshot>("/api/v1/admin/workbench");
  renderWorkbench(main, snapshot, location.pathname === "/admin/sermons" ? "all" : "attention");
}

async function loadTaxonomies(): Promise<Record<"speakers" | "series" | "books", Taxonomy[]>> {
  const [speakers, series, books] = await Promise.all([
    api<{ data: Taxonomy[] }>("/api/v1/admin/taxonomies/speakers"),
    api<{ data: Taxonomy[] }>("/api/v1/admin/taxonomies/series"),
    api<{ data: Taxonomy[] }>("/api/v1/admin/taxonomies/books")
  ]);
  return { speakers: speakers.data, series: series.data, books: books.data };
}

function filterOption(items: Taxonomy[], selected: string, placeholder: string): string {
  return `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) => `<option value="${item.id}"${item.id === selected ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}`;
}

function canonicalBookFilterOptions(selectedBookId: number | null): string {
  return `<option value="">All Bible books</option>${(["old", "new"] as const).map((testament) =>
    `<optgroup label="${testament === "old" ? "Old Testament" : "New Testament"}">${bibleBooks
      .filter((book) => book.testament === testament)
      .map((book) => `<option value="${book.id}"${selectedBookId === book.id ? " selected" : ""}>${escapeHtml(book.canonicalName)}</option>`)
      .join("")}</optgroup>`
  ).join("")}`;
}

function numberedFilterOptions(maximum: number, selected: number | null, allLabel: string): string {
  const values = Array.from({ length: maximum }, (_, index) => index + 1);
  return `<option value="">${escapeHtml(allLabel)}</option>${values.map((value) =>
    `<option value="${value}"${selected === value ? " selected" : ""}>${value}</option>`
  ).join("")}`;
}

const enrichmentReviewStages = [
  "Identity and provenance",
  "Flagged review items",
  "Complete transcript",
  "Sermon description",
  "Ordered questions and answers",
  "Final review summary"
] as const;

function plainReviewStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: "Not reviewed",
    accepted: "Wording accepted",
    corrected: "Correction recorded",
    left_unresolved: "Left unresolved",
    rejected: "Transcript rejected",
    missing: "Not started",
    draft: "Draft — private",
    in_review: "Awaiting a decision",
    approved: "Approved — still private while sermon is draft"
  };
  return labels[status] ?? status;
}

function transcriptTokenCount(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

function reviewStageComplete(review: EnrichmentReviewResponse, stage: number): boolean {
  const completion = review.progress.stageCompletion;
  return [
    completion.identity,
    completion.findings,
    completion.transcript,
    completion.description,
    completion.questionAnswers,
    completion.final
  ][stage - 1] ?? false;
}

function reviewStageNavigation(review: EnrichmentReviewResponse): string {
  return `<nav class="review-stage-nav" aria-label="Sermon review stages">
    <ol>${enrichmentReviewStages.map((label, index) => {
      const stage = index + 1;
      const complete = reviewStageComplete(review, stage);
      const current = review.review.currentStage === stage;
      return `<li><button type="button" class="review-stage-button${current ? " current" : ""}" data-review-view="${stage}"${current ? ' aria-current="step"' : ""}>
        <span class="review-stage-number">${stage}</span>
        <span><strong>${escapeHtml(label)}</strong><small>${complete ? "Guided step saved" : current ? "Viewing this step" : "Open evidence / controls"}</small></span>
        <span class="review-stage-mark" aria-label="${complete ? "Complete" : "Not complete"}">${complete ? "✓" : "○"}</span>
      </button></li>`;
    }).join("")}</ol>
  </nav>`;
}

function technicalProvenance(source: NonNullable<SermonDetail["enrichmentSource"]>): string {
  return `<details class="technical-provenance">
    <summary>Technical provenance</summary>
    <dl class="provenance-grid">
      <dt>Original file</dt><dd>${escapeHtml(source.originalFilename)}</dd>
      <dt>Source SHA-256</dt><dd><code>${escapeHtml(source.sourceContentSha256)}</code></dd>
      <dt>Processing version</dt><dd>${escapeHtml(source.processingVersion)}</dd>
      <dt>Processed</dt><dd>${escapeHtml(humanDate(source.processedAt))}</dd>
      <dt>Characters</dt><dd>${source.sourceCharacterCount.toLocaleString()} source / ${source.cleanedCharacterCount.toLocaleString()} cleaned</dd>
      <dt>Estimated reading time</dt><dd>${source.estimatedReviewMinutes} minutes</dd>
    </dl>
  </details>`;
}

function reviewStageActions(review: EnrichmentReviewResponse, stage: number): string {
  const currentComplete = reviewStageComplete(review, stage);
  return `<div class="review-stage-actions">
    ${stage > 1 ? `<button class="button" type="button" data-review-stage="${stage - 1}">Back: ${escapeHtml(enrichmentReviewStages[stage - 2])}</button>` : ""}
    <button class="button quiet" type="button" data-review-pause>Save and pause</button>
    ${stage < 6 ? `<button class="button primary" type="button" data-review-stage="${stage + 1}"${currentComplete ? "" : ' disabled aria-disabled="true"'}>Next: ${escapeHtml(enrichmentReviewStages[stage])}</button>` : ""}
  </div>`;
}

type PrimaryPassageEditorValue = {
  canonicalBookId: number | null;
  startChapter: number | null;
  startVerse: number | null;
  endChapter: number | null;
  endVerse: number | null;
  relationshipRole: "primary" | "supporting";
  isLead: boolean;
};

function primaryPassageBookOptions(selectedBookId: number | null): string {
  return `<option value="">Choose a canonical book</option>${(["old", "new"] as const).map((testament) =>
    `<optgroup label="${testament === "old" ? "Old Testament" : "New Testament"}">${bibleBooks
      .filter((book) => book.testament === testament)
      .map((book) => `<option value="${book.id}"${selectedBookId === book.id ? " selected" : ""}>${escapeHtml(book.canonicalName)}</option>`)
      .join("")}</optgroup>`
  ).join("")}`;
}

function primaryPassageEditorRow(value: PrimaryPassageEditorValue, index: number): string {
  return `<fieldset class="primary-passage-row" data-primary-passage-row>
    <legend>Passage <span data-primary-passage-number>${index + 1}</span></legend>
    <div class="review-form-grid">
      <label><span>Bible book</span><select data-primary-book data-primary-passage-control>${primaryPassageBookOptions(value.canonicalBookId)}</select></label>
      <label><span>Starting chapter (optional)</span><input data-primary-start-chapter data-primary-passage-control type="number" min="1" max="150" value="${value.startChapter ?? ""}" /></label>
      <label><span>Starting verse (optional)</span><input data-primary-start-verse data-primary-passage-control type="number" min="1" max="176" value="${value.startVerse ?? ""}" /></label>
      <label><span>Ending chapter (optional)</span><input data-primary-end-chapter data-primary-passage-control type="number" min="1" max="150" value="${value.endChapter ?? ""}" /></label>
      <label><span>Ending verse (optional)</span><input data-primary-end-verse data-primary-passage-control type="number" min="1" max="176" value="${value.endVerse ?? ""}" /></label>
      <label><span>Relationship</span><select data-primary-role data-primary-passage-control><option value="primary"${value.relationshipRole === "primary" ? " selected" : ""}>Primary preaching passage</option><option value="supporting"${value.relationshipRole === "supporting" ? " selected" : ""}>Supporting passage</option></select></label>
      <label class="checkbox-label"><input data-primary-lead data-primary-passage-control type="checkbox"${value.isLead ? " checked" : ""} /> <span>Lead primary passage</span></label>
    </div>
    <button class="button quiet" type="button" data-remove-primary-passage data-primary-passage-control>Remove passage</button>
  </fieldset>`;
}

function primaryPassageReviewPanel(sermon: SermonDetail): string {
  const review = sermon.primaryPassageReview;
  if (!review) return "";
  const candidates = sermon.scriptureReferences.filter((reference) =>
    (reference.reviewStatus === "proposed" || reference.reviewStatus === "confirmed" || reference.reviewStatus === "unreviewed") &&
    (reference.relationshipRole === "primary" || reference.relationshipRole === "supporting")
  );
  const values: PrimaryPassageEditorValue[] = candidates.length
    ? candidates.map((reference) => ({
        canonicalBookId: reference.canonicalBookId,
        startChapter: reference.startChapter,
        startVerse: reference.startVerse,
        endChapter: reference.endChapter,
        endVerse: reference.endVerse,
        relationshipRole: reference.relationshipRole as "primary" | "supporting",
        isLead: reference.isLead
      }))
    : [{ canonicalBookId: null, startChapter: null, startVerse: null, endChapter: null, endVerse: null, relationshipRole: "primary", isLead: true }];
  const humanStatus = review.reviewStatus === "pending"
    ? "Awaiting administrator decision"
    : review.reviewStatus === "confirmed_passage"
      ? "Reviewed passage"
      : review.reviewStatus === "confirmed_none"
        ? "No single primary passage confirmed"
        : "Title proposal rejected";
  const aiPassageAccepted = Boolean(sermon.remainingReview?.components.passage.accepted && sermon.remainingReview.components.passage.state !== "human_approved");
  const status = aiPassageAccepted ? remainingComponentLabel(sermon.remainingReview,"passage") : humanStatus;
  const proposal = aiPassageAccepted
    ? sermon.remainingReview?.passageBasis === "no_single_primary"
      ? "The delegated source review found a topical or multi-passage sermon, not one primary passage. No book or passage was invented and no human confirmation was recorded."
      : "The delegated source review accepts the current primary-passage evidence. This is separately attributed AI acceptance, not a human passage confirmation."
    : review.reviewStatus === "confirmed_passage"
    ? "This reviewed passage was carried forward or confirmed through an attributed administrator decision."
    : review.proposalOutcome === "proposed"
    ? "One structured reference was proposed from the locally stored YouTube title. Verify it personally before confirming."
    : review.proposalOutcome === "no_reference"
      ? "No usable primary reference was found in the locally stored YouTube title. Enter one manually only if the sermon has a clear primary passage."
      : review.proposalOutcome === "manual_review_required"
        ? "The title could not support a single safe proposal. Enter verified passages manually or reject the proposal."
        : "This passage was entered through administrator controls.";
  return `<section class="source-summary" aria-labelledby="primary-passage-heading" data-primary-passage-panel>
    <div><p class="eyebrow">Structured Scripture metadata</p><h3 id="primary-passage-heading">Primary preaching passage</h3><p><strong>${escapeHtml(status)}</strong></p><p>${escapeHtml(proposal)}</p>${aiPassageAccepted ? `<p>Stored human passage field: ${escapeHtml(humanStatus)} (unchanged). No repeated human decision is required for this delegated private-review requirement. Publication requirements remain separate and unchanged.</p>` : ""}<p>${youtubeSourceLink(sermon.youtubeSource)}</p><p class="field-hint">This decision does not change transcript, description, Q&amp;A, guided-review completion or publication state.</p></div>
    <div id="primary-passage-feedback"></div>
    <div class="stack" id="primary-passage-rows">${values.map(primaryPassageEditorRow).join("")}</div>
    <div class="action-row">
      <button class="button" type="button" id="add-primary-passage" data-primary-passage-control>Add passage</button>
      <button class="button primary" type="button" id="confirm-primary-passages" data-primary-passage-control>Confirm entered passages</button>
      <button class="button" type="button" id="reject-primary-passage" data-primary-passage-control>Reject title proposal</button>
      <button class="button quiet" type="button" id="confirm-no-primary-passage" data-primary-passage-control>No single primary passage / topical or multi-passage sermon</button>
    </div>
  </section>`;
}

function renderIdentityReviewStage(
  review: EnrichmentReviewResponse,
  speakers: Taxonomy[],
  books: Taxonomy[]
): string {
  const sermon = review.sermon;
  const source = sermon.enrichmentSource!;
  const unresolvedDate = sermon.serviceDate === "1970-01-01";
  const completed = review.progress.stageCompletion.final;
  const canonicalBooks = reviewBookOptions(sermon.books, books);
  const selectedBookId = selectedReviewBook(sermon.books, sermon.scriptureReferences, canonicalBooks);
  return `<form id="review-identity-form" class="review-stage-panel stack" novalidate>
    <header class="review-stage-heading"><h2>Identity and provenance</h2><p>Confirm that this draft belongs to the correct sermon before reviewing its words. Nothing here publishes content.</p></header>
    <div id="review-stage-feedback"></div>
    <div class="review-form-grid">
      <label><span>Sermon title</span><input name="title" required maxlength="240" value="${escapeHtml(sermon.title)}"${completed ? " readonly" : ""} /></label>
      <label><span>Speaker</span><select name="speakerId" required${completed ? " disabled" : ""}>${filterOption(speakers, sermon.speaker?.id ?? "", "Select the verified speaker")}</select><small class="field-hint">${sermon.speaker ? "Saved speaker prefilled. Check and confirm; preselection is not approval." : "Speaker unresolved. Check the source evidence before selecting."}</small></label>
      <label><span>Service date</span><input name="serviceDate" type="date" value="${unresolvedDate ? "" : escapeHtml(sermon.serviceDate)}"${completed ? " readonly" : ""} /><small class="field-hint">${unresolvedDate ? "Date unresolved — verify and enter the preached date." : "Confirm this is the date preached."}</small></label>
      <div class="review-readonly-field"><span>Draft status</span><strong>Draft • Private</strong><small>Review and approval do not publish this sermon.</small></div>
      <label><span>Primary Bible book</span><select name="bookClassificationId" data-initial-book="${escapeHtml(selectedBookId)}">${filterOption(canonicalBooks, selectedBookId, "No Bible book assigned")}</select><small class="field-hint">${selectedBookId ? "Prefilled from saved book or primary-passage metadata. Check and confirm; preselection is not approval." : "No unambiguous saved book. Review the primary-passage evidence below."} Saving an unchanged selection preserves existing classifications and secondary passages.</small></label>
    </div>
    <section class="source-summary" aria-labelledby="source-summary-heading">
      <div><p class="eyebrow">Private source</p><h3 id="source-summary-heading">${source.retrievalAttribution === "authorised_youtube_data_api" ? "Authorised official YouTube API captions" : "Authorised YouTube Studio export"}</h3></div>
      <p>${youtubeSourceLink(sermon.youtubeSource)}</p>
      <dl class="source-facts">
        <div><dt>Video identity</dt><dd><code>${escapeHtml(source.videoId)}</code></dd></div>
        <div><dt>Caption language</dt><dd>${escapeHtml(source.captionLanguage)}</dd></div>
        <div><dt>Caption track</dt><dd>${source.captionTrackType === "unknown" ? "Not identified by the export" : escapeHtml(source.captionTrackType)}</dd></div>
        <div><dt>Source review</dt><dd>${sermon.remainingReview ? escapeHtml(remainingComponentLabel(sermon.remainingReview,"transcript")) : "Administrator verification required"}</dd></div>
      </dl>
      ${technicalProvenance(source)}
    </section>
    ${primaryPassageReviewPanel(sermon)}
    <div class="review-decision-bar">
      <button class="button${completed ? " primary" : ""}" type="submit" data-identity-action="save">${completed ? "Save Bible-book assignment" : "Save identity draft"}</button>
      ${completed ? "" : '<button class="button primary" type="submit" data-identity-action="confirm">Save and confirm identity</button>'}
    </div>
  </form>`;
}

function renderFlaggedReviewStage(review: EnrichmentReviewResponse): string {
  const resolvedItems = review.items.filter((item) => isResolvedReviewDecision(item.decisionStatus));
  const emptyItemSet = review.progress.totalItemCount === 0;
  const emptyItemSetAcknowledged = review.review.emptyItemSetAcknowledgedAt !== null;
  return `<section class="review-stage-panel" aria-labelledby="flagged-review-heading">
    <header class="review-stage-heading"><h2 id="flagged-review-heading">Flagged review items</h2><p>Review the exact associated transcript wording. Accepting leaves it unchanged; correcting saves the edited wording and decision together.</p></header>
    <div id="review-stage-feedback"></div>
    ${review.progress.reviewSetVerified
      ? ""
      : `<div class="callout"><strong>Review set verification failed.</strong><p>The expected identities, item total or transcript version does not match. Decisions and completion remain blocked until the private review set is safely restored.</p></div>`}
    ${emptyItemSet
      ? `<div class="review-item-toolbar"><p aria-live="polite"><strong>0</strong> remaining &bull; 0 resolved of 0</p></div>
        <div class="empty-state${emptyItemSetAcknowledged ? " review-stage-complete" : ""}">
          <strong>${emptyItemSetAcknowledged ? "The empty finding set was explicitly acknowledged." : "No atomic flagged review items were generated for this source."}</strong>
          <p>${emptyItemSetAcknowledged
            ? `Recorded by ${escapeHtml(review.review.emptyItemSetAcknowledgedBySubject ?? "an authorised administrator")}${review.review.emptyItemSetAcknowledgedAt ? ` on ${escapeHtml(humanDate(review.review.emptyItemSetAcknowledgedAt))}` : ""}. This did not approve any content.`
            : review.progress.reviewSetVerified
              ? "Inspect this verified empty state, then explicitly acknowledge it. This action does not approve the transcript, description or questions and answers."
              : "The zero count cannot be acknowledged until the item-set and transcript expectations are verified."}</p>
          ${review.progress.requiresEmptyItemSetAcknowledgement
            ? '<button class="button primary" type="button" id="acknowledge-empty-review-set">Confirm inspection of no flagged items</button>'
            : ""}
        </div>`
      : `<div class="review-item-toolbar">
          <label><span>Category</span><select id="review-item-category"><option value="all">All categories</option><option value="caption_error">Caption wording</option><option value="name_or_scripture_reference">Names or Scripture references</option></select></label>
          <p aria-live="polite"><strong>${review.progress.unresolvedItemCount}</strong> remaining &bull; ${review.progress.resolvedItemCount} resolved of ${review.progress.totalItemCount}${review.progress.presentItemCount === review.progress.totalItemCount ? "" : ` &bull; ${review.progress.presentItemCount} currently present`}</p>
        </div>
        <div id="review-item-card">${review.progress.unresolvedItemCount === 0
          ? '<div class="empty-state review-stage-complete"><strong>Every flagged item has an explicit resolving decision.</strong><p>No content was approved. Continue to the transcript stage when you are ready to review the complete draft.</p></div>'
          : ""}</div>`}
    ${emptyItemSet ? "" : `<details class="review-resolved-history">
      <summary>Resolved history (${resolvedItems.length})</summary>
      ${resolvedItems.length
        ? `<ol>${resolvedItems.map((item) => `<li>
            <div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(reviewItemCategoryLabel(item.category))} &bull; ${escapeHtml(plainReviewStatus(item.decisionStatus))}</span></div>
            <p>Recorded by ${escapeHtml(item.decidedBySubject ?? "an authorised administrator")}${item.decidedAt ? ` on ${escapeHtml(humanDate(item.decidedAt))}` : ""}.</p>
            ${item.decisionStatus === "corrected" && item.sourceMarker && item.correctionText
              ? `<details><summary>Read-only wording change</summary><dl><div><dt>Original wording</dt><dd>${escapeHtml(item.sourceMarker)}</dd></div><div><dt>Corrected wording</dt><dd>${escapeHtml(item.correctionText)}</dd></div></dl></details>`
              : ""}
          </li>`).join("")}</ol>`
        : "<p>No findings have been resolved.</p>"}
    </details>`}
    ${reviewStageActions(review, 2)}
  </section>`;
}

function renderTranscriptReviewStage(review: EnrichmentReviewResponse): string {
  const transcript = review.sermon.transcript;
  const body = transcript?.bodyText ?? "";
  const approvalBlocked = !review.progress.stageCompletion.findings;
  return `<form id="review-transcript-form" class="review-stage-panel stack" novalidate>
    <header class="review-stage-heading"><h2>Complete transcript</h2><p>Read the complete draft in a comfortable workspace. Saving edits does not approve them.</p></header>
    <div id="review-stage-feedback"></div>
    <div class="review-content-status"><span>Human transcript approval</span><strong>${transcript?.status === "approved" ? "Human approved" : "Not human approved"}</strong></div><p class="subtle">This is separate from retained-caption AI review and restricted acceptance. A draft can be privately accepted without human approval; saving an edit does not publish it or complete a review.</p>
    ${approvalBlocked ? `<div class="callout"><strong>Approval is blocked.</strong><p>${review.progress.totalItemCount === 0 ? "Verify and explicitly acknowledge the empty finding set first." : `Resolve ${review.progress.unresolvedItemCount} flagged review item${review.progress.unresolvedItemCount === 1 ? "" : "s"} first.`}</p></div>` : ""}
    <label class="review-editor-label"><span>Complete transcript</span><textarea id="review-transcript-body" name="transcriptBody" maxlength="500000" required>${escapeHtml(body)}</textarea></label>
    <p class="review-counts" id="review-transcript-counts">${body.length.toLocaleString()} characters • ${transcriptTokenCount(body).toLocaleString()} tokens</p>
    <div class="review-decision-bar">
      <button class="button" type="submit" data-transcript-action="save">Save transcript draft</button>
      <button class="button danger" type="submit" data-transcript-action="reject">Reject and keep as draft</button>
      <button class="button primary" type="submit" data-transcript-action="approve"${approvalBlocked ? " disabled" : ""}>Approve transcript</button>
    </div>
    ${reviewStageActions(review, 3)}
  </form>`;
}

const generatedTextIssueLabels: Record<string, string> = {
  jesus_incorrect_capitalisation: "Jesus capitalisation",
  christ_incorrect_capitalisation: "Christ capitalisation",
  sentence_initial_lowercase: "sentence-start capitalisation",
  repeated_spacing: "repeated spacing",
  space_before_punctuation: "punctuation spacing",
  duplicated_punctuation: "duplicated punctuation",
  broken_sentence_join: "broken sentence join",
  possible_caption_fragment: "possible caption fragment",
  biblical_name_or_book_capitalisation: "biblical name or book capitalisation",
  contextual_divine_term_capitalisation: "context-sensitive divine term",
  inconsistent_name_or_place_spelling: "inconsistent name or place spelling"
};

function generatedTextQaCallout(
  sermon: SermonDetail,
  contentAreas: readonly ("description" | "question" | "answer")[],
  itemIndex?: number
): string {
  const findings = sermon.generatedTextMechanicalQa?.issues.filter((finding) =>
    contentAreas.includes(finding.contentArea) && (itemIndex === undefined || finding.itemIndex === itemIndex)) ?? [];
  if (findings.length === 0) return "";
  const blockers = findings.filter((finding) => finding.severity === "blocking").length;
  const reviewFlags = findings.length - blockers;
  const categories = [...new Set(findings.map((finding) => generatedTextIssueLabels[finding.code] ?? "editorial issue"))];
  return `<div class="callout"><strong>${blockers > 0 ? "Mechanical proofreading failed." : "Mechanical proofreading needs human attention."}</strong><p>${blockers} blocking issue${blockers === 1 ? "" : "s"}; ${reviewFlags} contextual review flag${reviewFlags === 1 ? "" : "s"}. Categories: ${escapeHtml(categories.join(", "))}. Automated checks do not decide theology or meaning.</p></div>`;
}

function renderDescriptionReviewStage(review: EnrichmentReviewResponse): string {
  const summary = review.sermon.summary ?? "";
  const quarantined = isSupersededWave1SourceReference(review.sermon.summarySourceReference);
  const mechanicalBlockers = review.sermon.generatedTextMechanicalQa?.issues.filter((finding) =>
    finding.contentArea === "description" && finding.severity === "blocking").length ?? 0;
  return `<form id="review-description-form" class="review-stage-panel stack" novalidate>
    <header class="review-stage-heading"><h2>Sermon description</h2><p>Review the visible description separately from the transcript. Approval still does not publish the sermon.</p></header>
    <div id="review-stage-feedback"></div>
    ${quarantined ? '<div class="callout"><strong>Superseded defective generation — replacement required.</strong><p>This extractive Wave 1 description is retained privately for evidence, but it cannot enter review or be approved. A transcript-grounded replacement must be prepared first.</p></div>' : ""}
    ${generatedTextQaCallout(review.sermon, ["description"])}
    <div class="review-content-status"><span>Substantive review</span><strong>${escapeHtml(review.sermon.delegatedReview ? substantiveDecisionLabel(review.sermon.delegatedReview.description) : plainReviewStatus(review.sermon.summaryStatus))}</strong></div>
    ${review.sermon.delegatedReview?.descriptionComplete ? '<p>Substantive review is satisfied for these exact bytes. Repeated human description review is not required. Editing makes prior AI acceptance stale; human approval and publication remain separate.</p>' : ""}
    <label class="review-editor-label"><span>Sermon description</span><textarea id="review-description-body" name="summary" maxlength="2000" required>${escapeHtml(summary)}</textarea><small class="field-hint">Approval requires 80–2,000 characters of useful plain text.</small></label>
    <p class="review-counts" id="review-description-counts">${summary.trim().length.toLocaleString()} of 80–2,000 characters</p>
    <div class="review-decision-bar">
      <button class="button" type="submit" data-description-review-action="save">Save description draft</button>
      <button class="button danger" type="submit" data-description-review-action="reject">Reject and return to draft</button>
      <button class="button primary" type="submit" data-description-review-action="approve"${summary.trim().length < 80 || quarantined || mechanicalBlockers > 0 ? " disabled" : ""}>Approve description</button>
    </div>
    ${reviewStageActions(review, 4)}
  </form>`;
}

function reviewQuestionCard(sermon: SermonDetail, item: SermonDetail["questionAnswers"][number], index: number, total: number): string {
  const quarantined = isSupersededWave1SourceReference(item.sourceReference);
  const mechanicalBlockers = sermon.generatedTextMechanicalQa?.issues.filter((finding) =>
    finding.itemIndex === index && finding.severity === "blocking" &&
    (finding.contentArea === "question" || finding.contentArea === "answer")).length ?? 0;
  return `<form class="review-qa-card" data-review-qa="${escapeHtml(item.id)}">
    <header><div><p>Question ${index + 1} of ${total}</p><h3>Question ${index + 1}</h3></div><span class="status-pill">${escapeHtml(sermon.delegatedReview ? substantiveDecisionLabel(sermon.delegatedReview.questions.find(q=>q.artifactKey===`qa:${item.id}`)) : plainReviewStatus(item.status))}</span></header>
    ${generatedTextQaCallout(sermon, ["question", "answer"], index)}
    <label><span>Question</span><textarea name="question" maxlength="1000" required>${escapeHtml(item.question)}</textarea></label>
    <label><span>Answer</span><textarea name="answer" maxlength="10000" required>${escapeHtml(item.answer)}</textarea></label>
    <div class="qa-order-actions" aria-label="Reorder question ${index + 1}">
      <button class="button quiet" type="button" data-qa-move="up"${index === 0 ? " disabled" : ""}>Move up</button>
      <button class="button quiet" type="button" data-qa-move="down"${index === total - 1 ? " disabled" : ""}>Move down</button>
    </div>
    <div class="review-decision-bar">
      <button class="button" type="submit" data-qa-action="save">Save pair</button>
      <button class="button danger" type="submit" data-qa-action="reject">Reject pair</button>
      <button class="button primary" type="submit" data-qa-action="approve"${quarantined || mechanicalBlockers > 0 ? " disabled" : ""}>Approve pair</button>
    </div>
  </form>`;
}

function renderQuestionReviewStage(review: EnrichmentReviewResponse): string {
  const questions = [...review.sermon.questionAnswers].sort((a, b) => a.displayOrder - b.displayOrder);
  const approved = questions.filter((item) => item.status === "approved").length;
  const quarantined = questions.some((item) => isSupersededWave1SourceReference(item.sourceReference));
  return `<section class="review-stage-panel" aria-labelledby="qa-review-heading">
    <header class="review-stage-heading"><h2 id="qa-review-heading">Ordered questions and answers</h2><p>Five to ten ordered current pairs must each have a human approval or valid delegated AI acceptance. Accepted unchanged pairs do not require repeated substantive human review.</p></header>
    <div id="review-stage-feedback"></div>
    ${quarantined ? '<div class="callout"><strong>Superseded defective generation — replacement required.</strong><p>These extractive Wave 1 Q&A bodies are retained privately for evidence, but no pair can enter review or be approved until it has been replaced from the approved transcript.</p></div>' : ""}
    <div class="review-content-status"><span>Collection progress</span><strong>${approved} human approved; ${review.sermon.delegatedReview?.aiAcceptedQuestions ?? 0} AI reviewed and accepted; ${questions.length} current pairs in total.</strong></div>
    <div class="review-qa-list">${questions.map((item, index) => reviewQuestionCard(review.sermon, item, index, questions.length)).join("")}</div>
    ${reviewStageActions(review, 5)}
  </section>`;
}

function finalChecklistItem(label: string, complete: boolean, detail: string): string {
  return `<li class="${complete ? "complete" : "incomplete"}"><span aria-hidden="true">${complete ? "✓" : "○"}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div></li>`;
}

function renderFinalReviewStage(review: EnrichmentReviewResponse): string {
  const sermon = review.sermon;
  const dateConfirmed = review.progress.stageCompletion.identity && sermon.serviceDate !== "1970-01-01";
  return `<section class="review-stage-panel" aria-labelledby="final-review-heading">
    <header class="review-stage-heading"><h2 id="final-review-heading">Final review summary</h2><p>Finishing records that the editorial review is complete. It does not submit, schedule or publish this draft.</p></header>
    <div id="review-stage-feedback"></div>
    <ul class="checklist review-final-checklist">
      ${finalChecklistItem("One speaker verified", privateComponentAccepted(sermon.remainingReview,"speaker",review.review.identityStatus === "confirmed" && Boolean(sermon.speaker)), sermon.remainingReview ? remainingComponentLabel(sermon.remainingReview,"speaker") : sermon.speaker ? "A verified speaker is selected." : "Return to Identity and choose the speaker.")}
      ${finalChecklistItem("Primary-passage evidence reviewed", privateComponentAccepted(sermon.remainingReview,"passage",sermon.readiness.hasRequiredPassageDecision), sermon.remainingReview ? remainingComponentLabel(sermon.remainingReview,"passage") : sermon.readiness.hasRequiredPassageDecision ? (sermon.primaryPassage?.state === "no_primary_passage" ? "No single primary passage was explicitly confirmed." : "A structurally valid primary passage was confirmed.") : "Confirm a valid primary passage or explicitly record that the sermon has no single primary passage.")}
      ${finalChecklistItem("Service date confirmed", dateConfirmed, dateConfirmed ? "The preached date was verified." : "The service date is unresolved.")}
      ${finalChecklistItem("Provenance reviewed", review.progress.stageCompletion.identity, sermon.remainingReview ? remainingComponentLabel(sermon.remainingReview,"identity") : "Source identity, language, track and attribution were presented in Stage 1.")}
      ${finalChecklistItem("Finding set reviewed", review.progress.stageCompletion.findings, sermon.remainingReview ? `${remainingComponentLabel(sermon.remainingReview,"findings")}. Original findings and human decisions remain preserved.` : review.progress.totalItemCount === 0 ? review.progress.stageCompletion.findings ? "The verified empty set was explicitly acknowledged." : "The verified empty set requires an explicit acknowledgement." : `${review.progress.resolvedItemCount} of ${review.progress.totalItemCount} items resolved.`)}
      ${finalChecklistItem("Transcript source review", review.progress.stageCompletion.transcript, sermon.remainingReview ? remainingComponentLabel(sermon.remainingReview,"transcript") : plainReviewStatus(sermon.transcript?.status ?? "missing"))}
      ${finalChecklistItem("Description substantive review", review.progress.stageCompletion.description, sermon.delegatedReview ? substantiveDecisionLabel(sermon.delegatedReview.description) : plainReviewStatus(sermon.summaryStatus))}
      ${finalChecklistItem("Five to ten current Q&A pairs reviewed", review.progress.stageCompletion.questionAnswers, `${sermon.questionAnswers.filter((item) => item.status === "approved").length} human approved; ${sermon.delegatedReview?.aiAcceptedQuestions ?? 0} AI reviewed and accepted; ${sermon.questionAnswers.length} current pairs.`)}
      ${finalChecklistItem("Controlled media valid", privateComponentAccepted(sermon.remainingReview,"media",sermon.readiness.hasValidControlledMedia), sermon.remainingReview ? remainingComponentLabel(sermon.remainingReview,"media") : sermon.readiness.hasValidControlledMedia ? "Controlled media passed validation." : "Controlled media still requires attention.")}
      ${finalChecklistItem("Sermon remains draft and unpublished", sermon.status === "draft" && sermon.publishedAt === null, `Current sermon state: ${sermon.status}.${sermon.publishedAt !== null ? " Previously published records cannot finish this private-only workflow." : ""}`)}
    </ul>
    <div class="review-decision-bar">
      <button class="button" type="button" data-review-pause>Save and pause</button>
      <button class="button primary" type="button" id="finish-enrichment-review"${review.progress.canFinish ? "" : " disabled"}>Finish review</button>
    </div>
    ${review.progress.stageCompletion.final ? `<p class="feedback">${sermon.remainingReview ? escapeHtml(privateCompletionAttribution(sermon.remainingReview)) : "Existing human private completion preserved"}. The sermon remains draft and private.</p>` : sermon.remainingReview?.canComplete ? '<p class="feedback">Evidence requirements are satisfied. Separate audited AI private-completion persistence remains outstanding; no human approval is implied.</p>' : ""}
  </section>`;
}

function reviewStageMarkup(review: EnrichmentReviewResponse, speakers: Taxonomy[], books: Taxonomy[]): string {
  const stage = review.review.currentStage;
  if (stage === 1) return renderIdentityReviewStage(review, speakers, books);
  if (stage === 2) return renderFlaggedReviewStage(review);
  if (stage === 3) return renderTranscriptReviewStage(review);
  if (stage === 4) return renderDescriptionReviewStage(review);
  if (stage === 5) return renderQuestionReviewStage(review);
  return renderFinalReviewStage(review);
}

type ReviewFeedbackTarget = () => HTMLElement | null;

function reviewItemCategoryLabel(category: EnrichmentReviewItem["category"]): string {
  if (category === "caption_error") return "Caption wording";
  return "Name or Scripture reference";
}

function reviewItemCardMarkup(
  item: EnrichmentReviewItem,
  position: number,
  total: number,
  decisionsEnabled: boolean
): string {
  const associationExact = item.associationStatus === "exact" && item.associatedWording !== null;
  return `<article class="review-item-card" data-review-item-card="${escapeHtml(item.id)}">
    <header>
      <div><p>${escapeHtml(reviewItemCategoryLabel(item.category))} • Item ${position} of ${total}</p><h3>${escapeHtml(item.label)}</h3></div>
      <span class="status-pill">${escapeHtml(plainReviewStatus(item.decisionStatus))}</span>
    </header>
    <p class="review-item-guidance">${escapeHtml(item.detail)}</p>
    ${associationExact
      ? `<label class="review-correction review-associated-wording"><span>Associated transcript wording</span><textarea id="review-item-correction" maxlength="500000" spellcheck="true">${escapeHtml(item.associatedWording!)}</textarea><small class="field-hint">Edit the transcript wording itself. Keep the same blank-line-separated paragraph boundaries so other finding associations stay stable.</small></label>`
      : `<div class="callout"><strong>Exact wording association unavailable</strong><p>${item.associationStatus === "ambiguous" ? "The stored paragraph association is duplicated or ambiguous." : "The expected associated paragraph is missing from this transcript version."} This item remains unresolved and no decision can be saved.</p></div>`}
    <details class="review-finding-evidence">
      <summary>Review finding evidence and paragraph references</summary>
      ${item.supportingContext.length
        ? `<section class="review-supporting-context" aria-label="Supporting transcript context">${item.supportingContext.map((context) => `<article><strong>Paragraph ${context.paragraphNumber}</strong><p>${escapeHtml(context.text)}</p></article>`).join("")}</section>`
        : "<p>Supporting context is unavailable.</p>"}
    </details>
    <div class="review-decision-bar" aria-label="Decision for ${escapeHtml(item.label)}">
      <button class="button" type="button" data-review-item-decision="accepted"${decisionsEnabled && associationExact ? "" : " disabled"}>Accept wording</button>
      <button class="button primary" type="button" data-review-item-decision="corrected"${decisionsEnabled && associationExact ? "" : " disabled"}>Correct wording</button>
      <button class="button" type="button" data-review-item-decision="left_unresolved"${decisionsEnabled && associationExact ? "" : " disabled"}>Leave unresolved</button>
      <button class="button danger" type="button" data-review-item-decision="rejected"${decisionsEnabled && associationExact ? "" : " disabled"}>Reject transcript</button>
    </div>
    <p class="field-hint">Leaving an item unresolved or rejecting the transcript records your decision but continues to block transcript approval.</p>
    <div class="review-item-pager">
      <button class="button quiet" type="button" data-review-item-offset="-1"${position <= 1 ? " disabled" : ""}>Previous item</button>
      <button class="button quiet" type="button" data-review-item-offset="1"${position >= total ? " disabled" : ""}>Next item</button>
    </div>
  </article>`;
}

function wireFlaggedReviewItems(
  review: EnrichmentReviewResponse,
  id: string,
  feedbackTarget: ReviewFeedbackTarget
): void {
  document.querySelector<HTMLButtonElement>("#acknowledge-empty-review-set")?.addEventListener(
    "click",
    async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      try {
        button.disabled = true;
        await api<EnrichmentReviewResponse>(
          `/api/v1/admin/sermons/${id}/review/empty-item-set/acknowledge`,
          {
            method: "POST",
            body: JSON.stringify({
              sermonRowVersion: review.sermon.rowVersion,
              reviewRowVersion: review.review.rowVersion,
              transcriptRowVersion: review.sermon.transcript!.rowVersion
            })
          }
        );
        announce("The verified empty finding set was explicitly acknowledged; no content was approved");
        await renderGuidedSermonReview(id);
      } catch (error) {
        button.disabled = false;
        feedbackTarget()!.innerHTML = feedback(errorMessage(error), true);
      }
    }
  );
  const cardTarget = document.querySelector<HTMLElement>("#review-item-card");
  const categoryFilter = document.querySelector<HTMLSelectElement>("#review-item-category");
  if (!cardTarget || !categoryFilter) return;
  let currentIndex = 0;
  let selectedCategory = categoryFilter.value;
  let saving = false;

  const filteredItems = () => unresolvedReviewQueue(review.items, categoryFilter.value);

  const renderCard = () => {
    const items = filteredItems();
    currentIndex = Math.max(0, Math.min(currentIndex, items.length - 1));
    if (!items.length) {
      cardTarget.innerHTML = review.progress.unresolvedItemCount === 0
        ? '<div class="empty-state review-stage-complete"><strong>Every flagged item has an explicit resolving decision.</strong><p>No content was approved. Continue to the transcript stage when you are ready.</p></div>'
        : '<div class="empty-state"><strong>No unresolved items match this category.</strong><p>Choose another category to continue.</p></div>';
      return;
    }
    const item = items[currentIndex]!;
    cardTarget.innerHTML = reviewItemCardMarkup(
      item,
      currentIndex + 1,
      items.length,
      review.progress.itemSetMatches && review.progress.transcriptMatchesExpected
    );
    const correction = cardTarget.querySelector<HTMLTextAreaElement>("#review-item-correction");
    correction?.addEventListener("input", () => { dirty = true; });
    for (const button of cardTarget.querySelectorAll<HTMLButtonElement>("[data-review-item-offset]")) {
      button.addEventListener("click", () => {
        if (!confirmDiscard()) return;
        dirty = false;
        currentIndex += Number(button.dataset.reviewItemOffset);
        renderCard();
        cardTarget.focus({ preventScroll: true });
      });
    }
    for (const button of cardTarget.querySelectorAll<HTMLButtonElement>("[data-review-item-decision]")) {
      button.addEventListener("click", async () => {
        if (saving) return;
        const decision = button.dataset.reviewItemDecision as Exclude<EnrichmentReviewItem["decisionStatus"], "pending">;
        const correctionText = correction?.value ?? "";
        if (decision === "corrected" && !correctionText.trim()) {
          feedbackTarget()!.innerHTML = feedback("Enter the reviewed replacement wording before choosing Correct wording.", true);
          correction?.focus();
          return;
        }
        const controls = [...cardTarget.querySelectorAll<HTMLButtonElement>("button")];
        const disabledBefore = controls.map((control) => control.disabled);
        try {
          saving = true;
          controls.forEach((control) => { control.disabled = true; });
          if (correction) correction.readOnly = true;
          await api<EnrichmentReviewResponse>(`/api/v1/admin/sermons/${id}/review/items/${item.id}/decision`, {
            method: "POST",
            body: JSON.stringify({
              sermonRowVersion: review.sermon.rowVersion,
              reviewRowVersion: review.review.rowVersion,
              itemRowVersion: item.rowVersion,
              transcriptRowVersion: review.sermon.transcript!.rowVersion,
              decision,
              ...(decision === "corrected"
                ? { originalWording: item.associatedWording, correctionText }
                : {})
            })
          });
          dirty = false;
          announce(`Review item decision recorded: ${plainReviewStatus(decision)}`);
          await renderGuidedSermonReview(id);
        } catch (error) {
          saving = false;
          controls.forEach((control, index) => { control.disabled = disabledBefore[index]!; });
          if (correction) correction.readOnly = false;
          feedbackTarget()!.innerHTML = feedback(errorMessage(error), true);
        }
      });
    }
  };

  categoryFilter.addEventListener("change", () => {
    if (!confirmDiscard()) {
      categoryFilter.value = selectedCategory;
      return;
    }
    dirty = false;
    selectedCategory = categoryFilter.value;
    currentIndex = 0;
    renderCard();
  });
  renderCard();
}

function wireTranscriptReview(
  review: EnrichmentReviewResponse,
  id: string,
  feedbackTarget: ReviewFeedbackTarget
): void {
  const form = document.querySelector<HTMLFormElement>("#review-transcript-form");
  const body = document.querySelector<HTMLTextAreaElement>("#review-transcript-body");
  const counts = document.querySelector<HTMLElement>("#review-transcript-counts");
  if (!form || !body || !counts || !review.sermon.transcript) return;
  body.addEventListener("input", () => {
    counts.textContent = `${body.value.length.toLocaleString()} characters • ${transcriptTokenCount(body.value).toLocaleString()} tokens`;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.dataset.transcriptAction ?? "save";
    if (!form.reportValidity()) return;
    if (action === "approve" && !review.progress.stageCompletion.findings) {
      feedbackTarget()!.innerHTML = feedback("Complete the verified finding-review stage before approving the transcript.", true);
      return;
    }
    try {
      await api(`/api/v1/admin/sermons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          rowVersion: review.sermon.rowVersion,
          transcript: {
            bodyText: body.value,
            status: action === "approve" ? "approved" : "draft",
            sourceKind: review.sermon.transcript!.sourceKind,
            sourceReference: review.sermon.transcript!.sourceReference
          }
        })
      });
      dirty = false;
      announce(action === "approve" ? "Transcript approved; sermon remains private" : action === "reject" ? "Transcript rejected and retained as a private draft" : "Transcript draft saved");
      await renderGuidedSermonReview(id);
    } catch (error) {
      feedbackTarget()!.innerHTML = feedback(errorMessage(error), true);
    }
  });
}

function wireDescriptionReview(
  review: EnrichmentReviewResponse,
  id: string,
  feedbackTarget: ReviewFeedbackTarget
): void {
  const form = document.querySelector<HTMLFormElement>("#review-description-form");
  const body = document.querySelector<HTMLTextAreaElement>("#review-description-body");
  const counts = document.querySelector<HTMLElement>("#review-description-counts");
  if (!form || !body || !counts) return;
  const quarantined = isSupersededWave1SourceReference(review.sermon.summarySourceReference);
  body.addEventListener("input", () => {
    const length = body.value.trim().length;
    counts.textContent = `${length.toLocaleString()} of 80–2,000 characters`;
    const approve = form.querySelector<HTMLButtonElement>('[data-description-review-action="approve"]');
    if (approve) approve.disabled = length < 80 || quarantined;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.dataset.descriptionReviewAction ?? "save";
    if (!form.reportValidity()) return;
    const summary = body.value.trim();
    if (action === "approve" && summary.length < 80) {
      feedbackTarget()!.innerHTML = feedback("An approved description must contain at least 80 characters.", true);
      return;
    }
    try {
      await api(`/api/v1/admin/sermons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          rowVersion: review.sermon.rowVersion,
          summary,
          summaryStatus: action === "approve" ? "approved" : "draft",
          summarySourceKind: review.sermon.summarySourceKind,
          summarySourceReference: review.sermon.summarySourceReference
        })
      });
      dirty = false;
      announce(action === "approve" ? "Description approved; sermon remains private" : action === "reject" ? "Description rejected and retained as a private draft" : "Description draft saved");
      await renderGuidedSermonReview(id);
    } catch (error) {
      feedbackTarget()!.innerHTML = feedback(errorMessage(error), true);
    }
  });
}

type ReviewQuestionAnswerPayload = {
  question: string;
  answer: string;
  status: "draft" | "in_review" | "approved";
  sourceKind: string;
  sourceReference: string | null;
};

function questionAnswerPayload(
  review: EnrichmentReviewResponse,
  changedId: string,
  question: string,
  answer: string,
  status: "draft" | "approved",
  order?: string[]
): ReviewQuestionAnswerPayload[] {
  const ordered = order
    ? order.map((itemId) => review.sermon.questionAnswers.find((item) => item.id === itemId)!)
    : [...review.sermon.questionAnswers].sort((a, b) => a.displayOrder - b.displayOrder);
  return ordered.map((item) => ({
    question: item.id === changedId ? question : item.question,
    answer: item.id === changedId ? answer : item.answer,
    status: item.id === changedId ? status : item.status,
    sourceKind: item.sourceKind,
    sourceReference: item.sourceReference
  }));
}

function wireQuestionReview(
  review: EnrichmentReviewResponse,
  id: string,
  feedbackTarget: ReviewFeedbackTarget
): void {
  const forms = [...document.querySelectorAll<HTMLFormElement>(".review-qa-card")];
  if (!forms.length) return;
  const ensureOnlyThisCardIsDirty = (form: HTMLFormElement): boolean => {
    const another = forms.find((candidate) => candidate !== form && candidate.dataset.dirty === "true");
    if (!another) return true;
    feedbackTarget()!.innerHTML = feedback("Save or discard the other edited Q&A pair before continuing.", true);
    another.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  };
  for (const form of forms) {
    const itemId = form.dataset.reviewQa!;
    const question = form.elements.namedItem("question") as HTMLTextAreaElement;
    const answer = form.elements.namedItem("answer") as HTMLTextAreaElement;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity() || !ensureOnlyThisCardIsDirty(form)) return;
      const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
      const action = submitter?.dataset.qaAction ?? "save";
      try {
        await api(`/api/v1/admin/sermons/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            rowVersion: review.sermon.rowVersion,
            questionAnswers: questionAnswerPayload(
              review,
              itemId,
              question.value,
              answer.value,
              action === "approve" ? "approved" : "draft"
            )
          })
        });
        dirty = false;
        announce(action === "approve" ? "Q&A pair approved; sermon remains private" : action === "reject" ? "Q&A pair rejected and retained as a draft" : "Q&A pair saved");
        await renderGuidedSermonReview(id);
      } catch (error) {
        feedbackTarget()!.innerHTML = feedback(errorMessage(error), true);
      }
    });
    for (const button of form.querySelectorAll<HTMLButtonElement>("[data-qa-move]")) {
      button.addEventListener("click", async () => {
        if (!ensureOnlyThisCardIsDirty(form)) return;
        if (form.dataset.dirty === "true") {
          feedbackTarget()!.innerHTML = feedback("Save this pair before changing its order.", true);
          return;
        }
        const ids = [...review.sermon.questionAnswers]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((item) => item.id);
        const index = ids.indexOf(itemId);
        const swapWith = button.dataset.qaMove === "up" ? index - 1 : index + 1;
        if (index < 0 || swapWith < 0 || swapWith >= ids.length) return;
        [ids[index], ids[swapWith]] = [ids[swapWith]!, ids[index]!];
        try {
          await api(`/api/v1/admin/sermons/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              rowVersion: review.sermon.rowVersion,
              questionAnswers: questionAnswerPayload(
                review,
                itemId,
                question.value,
                answer.value,
                review.sermon.questionAnswers.find((item) => item.id === itemId)!.status === "approved" ? "approved" : "draft",
                ids
              )
            })
          });
          dirty = false;
          announce("Q&A order saved");
          await renderGuidedSermonReview(id);
        } catch (error) {
          feedbackTarget()!.innerHTML = feedback(errorMessage(error), true);
        }
      });
    }
  }
}

async function renderGuidedSermonReview(id: string, readOnlyStage?: number): Promise<void> {
  const collection = await api<WorkbenchSnapshot>("/api/v1/admin/workbench");
  const current = collection.data.find(row => row.id === id);
  // Completed provider-independent records need no fabricated YouTube source
  // or human guided-review row. Use the existing authenticated detail endpoint.
  if(current?.localCompletion){
    const sermon=await api<SermonDetail>(`/api/v1/admin/sermons/${id}`);
    dirty=false;
    main.innerHTML=renderCompletedSermon({...sermon,language:current.language});
    return;
  }
  const [review, taxonomies] = await Promise.all([
    api<EnrichmentReviewResponse>(`/api/v1/admin/sermons/${id}/review`),
    loadTaxonomies()
  ]);
  if (review.progress.stageCompletion.final && readOnlyStage !== undefined) {
    review.review.currentStage = Math.max(1, Math.min(6, readOnlyStage));
  }
  // Opening a component is view-only. Existing mutation and completion guards
  // still enforce their requirements when Samuel deliberately saves a decision.
  const requestedView = Number(new URLSearchParams(location.search).get("viewStage"));
  if (Number.isInteger(requestedView) && requestedView >= 1 && requestedView <= 6) review.review.currentStage = requestedView;
  dirty = false;
  const hasQuarantinedDescription = isSupersededWave1SourceReference(review.sermon.summarySourceReference);
  const hasQuarantinedQuestions = review.sermon.questionAnswers.some((item) =>
    isSupersededWave1SourceReference(item.sourceReference)
  );
  const hasGroundedReplacement = Boolean(
    parseGroundedSermonEnrichmentSourceReference(review.sermon.summarySourceReference) &&
    review.sermon.questionAnswers.every((item) => parseGroundedSermonEnrichmentSourceReference(item.sourceReference))
  );
  main.innerHTML = `<header class="review-record-header">
    <div><a href="/admin" data-route>Back to workspace</a><h1>${escapeHtml(review.sermon.title)}</h1><p>Saved decisions and evidence</p></div>
    <div class="review-record-status"><span class="status-pill">Publication: ${escapeHtml(review.sermon.status)}</span><strong>${current ? current.complete ? "Review complete" : "Evidence needs attention" : "Guided private review"}</strong>${youtubeSourceLink(review.sermon.youtubeSource)}${review.progress.stageCompletion.final ? "<small>Completed editorial stages are read-only; AI source review is not human approval or audio verification.</small>" : ""}</div>
  </header>
  ${current ? workbenchBanner(current) : ""}
  ${hasQuarantinedDescription || hasQuarantinedQuestions
    ? '<div class="callout"><strong>Generated description and Q&A quarantined.</strong><p>The original Wave 1 extractive generator was superseded after a quality failure. The affected bodies remain private evidence and cannot be approved; transcript-grounded replacements are required.</p></div>'
    : !current && hasGroundedReplacement && !review.sermon.delegatedReview?.substantiveComplete
      ? '<div class="callout"><strong>Transcript-grounded replacement draft.</strong><p>This private replacement passed automated structure, transcript-binding and grounding checks. It remains unapproved and still requires Samuel’s full editorial, Scripture and theological review.</p></div>'
      : ""}
  <details class="panel review-evidence-summary"><summary>Original guided review record &amp; attribution</summary><section class="disclosure-body" aria-label="Private substantive review status"><p>This guided record may predate later delegated AI acceptance. The current collection status above is checked against the latest acceptance dependencies.</p>${privateReviewStatus(review.sermon)}</section></details>
  <div class="review-workflow-layout">
    ${reviewStageNavigation(review)}
    <div class="review-stage-workspace">${current?.complete && review.review.currentStage === 6 ? `<section class="review-stage-panel"><header class="review-stage-heading"><h2>Private review complete</h2><p>The current restricted acceptance is valid. No repeated substantive review or completion click is needed.</p></header><p>Use the steps above to inspect saved content and evidence. Human approvals remain distinct from delegated AI acceptance, and publication controls are unchanged.</p><a class="button" href="/admin?view=complete" data-route>Back to completed sermons</a></section>` : reviewStageMarkup(review, taxonomies.speakers, taxonomies.books)}</div>
  </div>`;

  if (review.progress.stageCompletion.final) {
    for (const control of document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
      ".review-stage-workspace input, .review-stage-workspace select, .review-stage-workspace textarea, .review-stage-workspace button"
    )) {
      const isBibleBookControl = control.matches('[name="bookClassificationId"], [data-identity-action="save"], [data-primary-passage-control]');
      const isReadOnlyNavigation = control.matches("[data-review-stage], [data-review-view]");
      if ((!isBibleBookControl || review.sermon.remainingReview?.privateComplete) && !isReadOnlyNavigation) {
        control.disabled = true;
        control.setAttribute("aria-disabled", "true");
      }
    }
  }

  const stageFeedback = () => document.querySelector<HTMLElement>("#review-stage-feedback");
  const markDirty = (target?: HTMLElement | null) => {
    dirty = true;
    target?.setAttribute("data-dirty", "true");
  };
  for (const form of document.querySelectorAll<HTMLFormElement>(".review-stage-panel form, form.review-stage-panel, .review-qa-card")) {
    form.addEventListener("input", () => markDirty(form));
  }

  const persistStage = async (stage: number, identityStatus?: "pending" | "confirmed") => {
    if (dirty && !confirmDiscard()) return;
    if (review.progress.stageCompletion.final && identityStatus === undefined) {
      dirty = false;
      await renderGuidedSermonReview(id, stage);
      return;
    }
    try {
      await api(`/api/v1/admin/sermons/${id}/review/progress`, {
        method: "PATCH",
        body: JSON.stringify({
          sermonRowVersion: review.sermon.rowVersion,
          reviewRowVersion: review.review.rowVersion,
          currentStage: stage,
          ...(identityStatus ? { identityStatus } : {})
        })
      });
      dirty = false;
      await renderGuidedSermonReview(id);
    } catch (error) {
      if (stageFeedback()) stageFeedback()!.innerHTML = feedback(errorMessage(error), true);
    }
  };

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-review-stage]")) {
    button.addEventListener("click", () => void persistStage(Number(button.dataset.reviewStage)));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-review-view]")) {
    button.addEventListener("click", () => void navigate(`/admin/sermons/${id}/review?viewStage=${button.dataset.reviewView}`));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-review-pause]")) {
    button.addEventListener("click", () => {
      if (!dirty) {
        void persistStage(review.review.currentStage);
        return;
      }
      const saveButton = document.querySelector<HTMLButtonElement>(
        '[data-identity-action="save"], [data-transcript-action="save"], [data-description-review-action="save"], .review-qa-card[data-dirty="true"] [data-qa-action="save"]'
      );
      if (saveButton) {
        saveButton.click();
        return;
      }
      stageFeedback()!.innerHTML = feedback("Choose an explicit decision for the edited flagged item before pausing.", true);
    });
  }

  const identityForm = document.querySelector<HTMLFormElement>("#review-identity-form");
  identityForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.dataset.identityAction ?? "save";
    if (!identityForm.reportValidity()) return;
    const data = new FormData(identityForm);
    const serviceDate = String(data.get("serviceDate") ?? "");
    const bookClassificationId = String(data.get("bookClassificationId") ?? "");
    if (action === "confirm" && !serviceDate) {
      stageFeedback()!.innerHTML = feedback("Enter and verify the preached service date before confirming identity.", true);
      (identityForm.elements.namedItem("serviceDate") as HTMLInputElement).focus();
      return;
    }
    try {
      const saved = await api<SermonDetail>(`/api/v1/admin/sermons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          rowVersion: review.sermon.rowVersion,
          title: review.review.completedAt !== null ? review.sermon.title : String(data.get("title") ?? ""),
          speakerId: review.review.completedAt !== null
            ? review.sermon.speaker?.id ?? null
            : String(data.get("speakerId") ?? "") || null,
          ...changedReviewBookSelection(identityForm.querySelector<HTMLSelectElement>('[name="bookClassificationId"]')?.dataset.initialBook ?? "", bookClassificationId),
          ...(serviceDate ? { serviceDate } : {})
        })
      });
      const refreshed = await api<EnrichmentReviewResponse>(`/api/v1/admin/sermons/${id}/review`);
      await api(`/api/v1/admin/sermons/${id}/review/progress`, {
        method: "PATCH",
        body: JSON.stringify({
          sermonRowVersion: saved.rowVersion,
          reviewRowVersion: refreshed.review.rowVersion,
          currentStage: review.review.completedAt !== null ? 6 : action === "confirm" ? 2 : 1,
          identityStatus: review.review.completedAt !== null ? "confirmed" : action === "confirm" ? "confirmed" : "pending"
        })
      });
      dirty = false;
      announce(action === "confirm" ? "Identity and provenance confirmed" : "Identity draft saved");
      await renderGuidedSermonReview(id);
    } catch (error) {
      stageFeedback()!.innerHTML = feedback(errorMessage(error), true);
    }
  });

  const passageRows = document.querySelector<HTMLElement>("#primary-passage-rows");
  const passageFeedback = document.querySelector<HTMLElement>("#primary-passage-feedback");
  const renumberPassageRows = () => {
    passageRows?.querySelectorAll<HTMLElement>("[data-primary-passage-row]").forEach((row, index) => {
      row.querySelector<HTMLElement>("[data-primary-passage-number]")!.textContent = String(index + 1);
    });
  };
  const wirePassageRow = (row: HTMLElement) => {
    row.querySelector<HTMLButtonElement>("[data-remove-primary-passage]")?.addEventListener("click", () => {
      row.remove();
      renumberPassageRows();
    });
    row.querySelector<HTMLSelectElement>("[data-primary-role]")?.addEventListener("change", (event) => {
      if ((event.currentTarget as HTMLSelectElement).value === "supporting") {
        row.querySelector<HTMLInputElement>("[data-primary-lead]")!.checked = false;
      }
    });
  };
  passageRows?.querySelectorAll<HTMLElement>("[data-primary-passage-row]").forEach(wirePassageRow);
  document.querySelector<HTMLButtonElement>("#add-primary-passage")?.addEventListener("click", () => {
    if (!passageRows || passageRows.children.length >= 10) return;
    passageRows.insertAdjacentHTML("beforeend", primaryPassageEditorRow({
      canonicalBookId: null,
      startChapter: null,
      startVerse: null,
      endChapter: null,
      endVerse: null,
      relationshipRole: "supporting",
      isLead: false
    }, passageRows.children.length));
    wirePassageRow(passageRows.lastElementChild as HTMLElement);
  });
  const optionalNumber = (element: HTMLInputElement): number | null => element.value ? Number(element.value) : null;
  const collectPrimaryPassages = () => [...(passageRows?.querySelectorAll<HTMLElement>("[data-primary-passage-row]") ?? [])].map((row) => ({
    canonicalBookId: Number(row.querySelector<HTMLSelectElement>("[data-primary-book]")!.value),
    startChapter: optionalNumber(row.querySelector<HTMLInputElement>("[data-primary-start-chapter]")!),
    startVerse: optionalNumber(row.querySelector<HTMLInputElement>("[data-primary-start-verse]")!),
    endChapter: optionalNumber(row.querySelector<HTMLInputElement>("[data-primary-end-chapter]")!),
    endVerse: optionalNumber(row.querySelector<HTMLInputElement>("[data-primary-end-verse]")!),
    relationshipRole: row.querySelector<HTMLSelectElement>("[data-primary-role]")!.value,
    isLead: row.querySelector<HTMLInputElement>("[data-primary-lead]")!.checked
  }));
  const decidePrimaryPassage = async (
    action: "confirm_passages" | "reject_proposal" | "confirm_no_primary_passage"
  ) => {
    if (!review.sermon.primaryPassageReview || !passageFeedback) return;
    if (action !== "confirm_passages" && !window.confirm(
      action === "reject_proposal"
        ? "Reject the title-derived proposal? This does not reject any sermon content."
        : "Confirm that this topical or multi-passage sermon has no single primary preaching passage?"
    )) return;
    try {
      passageFeedback.innerHTML = feedback("Saving the explicit passage decision…");
      await api(`/api/v1/admin/sermons/${id}/primary-passage-decision`, {
        method: "POST",
        body: JSON.stringify({
          sermonRowVersion: review.sermon.rowVersion,
          reviewRowVersion: review.sermon.primaryPassageReview.rowVersion,
          action,
          passages: action === "confirm_passages" ? collectPrimaryPassages() : []
        })
      });
      announce(action === "confirm_passages" ? "Primary preaching passage confirmed" : "Primary-passage decision recorded");
      await renderGuidedSermonReview(id);
    } catch (error) {
      passageFeedback.innerHTML = feedback(errorMessage(error), true);
      passageFeedback.focus();
    }
  };
  document.querySelector<HTMLButtonElement>("#confirm-primary-passages")?.addEventListener("click", () => void decidePrimaryPassage("confirm_passages"));
  document.querySelector<HTMLButtonElement>("#reject-primary-passage")?.addEventListener("click", () => void decidePrimaryPassage("reject_proposal"));
  document.querySelector<HTMLButtonElement>("#confirm-no-primary-passage")?.addEventListener("click", () => void decidePrimaryPassage("confirm_no_primary_passage"));

  wireFlaggedReviewItems(review, id, stageFeedback);
  wireTranscriptReview(review, id, stageFeedback);
  wireDescriptionReview(review, id, stageFeedback);
  wireQuestionReview(review, id, stageFeedback);

  document.querySelector<HTMLButtonElement>("#finish-enrichment-review")?.addEventListener("click", async () => {
    try {
      await api(`/api/v1/admin/sermons/${id}/review/finish`, {
        method: "POST",
        body: JSON.stringify({
          sermonRowVersion: review.sermon.rowVersion,
          reviewRowVersion: review.review.rowVersion
        })
      });
      announce("Guided review finished; sermon remains draft and private");
      await renderGuidedSermonReview(id);
    } catch (error) {
      stageFeedback()!.innerHTML = feedback(errorMessage(error), true);
    }
  });
}

async function renderSermonList(): Promise<void> {
  const url = new URL(location.href);
  const query = new URLSearchParams(url.search);
  query.delete("legacy");
  if (!query.has("pageSize")) query.set("pageSize", "20");
  const [sermons, taxonomies] = await Promise.all([
    api<ListResponse>(`/api/v1/admin/sermons?${query.toString()}`),
    loadTaxonomies()
  ]);
  const currentPage = sermons.pagination.page;
  const passageBookId = Number(query.get("passageBook")) || null;
  const passageBook = bibleBooks.find((book) => book.id === passageBookId) ?? null;
  const passageChapter = Number(query.get("passageChapter")) || null;
  const passageVerse = Number(query.get("passageVerse")) || null;
  const passageEndVerse = Number(query.get("passageEndVerse")) || null;
  const clearPassageQuery = new URLSearchParams(query);
  clearPassageQuery.set("legacy", "1");
  for (const name of ["passageBook", "passageChapter", "passageVerse", "passageEndVerse", "passageReviewState"]) {
    clearPassageQuery.delete(name);
  }
  clearPassageQuery.set("page", "1");
  const pageQuery = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("legacy", "1");
    next.set("page", String(page));
    return `/admin/sermons?${next.toString()}`;
  };
  main.innerHTML = `${pageHeading("Sermons", "Search and filter every editorial state. Public endpoints remain published-only.", '<a class="button primary" href="/admin/sermons/new" data-route>New sermon</a>')}
    <section class="panel">
      <form id="sermon-filters" role="search">
        <div class="filter-primary">
        <label><span>Title or slug</span><input name="query" type="search" value="${escapeHtml(query.get("query") ?? "")}" autocomplete="off" /></label>
        <label><span>State</span><select name="status"><option value="">All states</option>${(["draft","pending","scheduled","published","unpublished","archived"] as SermonStatus[]).map((status) => `<option value="${status}"${query.get("status") === status ? " selected" : ""}>${status}</option>`).join("")}</select></label>
        <label><span>Speaker</span><select name="speakerId">${filterOption(taxonomies.speakers, query.get("speakerId") ?? "", "All speakers")}</select></label>
        <button class="button primary" type="submit">Search sermons</button></div>
        <details class="filter-more"${["seriesId", "serviceDateFrom", "serviceDateTo", "contentIssue", "passageBook", "passageReviewState", "passageChapter", "passageVerse", "passageEndVerse"].some(name => query.has(name)) ? " open" : ""}><summary>More filters <span>Series, dates, content and Scripture</span></summary><div class="filters">
        <label><span>Series</span><select name="seriesId">${filterOption(taxonomies.series, query.get("seriesId") ?? "", "All series")}</select></label>
        <label><span>Service date from</span><input name="serviceDateFrom" type="date" value="${escapeHtml(query.get("serviceDateFrom") ?? "")}" /></label>
        <label><span>Service date to</span><input name="serviceDateTo" type="date" value="${escapeHtml(query.get("serviceDateTo") ?? "")}" /></label>
        <label><span>Content task</span><select name="contentIssue">
          <option value="">All content</option>
          ${[
            ["complete", "Publication checklist complete"],
            ["missing_speaker", "Missing speaker"],
            ["missing_description", "Missing sermon description"],
            ["description_awaiting_review", "Description lacks human publication approval"],
            ["missing_transcript", "Missing transcript"],
            ["transcript_awaiting_review", "Transcript awaiting review"],
            ["insufficient_questions", "Needs 5–10 questions"],
            ["questions_awaiting_review", "Q&A lacks human publication approval"],
            ["missing_media", "Missing controlled media"]
          ].map(([value, label]) => `<option value="${value}"${query.get("contentIssue") === value ? " selected" : ""}>${label}</option>`).join("")}
        </select></label>
        <fieldset class="wide"><legend>Primary passage filters</legend><div class="filters">
          <label><span>Book</span><select id="admin-passage-book" name="passageBook">${canonicalBookFilterOptions(passageBookId)}</select></label>
          <label><span>Chapter</span><select id="admin-passage-chapter" name="passageChapter"${passageBook ? "" : " disabled"}>${numberedFilterOptions(passageBook?.chapterCount ?? 0, passageChapter, "All chapters")}</select></label>
          <label><span>Verse</span><select id="admin-passage-verse" name="passageVerse"${passageChapter ? "" : " disabled"}>${numberedFilterOptions(176, passageVerse, "All verses")}</select></label>
          <label><span>Ending verse (optional)</span><select id="admin-passage-end-verse" name="passageEndVerse"${passageVerse ? "" : " disabled"}>${numberedFilterOptions(176, passageEndVerse, "Same as start")}</select></label>
          <label><span>Passage review state</span><select name="passageReviewState">
            <option value="">All passage states</option>
            ${[
              ["proposed_passage", "Proposed passage"],
              ["confirmed_passage", "Reviewed passage"],
              ["pending_review", "Pending review"],
              ["no_primary_passage", "No primary passage"],
              ["no_proposal_detected", "No proposal detected"],
              ["proposal_rejected", "Proposal rejected"]
            ].map(([value, label]) => `<option value="${value}"${query.get("passageReviewState") === value ? " selected" : ""}>${label}</option>`).join("")}
          </select></label>
        </div></fieldset>
        <div class="action-row wide"><button class="button" type="submit">Apply filters</button><a class="button quiet" href="/admin/sermons?${clearPassageQuery.toString()}" data-route>Clear passage filters</a><a class="button quiet" href="/admin/sermons" data-route>Reset all filters</a></div>
        </div></details>
      </form>
      <div class="section-heading list-heading"><h2>${sermons.pagination.totalItems} matching sermons</h2><span class="subtle">Private review and publication are separate</span></div>
      ${sermonTable(sermons.data)}
      <div class="pagination"><span class="subtle">${sermons.pagination.totalItems} result${sermons.pagination.totalItems === 1 ? "" : "s"} · Page ${currentPage} of ${Math.max(sermons.pagination.totalPages, 1)}</span><div class="action-row">${currentPage > 1 ? `<a class="button" href="${pageQuery(currentPage - 1)}" data-route>Previous</a>` : ""}${currentPage < sermons.pagination.totalPages ? `<a class="button" href="${pageQuery(currentPage + 1)}" data-route>Next</a>` : ""}</div></div>
    </section>`;
  document.querySelector<HTMLFormElement>("#sermon-filters")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const params = new URLSearchParams({ legacy: "1", page: "1", pageSize: "20" });
    for (const [key, value] of data.entries()) if (String(value).trim()) params.set(key, String(value).trim());
    void navigate(`/admin/sermons?${params.toString()}`);
  });
  const passageBookControl = document.querySelector<HTMLSelectElement>("#admin-passage-book");
  const passageChapterControl = document.querySelector<HTMLSelectElement>("#admin-passage-chapter");
  const passageVerseControl = document.querySelector<HTMLSelectElement>("#admin-passage-verse");
  const passageEndVerseControl = document.querySelector<HTMLSelectElement>("#admin-passage-end-verse");
  passageBookControl?.addEventListener("change", () => {
    const book = bibleBooks.find((item) => item.id === Number(passageBookControl.value));
    passageChapterControl!.innerHTML = numberedFilterOptions(book?.chapterCount ?? 0, null, "All chapters");
    passageChapterControl!.disabled = !book;
    passageVerseControl!.value = "";
    passageVerseControl!.disabled = true;
    passageEndVerseControl!.value = "";
    passageEndVerseControl!.disabled = true;
  });
  passageChapterControl?.addEventListener("change", () => {
    passageVerseControl!.value = "";
    passageVerseControl!.disabled = !passageChapterControl.value;
    passageEndVerseControl!.value = "";
    passageEndVerseControl!.disabled = true;
  });
  passageVerseControl?.addEventListener("change", () => {
    passageEndVerseControl!.value = "";
    passageEndVerseControl!.disabled = !passageVerseControl.value;
  });
}

function selectOptions(items: Taxonomy[], selected: Set<string>): string {
  return items.map((item) => `<option value="${item.id}"${selected.has(item.id) ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200);
}

function selectedValues(select: HTMLSelectElement): string[] {
  return [...select.selectedOptions].map((option) => option.value);
}

type EditableQuestionAnswer = SermonDetail["questionAnswers"][number];

function questionAnswerRow(item: Partial<EditableQuestionAnswer>, index: number): string {
  const status = item.status ?? "draft";
  return `<article class="qa-editor" data-qa-row data-source-kind="${escapeHtml(item.sourceKind ?? "manual")}" data-source-reference="${escapeHtml(item.sourceReference ?? "")}">
    <div class="qa-editor-heading"><h3>Question <span data-qa-number>${index + 1}</span></h3><button class="button quiet" type="button" data-remove-qa>Remove</button></div>
    <label><span>Thought-provoking question</span><textarea data-qa-question maxlength="1000" required>${escapeHtml(item.question ?? "")}</textarea><small class="field-hint">Ground this in the sermon transcript and scripture context.</small></label>
    <label><span>Reviewed answer</span><textarea data-qa-answer maxlength="10000" required>${escapeHtml(item.answer ?? "")}</textarea></label>
    <label><span>Review status</span><select data-qa-status><option value="draft"${status === "draft" ? " selected" : ""}>Draft — not public</option><option value="in_review"${status === "in_review" ? " selected" : ""}>Ready for human review</option><option value="approved"${status === "approved" ? " selected" : ""}>Approved for public page</option></select></label>
  </article>`;
}

function compactPrivateReviewStatus(sermon: SermonSummary): string {
  const complete = privateCompletionIsCurrent(sermon);
  const remaining = remainingPrivateReviewRequirements(sermon);
  return `<div class="review-summary"><span class="review-badge ${complete ? "accepted" : "attention"}">${complete ? "✓ Private review complete" : "Review outstanding"}</span>${remaining.length ? `<p class="remaining-requirements">${escapeHtml(remaining.join("; "))}</p>` : ""}<details class="review-status-details"><summary>Decisions &amp; attribution</summary>${privateReviewStatus(sermon)}</details></div>`;
}

function privateReviewStatus(sermon: SermonSummary): string {
  const d=sermon.delegatedReview;
  const complete=d?.substantiveComplete ?? (sermon.readiness.hasApprovedDescription && sermon.readiness.hasRequiredQuestionAnswers);
  const label=complete
    ? (d?.description?.state==="ai_accepted" || (d?.aiAcceptedQuestions ?? 0)>0 ? "AI reviewed and accepted" : "Human approved")
    : "Substantive review pending";
  const remaining=remainingPrivateReviewRequirements(sermon);
  return `<div class="private-review-status"><strong>${escapeHtml(label)}</strong><small>Current description and individual Q&A only.</small>${d ? `<p>Description: ${escapeHtml(substantiveDecisionLabel(d.description))}. Q&A: ${d.humanApprovedQuestions} human approved; ${d.aiAcceptedQuestions} AI accepted / ${d.questions.length} current pairs.</p>` : ""}${sermon.remainingReview ? `<p>D-157 source review: ${escapeHtml(remainingComponentLabel(sermon.remainingReview,"transcript"))}. ${sermon.remainingReview.privateComplete ? "Private completion is current; human and AI attribution remain separate." : "See the evidence exceptions before completing review."}</p><a href="/admin/remaining-reviews?sermon=${encodeURIComponent(sermon.id)}" data-route>Source-review evidence and exceptions</a>` : ""}<p>${remaining.length ? `Remaining: ${escapeHtml(remaining.join("; "))}.` : "Private review complete."}</p><small>Publication state: ${escapeHtml(sermon.status)}. AI acceptance is not publication approval.</small></div>`;
}

function sermonTable(sermons: SermonSummary[]): string {
  return `<div class="table-wrap"><table class="sermon-table"><caption class="sr-only">Sermons and current private review status</caption><thead><tr><th>Sermon</th><th>Primary passage</th><th>Private review</th><th>Publication</th><th>YouTube</th><th>Open</th></tr></thead><tbody>${sermonRows(sermons)}</tbody></table></div>`;
}

function readinessChecklist(readiness: Readiness | null): string {
  const items = [
    ["One speaker selected", readiness?.hasOneSpeaker ?? false],
    ["Primary-passage decision reviewed", readiness?.hasRequiredPassageDecision ?? false],
    ["Sermon description approved", readiness?.hasApprovedDescription ?? false],
    ["Complete transcript approved", readiness?.hasApprovedTranscript ?? false],
    ["5–10 questions and answers approved", readiness?.hasRequiredQuestionAnswers ?? false],
    ["Controlled sermon media valid", readiness?.hasValidControlledMedia ?? false]
  ] as const;
  return `<ul class="checklist">${items.map(([label, complete]) => `<li class="${complete ? "complete" : "incomplete"}"><span aria-hidden="true">${complete ? "✓" : "○"}</span><span>${escapeHtml(label)}</span></li>`).join("")}</ul>`;
}

function enrichmentSourcePanel(
  source: SermonDetail["enrichmentSource"],
  youtubeSource: SermonDetail["youtubeSource"]
): string {
  if (!source) return "";
  const warnings = source.warnings.length
    ? `<ul>${source.warnings.map((warning) => `<li><code>${escapeHtml(warning.code)}</code> — ${escapeHtml(warning.safeDetail)}</li>`).join("")}</ul>`
    : "<p>No automated warning codes were recorded. Human accuracy review is still required.</p>";
  const warningState = source.warningResolutionStatus === "resolved_by_completed_review"
    ? "Historical source warnings retained; the completed administrator review resolved their current-work status."
    : "Historical source warnings remain current administrator work.";
  return `<section class="wide callout" aria-labelledby="enrichment-source-heading">
    <h3 id="enrichment-source-heading">Private caption source and warnings</h3>
    <p><strong>Administrator review is required.</strong> This source and all generated material remain private until each content area is explicitly approved.</p>
    <p>${youtubeSourceLink(youtubeSource)}</p>
    <dl class="provenance-grid">
      <dt>YouTube video ID</dt><dd><code>${escapeHtml(source.videoId)}</code></dd>
      <dt>Canonical source</dt><dd><code>${escapeHtml(source.canonicalUrl)}</code></dd>
      <dt>Caption language</dt><dd>${escapeHtml(source.captionLanguage)}</dd>
      <dt>Caption track type</dt><dd>${escapeHtml(source.captionTrackType)}</dd>
      <dt>Original filename</dt><dd>${escapeHtml(source.originalFilename)}</dd>
      <dt>SHA-256</dt><dd><code>${escapeHtml(source.sourceContentSha256)}</code></dd>
      <dt>Retrieval attribution</dt><dd>Authorised YouTube Studio export</dd>
      <dt>Characters</dt><dd>${source.sourceCharacterCount.toLocaleString()} source / ${source.cleanedCharacterCount.toLocaleString()} cleaned</dd>
      <dt>Processing</dt><dd>${escapeHtml(source.processingVersion)} at ${escapeHtml(source.processedAt)}</dd>
      <dt>Estimated review</dt><dd>${source.estimatedReviewMinutes} minutes</dd>
      <dt>Accuracy state</dt><dd>Human review required</dd>
    </dl>
    <h4>Warnings</h4><p><strong>${escapeHtml(warningState)}</strong></p>${warnings}
  </section>`;
}

function collectQuestionAnswers(): Array<{
  question: string;
  answer: string;
  status: "draft" | "in_review" | "approved";
  sourceKind: "manual" | "imported" | "generated_draft";
  sourceReference: string | null;
}> {
  return [...document.querySelectorAll<HTMLElement>("[data-qa-row]")].map((row) => ({
    question: row.querySelector<HTMLTextAreaElement>("[data-qa-question]")!.value.trim(),
    answer: row.querySelector<HTMLTextAreaElement>("[data-qa-answer]")!.value.trim(),
    status: row.querySelector<HTMLSelectElement>("[data-qa-status]")!.value as "draft" | "in_review" | "approved",
    sourceKind: (row.dataset.sourceKind ?? "manual") as "manual" | "imported" | "generated_draft",
    sourceReference: row.dataset.sourceReference || null
  }));
}

async function renderSermonForm(id?: string): Promise<void> {
  const [taxonomies, detail] = await Promise.all([
    loadTaxonomies(),
    id ? api<SermonDetail>(`/api/v1/admin/sermons/${id}`) : Promise.resolve(null)
  ]);
  if (detail?.enrichmentSource) {
    history.replaceState({}, "", `/admin/sermons/${detail.id}/review`);
    await renderGuidedSermonReview(detail.id);
    return;
  }
  const youtube = detail?.media.find((media) => media.provider === "youtube");
  const sermonAudio = detail?.media.find((media) => media.provider === "sermonaudio");
  const title = detail ? `Edit ${detail.title}` : "New sermon";
  const description = detail
    ? "Update content and relationships, then use explicit actions for every state change."
    : "Create a draft using controlled relationships, scripture provenance, and safe media fields.";
  const headingActions = `<div class="action-row">${detail ? youtubeSourceLink(detail.youtubeSource) : ""}<a class="button" href="/admin/sermons" data-route>Back to sermons</a></div>`;
  main.innerHTML = `${pageHeading(title, description, headingActions)}
    <div id="form-feedback"></div>
    <form id="sermon-form" class="stack" novalidate>
      <section class="panel form-grid">
        <div class="wide step-heading"><span>Step 1 of 6</span><h2>1. Sermon basics</h2><p>Start with the title, stable public address, service date and reviewed sermon description.</p></div>
        <label><span>Title</span><input id="sermon-title" name="title" required maxlength="240" value="${escapeHtml(detail?.title ?? "")}" /></label>
        <label><span>Slug</span><input id="sermon-slug" name="slug" required maxlength="200" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeHtml(detail?.slug ?? "")}" /><small class="field-hint">Lowercase letters, numbers, and hyphens. Historic changes create a redirect.</small></label>
        <label><span>Service date</span><input name="serviceDate" type="date" required value="${escapeHtml(detail?.serviceDate ?? new Date().toISOString().slice(0, 10))}" /></label>
        <label class="wide"><span>Sermon description</span><textarea id="sermon-description" name="summary" maxlength="2000" aria-describedby="sermon-description-guidance sermon-description-count">${escapeHtml(detail?.summary ?? "")}</textarea><small id="sermon-description-guidance" class="field-hint">Normally write 2–4 useful plain-text sentences grounded in the sermon, transcript and scripture. Approval requires 80–2,000 characters; no mechanical sentence count is enforced.</small><small id="sermon-description-count" class="field-hint" aria-live="polite">${detail?.summary?.trim().length ?? 0} of 80–2,000 characters for approval</small></label>
        <label><span>Description status</span><select id="description-status" name="summaryStatus"><option value="missing"${!detail || detail.summaryStatus === "missing" ? " selected" : ""}>Missing</option><option value="draft"${detail?.summaryStatus === "draft" ? " selected" : ""}>Draft — not public</option><option value="in_review"${detail?.summaryStatus === "in_review" ? " selected" : ""}>Ready for human review</option><option value="approved"${detail?.summaryStatus === "approved" ? " selected" : ""}>Approved for public page</option></select><small class="field-hint">Only approved description text is public, searchable or launch-ready.</small></label>
        <div><span class="field-label">Description review actions</span><div class="action-row"><button class="button" type="button" data-description-status="in_review">Send to review</button><button class="button" type="button" data-description-status="approved">Approve description</button></div></div>
        <label class="wide"><span>SEO description override (optional)</span><textarea name="seoDescription" maxlength="320">${escapeHtml(detail?.seoDescription ?? "")}</textarea><small class="field-hint">Controlled plain text for metadata only. When blank, the approved visible sermon description provides the deterministic metadata fallback.</small></label>
        <label class="wide"><span>Short sermon notes</span><textarea name="body" maxlength="200000" rows="7">${escapeHtml(detail?.body ?? "")}</textarea><small class="field-hint">Use the full transcript step below for the complete spoken message.</small></label>
      </section>
      <section class="panel form-grid">
        <div class="wide step-heading"><span>Step 2 of 6</span><h2>2. Speaker and scripture</h2><p>Every complete sermon has one speaker. Series may still contain more than one relationship.</p></div>
        <label><span>Speaker</span><select name="speakerId" aria-describedby="speaker-help"><option value="">Choose one speaker</option>${selectOptions(taxonomies.speakers, new Set(detail?.speaker ? [detail.speaker.id] : []))}</select><small id="speaker-help" class="field-hint">A draft may be saved without a speaker, but it cannot be scheduled or published.</small></label>
        <fieldset><legend>Series</legend><select name="seriesIds" multiple>${selectOptions(taxonomies.series, new Set(detail?.series.map((item) => item.id) ?? []))}</select></fieldset>
        <fieldset><legend>Books</legend><select name="bookClassificationIds" multiple>${selectOptions(taxonomies.books, new Set(detail?.books.map((item) => item.id) ?? []))}</select></fieldset>
        <div class="review-readonly-field"><span>Scripture references</span><strong>${escapeHtml(detail?.scriptureReferences.map((item) => item.displayText).join(", ") || "None recorded")}</strong><small>Structured primary-passage decisions use the dedicated reviewed controls on prepared records; general sermon saves do not replace Scripture provenance.</small></div>
      </section>
      <section class="panel form-grid">
        <div class="wide step-heading"><span>Step 3 of 6</span><h2>3. Media</h2><p>Add controlled provider URLs. Raw embed or iframe code is never accepted.</p></div>
        <fieldset><legend>YouTube video</legend><div class="stack"><label><span>Canonical URL</span><input name="youtubeUrl" type="url" value="${escapeHtml(youtube?.canonicalUrl ?? "")}" placeholder="https://www.youtube.com/watch?v=…" /></label><label><span>Accessible title</span><input name="youtubeTitle" value="${escapeHtml(youtube?.title ?? "Sermon video")}" maxlength="500" /></label></div></fieldset>
        <fieldset><legend>SermonAudio audio</legend><div class="stack"><label><span>Canonical URL</span><input name="sermonAudioUrl" type="url" value="${escapeHtml(sermonAudio?.canonicalUrl ?? "")}" placeholder="https://www.sermonaudio.com/…" /></label><label><span>Accessible title</span><input name="sermonAudioTitle" value="${escapeHtml(sermonAudio?.title ?? "Sermon audio")}" maxlength="500" /></label></div></fieldset>
        <div class="wide callout">Raw iframe or embed HTML is never accepted. The application validates controlled provider URLs and generates any future embed markup itself.</div>
      </section>
      <section class="panel form-grid">
        <div class="wide step-heading"><span>Step 4 of 6</span><h2>4. Full transcript</h2><p>Add the complete plain-text transcript, then move it through human review. Only approved text can appear publicly.</p></div>
        ${enrichmentSourcePanel(detail?.enrichmentSource ?? null, detail?.youtubeSource ?? null)}
        <label class="wide"><span>Complete transcript</span><textarea name="transcriptBody" maxlength="500000" rows="20" placeholder="Paste or type the complete spoken sermon in plain text">${escapeHtml(detail?.transcript?.bodyText ?? "")}</textarea><small class="field-hint">HTML tags are rejected. Paragraph breaks are preserved when the approved transcript is rendered.</small></label>
        <label><span>Transcript status</span><select name="transcriptStatus"><option value="missing"${!detail?.transcript || detail.transcript.status === "missing" ? " selected" : ""}>Missing</option><option value="draft"${detail?.transcript?.status === "draft" ? " selected" : ""}>Draft — not public</option><option value="in_review"${detail?.transcript?.status === "in_review" ? " selected" : ""}>Ready for human review</option><option value="approved"${detail?.transcript?.status === "approved" ? " selected" : ""}>Approved for public page</option></select></label>
        <div class="callout"><strong>Public behaviour</strong><p>An approved transcript is already present in the initial server-generated sermon page. It is visually collapsed under “Read full transcript”, but never loaded later by JavaScript.</p></div>
      </section>
      <section class="panel">
        <div class="step-heading"><span>Step 5 of 6</span><h2>5. Questions and answers</h2><p>Add 5–10 thoughtful, transcript-grounded questions with complete answers. Generated drafts remain private until an administrator approves them.</p></div>
        <div id="qa-editors" class="stack">${detail?.questionAnswers.length ? detail.questionAnswers.map(questionAnswerRow).join("") : '<div class="empty-state" id="qa-empty"><strong>No questions yet.</strong><p>Add the first question when a transcript draft is available.</p></div>'}</div>
        <div class="action-row"><button class="button" type="button" id="add-question">Add question and answer</button><span class="subtle" id="qa-count">${detail?.questionAnswers.length ?? 0} of 5–10 required</span></div>
      </section>
      <section class="panel">
        <div class="step-heading"><span>Step 6 of 6</span><h2>6. Review and publish</h2><p>Resolve every checklist item before publishing. Scheduling remains hidden until a real publication worker exists.</p></div>
        ${detail?.historicalBackfillRequired ? '<div class="callout"><strong>Historical backfill required.</strong><p>This imported record preserves its original WordPress state, but launch remains blocked until its description, transcript and questions are approved.</p></div>' : ""}
        <h3>Private substantive review</h3>${detail ? privateReviewStatus(detail) : "Not yet saved."}
        <h3>Publication checklist — separate human approval gates</h3>${readinessChecklist(detail?.readiness ?? null)}
        <h3>Search preview</h3>
        <div class="seo-preview"><strong id="seo-title-preview">${escapeHtml(detail?.title ?? "Untitled sermon")}</strong><code id="seo-url-preview">${escapeHtml(expectedPublicSermonUrl(detail?.slug ?? "new-sermon"))}</code><p class="subtle">The optional allowlisted SEO description overrides metadata only; otherwise the approved visible description is used. No arbitrary metadata store is exposed.</p></div>
        <div id="slug-warning"></div>
      </section>
      <div class="form-actions"><button class="button primary" type="submit">${detail ? "Save changes" : "Create draft"}</button><span class="subtle" id="dirty-state">No unsaved changes</span></div>
    </form>
    ${detail ? `<section class="panel" id="editorial-actions"><h2>Review and publishing actions</h2><p><strong>Current state:</strong> <span class="status-pill ${detail.status}">${detail.status}</span> — ${escapeHtml(stateDescriptions[detail.status])}</p>${detail.readiness.isComplete ? '<p class="feedback">The content checklist is complete. Publishing is available when valid for this state. Scheduling remains hidden until a real worker exists.</p>' : `<div class="callout"><strong>Not ready to publish.</strong><p>${escapeHtml(detail.readiness.issues.map((issue) => issue.message).join(" "))}</p></div>`}<div class="action-row">${allowedDashboardActions(detail.status).map((action) => `<button class="button${action === "archive" ? " danger" : action === "publish" ? " primary" : ""}" type="button" data-transition="${action}">${action[0]!.toUpperCase()}${action.slice(1)}</button>`).join("")}</div>${detail.status === "archived" ? '<hr /><button class="button danger" id="open-delete" type="button">Permanently delete…</button>' : ""}</section><section class="panel" id="sermon-audit"><h2>Audit history</h2><div class="subtle">Loading audit events…</div></section>` : ""}
    ${detail?.status === "archived" ? deletionDialog(detail) : ""}`;

  const form = document.querySelector<HTMLFormElement>("#sermon-form")!;
  const titleInput = document.querySelector<HTMLInputElement>("#sermon-title")!;
  const slugInput = document.querySelector<HTMLInputElement>("#sermon-slug")!;
  const dirtyState = document.querySelector<HTMLElement>("#dirty-state")!;
  const descriptionInput = document.querySelector<HTMLTextAreaElement>("#sermon-description")!;
  const descriptionStatus = document.querySelector<HTMLSelectElement>("#description-status")!;
  const descriptionCount = document.querySelector<HTMLElement>("#sermon-description-count")!;
  let slugManuallyEdited = Boolean(detail);
  const updatePreview = () => {
    document.querySelector<HTMLElement>("#seo-title-preview")!.textContent = titleInput.value || "Untitled sermon";
    document.querySelector<HTMLElement>("#seo-url-preview")!.textContent = expectedPublicSermonUrl(slugInput.value || "new-sermon");
    const warn = detail && shouldWarnAboutSlugChange(detail.slug, slugInput.value, detail.publishedAt);
    document.querySelector<HTMLElement>("#slug-warning")!.innerHTML = warn ? '<div class="callout danger"><strong>Historic public URL change</strong><p>Saving will create or update a direct permanent redirect from the previous sermon URL. Verify it in the SEO URL manifest before launch.</p></div>' : "";
  };
  form.addEventListener("input", () => { dirty = true; dirtyState.textContent = "Unsaved changes"; });
  titleInput.addEventListener("input", () => { if (!slugManuallyEdited) slugInput.value = slugify(titleInput.value); updatePreview(); });
  slugInput.addEventListener("input", () => { slugManuallyEdited = true; updatePreview(); });
  updatePreview();
  const updateDescriptionCount = () => {
    const length = descriptionInput.value.trim().length;
    descriptionCount.textContent = `${length} of 80–2,000 characters for approval${length > 0 && length < 80 ? " — add more detail before approval" : ""}`;
  };
  descriptionInput.addEventListener("input", updateDescriptionCount);
  descriptionStatus.addEventListener("change", () => announce(`Sermon description status changed to ${descriptionStatus.selectedOptions[0]?.textContent ?? descriptionStatus.value}`));
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-description-status]")) {
    button.addEventListener("click", () => {
      descriptionStatus.value = button.dataset.descriptionStatus!;
      descriptionStatus.dispatchEvent(new Event("change"));
      dirty = true;
      dirtyState.textContent = "Unsaved changes";
    });
  }
  updateDescriptionCount();

  const qaEditors = document.querySelector<HTMLElement>("#qa-editors")!;
  const qaCount = document.querySelector<HTMLElement>("#qa-count")!;
  const refreshQuestionEditors = () => {
    const rows = [...qaEditors.querySelectorAll<HTMLElement>("[data-qa-row]")];
    rows.forEach((row, index) => {
      row.querySelector<HTMLElement>("[data-qa-number]")!.textContent = String(index + 1);
    });
    qaCount.textContent = `${rows.length} of 5–10 required`;
    document.querySelector<HTMLButtonElement>("#add-question")!.disabled = rows.length >= 10;
    if (!rows.length && !document.querySelector("#qa-empty")) {
      qaEditors.innerHTML = '<div class="empty-state" id="qa-empty"><strong>No questions yet.</strong><p>Add the first question when a transcript draft is available.</p></div>';
    }
  };
  const wireQuestionRow = (row: HTMLElement) => {
    row.querySelector<HTMLButtonElement>("[data-remove-qa]")!.addEventListener("click", () => {
      row.remove();
      dirty = true;
      dirtyState.textContent = "Unsaved changes";
      refreshQuestionEditors();
    });
  };
  qaEditors.querySelectorAll<HTMLElement>("[data-qa-row]").forEach(wireQuestionRow);
  document.querySelector<HTMLButtonElement>("#add-question")!.addEventListener("click", () => {
    const current = qaEditors.querySelectorAll("[data-qa-row]").length;
    if (current >= 10) return;
    document.querySelector("#qa-empty")?.remove();
    qaEditors.insertAdjacentHTML("beforeend", questionAnswerRow({}, current));
    wireQuestionRow(qaEditors.querySelector<HTMLElement>("[data-qa-row]:last-child")!);
    dirty = true;
    dirtyState.textContent = "Unsaved changes";
    refreshQuestionEditors();
  });
  refreshQuestionEditors();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedbackTarget = document.querySelector<HTMLElement>("#form-feedback")!;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const media = buildControlledMediaInputs({
      youtubeUrl: String(data.get("youtubeUrl") ?? ""),
      youtubeTitle: String(data.get("youtubeTitle") ?? ""),
      sermonAudioUrl: String(data.get("sermonAudioUrl") ?? ""),
      sermonAudioTitle: String(data.get("sermonAudioTitle") ?? "")
    });
    const payload = {
      ...(detail ? { rowVersion: detail.rowVersion } : {}),
      title: String(data.get("title")),
      slug: String(data.get("slug")),
      serviceDate: String(data.get("serviceDate")),
      summary: String(data.get("summary") ?? "").trim() || null,
      summaryStatus: String(data.get("summaryStatus") ?? "missing"),
      summarySourceKind: detail?.summarySourceKind ?? "manual",
      summarySourceReference: detail?.summarySourceReference ?? null,
      seoDescription: String(data.get("seoDescription") ?? "").trim() || null,
      body: String(data.get("body") ?? "").trim() || null,
      speakerId: String(data.get("speakerId") ?? "") || null,
      seriesIds: selectedValues(form.elements.namedItem("seriesIds") as HTMLSelectElement),
      bookClassificationIds: selectedValues(form.elements.namedItem("bookClassificationIds") as HTMLSelectElement),
      media,
      transcript: {
        bodyText: String(data.get("transcriptBody") ?? ""),
        status: String(data.get("transcriptStatus") ?? "missing"),
        sourceKind: detail?.transcript?.sourceKind ?? "manual",
        sourceReference: detail?.transcript?.sourceReference ?? null
      },
      questionAnswers: collectQuestionAnswers()
    };
    try {
      feedbackTarget.innerHTML = feedback("Saving…");
      const saved = await api<SermonDetail>(detail ? `/api/v1/admin/sermons/${detail.id}` : "/api/v1/admin/sermons", { method: detail ? "PATCH" : "POST", body: JSON.stringify(payload) });
      dirty = false;
      announce(detail ? "Sermon changes saved" : "Draft sermon created");
      await navigate(`/admin/sermons/${saved.id}`, true);
    } catch (error) {
      feedbackTarget.innerHTML = feedback(errorMessage(error), true);
      feedbackTarget.focus();
    }
  });

  if (detail) {
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-transition]")) {
      button.addEventListener("click", async () => {
        if (!confirmDiscard()) return;
        const action = button.dataset.transition!;
        const payload = { rowVersion: detail.rowVersion };
        try {
          button.disabled = true;
          await api(`/api/v1/admin/sermons/${detail.id}/${action}`, { method: "POST", body: JSON.stringify(payload) });
          dirty = false;
          announce(`Sermon ${action} action completed`);
          await renderRoute();
        } catch (error) {
          button.disabled = false;
          document.querySelector<HTMLElement>("#form-feedback")!.innerHTML = feedback(errorMessage(error), true);
        }
      });
    }
    await renderSermonAudit(detail.id);
    wireDeletionDialog(detail);
  }
}

function deletionDialog(detail: SermonDetail): string {
  const published = detail.publishedAt !== null;
  return `<dialog id="delete-dialog" aria-labelledby="delete-title"><form method="dialog" class="dialog-body" id="delete-form"><h2 id="delete-title">Permanently delete sermon</h2><div class="callout danger"><strong>This action cannot be undone.</strong><p>The sermon and dependent content, relationships, media, and private provenance will be removed transactionally. Only the minimal audit tombstone remains.</p></div><div class="stack"><label><span>Type “${escapeHtml(detail.slug)}” or the exact sermon title</span><input name="confirmation" required autocomplete="off" /></label><label><span>Short deletion reason</span><textarea name="reason" required minlength="3" maxlength="500"></textarea></label>${published ? `<fieldset><legend>Required SEO disposition</legend><label class="radio-row"><input type="radio" name="seoKind" value="gone" required /><span><strong>Gone</strong><small class="field-hint">Record an explicit future HTTP 410 outcome.</small></span></label><label class="radio-row"><input type="radio" name="seoKind" value="redirect" required /><span><strong>Redirect</strong><small class="field-hint">Target must be a different currently published sermon.</small></span></label><label><span>Redirect target path</span><input name="targetPath" placeholder="/sermons/replacement-slug/" /></label></fieldset>` : '<p class="subtle">This sermon has never been published, so no public URL disposition will be created.</p>'}<div id="delete-feedback"></div><div class="action-row"><button class="button" value="cancel" type="button" id="cancel-delete">Cancel</button><button class="button danger" type="submit">Permanently delete</button></div></div></form></dialog>`;
}

function wireDeletionDialog(detail: SermonDetail): void {
  const dialog = document.querySelector<HTMLDialogElement>("#delete-dialog");
  if (!dialog) return;
  document.querySelector<HTMLButtonElement>("#open-delete")?.addEventListener("click", () => dialog.showModal());
  document.querySelector<HTMLButtonElement>("#cancel-delete")?.addEventListener("click", () => dialog.close());
  document.querySelector<HTMLFormElement>("#delete-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const kind = detail.publishedAt ? String(data.get("seoKind") ?? "none") as "redirect" | "gone" | "none" : "none";
    const payload = {
      rowVersion: detail.rowVersion,
      confirmation: String(data.get("confirmation") ?? ""),
      reason: String(data.get("reason") ?? ""),
      seoDisposition: buildDeletionSeoDisposition(kind, String(data.get("targetPath") ?? ""))
    };
    try {
      await api(`/api/v1/admin/sermons/${detail.id}/permanent-delete`, { method: "POST", body: JSON.stringify(payload) });
      dirty = false;
      dialog.close();
      announce("Sermon permanently deleted; minimal audit tombstone retained");
      await navigate("/admin/audit", true);
    } catch (error) {
      document.querySelector<HTMLElement>("#delete-feedback")!.innerHTML = feedback(errorMessage(error), true);
    }
  });
}

async function renderSermonAudit(id: string): Promise<void> {
  const target = document.querySelector<HTMLElement>("#sermon-audit");
  if (!target) return;
  try {
    const response = await api<{ data: Array<{ action: string; actorSubject: string; changedFields: string[]; createdAt: string }> }>(`/api/v1/admin/sermons/${id}/audit`);
    target.innerHTML = `<h2>Audit history</h2>${response.data.length ? `<div class="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Changed fields</th></tr></thead><tbody>${response.data.map((event) => `<tr><td>${escapeHtml(humanDate(event.createdAt))}</td><td>${escapeHtml(event.action)}</td><td>${escapeHtml(event.actorSubject)}</td><td>${escapeHtml(event.changedFields.join(", ") || "—")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="subtle">No audit events recorded.</p>'}`;
  } catch (error) {
    target.innerHTML = `<h2>Audit history</h2>${feedback(errorMessage(error), true)}`;
  }
}

async function renderTaxonomy(kind: "speakers" | "series" | "books"): Promise<void> {
  const response = await api<{ data: Taxonomy[] }>(`/api/v1/admin/taxonomies/${kind}`);
  const singular = kind === "series" ? "series" : kind.slice(0, -1);
  main.innerHTML = `${pageHeading(kind[0]!.toUpperCase() + kind.slice(1), `Manage controlled ${kind} used by sermon relationships.`)}<div id="taxonomy-feedback"></div><div class="grid-two"><section class="panel"><h2>Existing ${kind}</h2><p class="subtle">Administrator relationships include private drafts. Publicly eligible counts include only complete published sermons.</p><div class="table-wrap"><table><thead><tr><th>Name</th><th>Slug</th><th>Administrator relationships</th><th>Publicly eligible</th><th>Updated</th><th></th></tr></thead><tbody>${response.data.length ? response.data.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td><code>${escapeHtml(item.slug)}</code></td><td>${item.administratorSermonCount}</td><td>${item.publicSermonCount}</td><td>${escapeHtml(humanDate(item.updatedAt))}</td><td><button class="button quiet" type="button" data-edit-taxonomy="${item.id}">Edit</button></td></tr>`).join("") : `<tr><td colspan="6" class="empty-state">No ${escapeHtml(kind)} yet.</td></tr>`}</tbody></table></div></section><section class="panel"><h2 id="taxonomy-form-title">Add ${escapeHtml(singular)}</h2><form id="taxonomy-form" class="stack"><input type="hidden" name="id" /><input type="hidden" name="rowVersion" /><label><span>Name</span><input name="name" required maxlength="240" /></label><label><span>Slug</span><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxlength="200" /></label>${kind === "books" ? '<label><span>Canonical Bible book ID</span><input name="canonicalBookId" type="number" min="1" max="66" /><small class="field-hint">Optional. Leave empty when historic classification is unresolved.</small></label>' : '<label><span>Description</span><textarea name="description" maxlength="10000"></textarea></label>'}<div class="action-row"><button class="button primary" type="submit">Save</button><button class="button" type="reset">Clear</button></div></form></section></div>`;
  const form = document.querySelector<HTMLFormElement>("#taxonomy-form")!;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-edit-taxonomy]")) {
    button.addEventListener("click", () => {
      const item = response.data.find((value) => value.id === button.dataset.editTaxonomy)!;
      (form.elements.namedItem("id") as HTMLInputElement).value = item.id;
      (form.elements.namedItem("rowVersion") as HTMLInputElement).value = String(item.rowVersion);
      (form.elements.namedItem("name") as HTMLInputElement).value = item.name;
      (form.elements.namedItem("slug") as HTMLInputElement).value = item.slug;
      const description = form.elements.namedItem("description") as HTMLTextAreaElement | null;
      if (description) description.value = item.description ?? "";
      const canonical = form.elements.namedItem("canonicalBookId") as HTMLInputElement | null;
      if (canonical) canonical.value = item.canonicalBookId ? String(item.canonicalBookId) : "";
      document.querySelector<HTMLElement>("#taxonomy-form-title")!.textContent = `Edit ${item.name}`;
      dirty = true;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  form.addEventListener("input", () => (dirty = true));
  form.addEventListener("reset", () => { dirty = false; document.querySelector<HTMLElement>("#taxonomy-form-title")!.textContent = `Add ${singular}`; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const id = String(data.get("id") ?? "");
    const payload = {
      ...(id ? { rowVersion: Number(data.get("rowVersion")) } : {}),
      name: String(data.get("name")),
      slug: String(data.get("slug")),
      ...(kind === "books" ? { canonicalBookId: data.get("canonicalBookId") ? Number(data.get("canonicalBookId")) : null } : { description: String(data.get("description") ?? "").trim() || null })
    };
    try {
      await api(id ? `/api/v1/admin/taxonomies/${kind}/${id}` : `/api/v1/admin/taxonomies/${kind}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      dirty = false;
      announce(`${singular} saved`);
      await renderRoute();
    } catch (error) {
      document.querySelector<HTMLElement>("#taxonomy-feedback")!.innerHTML = feedback(errorMessage(error), true);
    }
  });
}

async function renderAuditHistory(): Promise<void> {
  const history = await api<{ events: Array<{ id: string; action: string; actorSubject: string; entityType: string; entityId: string; changedFields: string[]; createdAt: string }>; deletionTombstones: Array<{ id: string; formerSermonId: string; formerSlug: string; actorSubject: string; reason: string; seoDisposition: string | null; redirectTargetPath: string | null; createdAt: string }> }>("/api/v1/admin/audit");
  main.innerHTML = `${pageHeading("Audit history", "Review administrative actions and minimal non-content deletion tombstones.")}
    <section class="panel"><h2>Recent administrative events</h2><div class="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Target</th><th>Changed fields</th></tr></thead><tbody>${history.events.length ? history.events.map((event) => `<tr><td>${escapeHtml(humanDate(event.createdAt))}</td><td>${escapeHtml(event.action)}</td><td>${escapeHtml(event.actorSubject)}</td><td>${escapeHtml(event.entityType)}<div class="subtle">${escapeHtml(event.entityId)}</div></td><td>${escapeHtml(event.changedFields.join(", ") || "—")}</td></tr>`).join("") : '<tr><td colspan="5" class="empty-state">No audit events recorded.</td></tr>'}</tbody></table></div></section>
    <section class="panel" style="margin-top:1.25rem"><h2>Permanent deletion tombstones</h2><p class="subtle">These records contain only the former identifier and slug, actor, action, timestamp, reason, and SEO disposition. Deleted content and media are not retained.</p><div class="table-wrap"><table><thead><tr><th>Time</th><th>Former slug</th><th>Reason</th><th>SEO disposition</th><th>Actor</th></tr></thead><tbody>${history.deletionTombstones.length ? history.deletionTombstones.map((item) => `<tr><td>${escapeHtml(humanDate(item.createdAt))}</td><td><code>${escapeHtml(item.formerSlug)}</code><div class="subtle">${escapeHtml(item.formerSermonId)}</div></td><td>${escapeHtml(item.reason)}</td><td>${escapeHtml(item.seoDisposition ?? "not previously public")}${item.redirectTargetPath ? `<div class="subtle">${escapeHtml(item.redirectTargetPath)}</div>` : ""}</td><td>${escapeHtml(item.actorSubject)}</td></tr>`).join("") : '<tr><td colspan="5" class="empty-state">No permanent deletions recorded.</td></tr>'}</tbody></table></div></section>`;
}

interface AiReviewRow {
  sequence: number; sermonId: string; title: string; artifactKey: string | null;
  displayOrder: number | null; outcome: string; reviewedAt: string | null;
  exceptionCode: string | null; informationNeeded: string | null;
  standingWarnings: string[]; model: string | null; humanApprovalPreserved: boolean;
}

interface RemainingReviewQueueRow { sermonId: string; title: string; review: RemainingReviewStatus }

async function renderRemainingAiReviews(): Promise<void> {
  const {data}=await api<{data:RemainingReviewQueueRow[]}>("/api/v1/admin/remaining-reviews");
  const selected=new URLSearchParams(location.search).get("sermon");
  const all=new URLSearchParams(location.search).get("all")==="1";
  const exceptions=data.flatMap(row=>Object.entries(row.review.components).map(([component,item])=>({row,component,item})))
    .filter(({row,item})=>(!selected || row.sermonId===selected) && (all || !item.accepted || item.sourceLimitation));
  const incomplete=data.filter(row=>!row.review.privateComplete && (!selected || row.sermonId===selected));
  main.innerHTML=`${pageHeading("Remaining private-review evidence", "D-157 source assessment by Codex Astra. AI acceptance is separate from human approval and does not verify the recording.", '<a class="button" href="/admin/sermons" data-route>Administrator queue</a>')}
    <section class="panel"><h2>Current private completion</h2><p>${data.filter(row=>row.review.privateComplete).length} of ${data.length} records have current private completion. ${data.filter(row=>!row.review.privateComplete).length} remain incomplete. Existing human decisions and D-156 content acceptance are preserved.</p><p>Unknown audio association, caption redactions and source limitations remain visible. No review outcome permits publication.</p><a class="button" href="/admin/remaining-reviews${all ? "" : "?all=1"}" data-route>${all ? "Show exceptions and unfinished work" : "Show all component outcomes"}</a></section>
    <section class="panel"><h2>${all ? "All component outcomes" : "Evidence exceptions and unfinished checks"}</h2><div class="table-wrap"><table><thead><tr><th>Sermon</th><th>Requirement</th><th>Current outcome and attribution</th><th>Specific evidence or decision needed</th></tr></thead><tbody>${exceptions.map(({row,component,item})=>`<tr><td><a href="/admin/sermons/${escapeHtml(row.sermonId)}/review" data-route>${escapeHtml(row.title)}</a></td><td>${escapeHtml(component)}</td><td>${escapeHtml(remainingComponentLabel(row.review,component as keyof RemainingReviewStatus["components"]))}<div class="subtle">${escapeHtml(item.reviewerSubject ?? "No current decision")} · ${escapeHtml(item.model ?? "No AI model attributed")}${item.reviewedAt ? ` · ${escapeHtml(humanDate(item.reviewedAt))}` : ""}</div></td><td>${item.exceptionCode ? `<code>${escapeHtml(item.exceptionCode)}</code><br>` : ""}${escapeHtml(item.informationNeeded ?? (item.state==="pending" ? "This check has not been completed. It is not an evidence exception or a request for repeated human review." : item.state==="stale" ? "Relevant evidence changed. Previous acceptance no longer applies." : "No repeated decision required; retained source limitations are not erased."))}</td></tr>`).join("") || '<tr><td colspan="4">No outstanding component exception in this selection.</td></tr>'}</tbody></table></div></section>
    ${incomplete.length ? `<section class="panel"><h2>Private completion still outstanding</h2><ul>${incomplete.map(row=>`<li><a href="/admin/sermons/${escapeHtml(row.sermonId)}/review" data-route>${escapeHtml(row.title)}</a>: ${escapeHtml(row.review.remaining.join("; ") || "Current components are satisfied; separate audited private-completion persistence remains pending.")}</li>`).join("")}</ul></section>` : ""}`;
}

async function renderDelegatedAiReviews(): Promise<void> {
  const { data } = await api<{data: AiReviewRow[]}>("/api/v1/admin/ai-reviews");
  const selected = new URLSearchParams(location.search).get("sermon");
  const all = new URLSearchParams(location.search).get("all") === "1";
  const rows = data.filter(r => (!selected || r.sermonId === selected) && (all || (!r.humanApprovalPreserved && ["needs_human","stale","incomplete"].includes(r.outcome)))).map(r=>({...r,
    outcome:r.humanApprovalPreserved ? "Human approved" : ["accepted","corrected_accepted"].includes(r.outcome) ? "AI reviewed and accepted" : r.outcome,
    informationNeeded:r.humanApprovalPreserved ? "Existing human approval preserved; no repeat review required." : r.informationNeeded
  }));
  const accepted = data.filter(r => !r.humanApprovalPreserved && r.outcome === "accepted").length;
  const corrected = data.filter(r => !r.humanApprovalPreserved && r.outcome === "corrected_accepted").length;
  const unresolved = data.filter(r => !r.humanApprovalPreserved && ["needs_human","stale"].includes(r.outcome)).length;
  main.innerHTML = `${pageHeading("Delegated AI content review", "Private D-156 review by Codex Astra under Samuel’s delegation—not human approval or audio verification.", '<a class="button" href="/admin/sermons" data-route>Administrator queue</a>')}
    <section class="panel"><h2>Separate review outcomes</h2><p>${accepted} accepted · ${corrected} corrected and accepted · ${unresolved} material exceptions.</p>
    <p>Current AI-accepted descriptions and Q&A do not require repeated substantive human review. Existing human approvals remain intact. Identity, transcript accuracy, unresolved findings and passage decisions remain separate. Human-completed review counts and publication gates are unchanged.</p>
    <p>Caption fidelity does not verify audio. ASR and unconfirmed audio-association warnings remain source limitations, not automatic rejection of every supported answer.</p>
    <a class="button" href="/admin/ai-reviews${all ? "" : "?all=1"}" data-route>${all ? "Show exceptions and unfinished work" : "Show all AI review outcomes"}</a></section>
    <section class="panel"><h2>${all ? "All AI review outcomes" : "Exceptions and unfinished work"}</h2>
    <div class="table-wrap"><table><thead><tr><th>Sermon</th><th>Item</th><th>Outcome</th><th>Information or decision needed</th></tr></thead><tbody>${rows.map(r => `<tr><td><a href="/admin/sermons/${escapeHtml(r.sermonId)}/review" data-route>${escapeHtml(r.title)}</a></td><td>${r.artifactKey === "description" ? "Description" : r.displayOrder ? `Q&A ${r.displayOrder}` : "Review not completed"}</td><td>${escapeHtml(r.outcome.replaceAll("_"," "))}${r.humanApprovalPreserved ? " · existing human approval preserved" : ""}<div class="subtle">${escapeHtml(r.model ?? "No AI decision")}</div></td><td>${escapeHtml(r.informationNeeded ?? (r.outcome === "stale" ? "Content or source changed; prior AI acceptance no longer applies." : r.outcome === "incomplete" ? "Execution has not completed this review. No human decision is requested merely because it is unfinished." : "No repeated substantive review required."))}</td></tr>`).join("") || '<tr><td colspan="4">No material exceptions in the selected completed work. Unattempted work is not accepted.</td></tr>'}</tbody></table></div></section>`;
}

async function renderRoute(): Promise<void> {
  updateNavigation();
  setBusy(true);
  main.innerHTML = '<div class="loading-card" role="status">Loading local administration…</div>';
  try {
    const path = location.pathname.replace(/\/$/, "") || "/admin";
    main.classList.remove("cms-workspace");
    if (path.startsWith("/admin/cms")) await renderCms({ main, announce, onDirty: value => { dirty = value; }, navigate });
    else if (path === "/admin") await renderDashboard();
    else if (path === "/admin/ai-reviews") await renderDelegatedAiReviews();
    else if (path === "/admin/remaining-reviews" && !new URLSearchParams(location.search).has("legacy")) await renderDashboard();
    else if (path === "/admin/remaining-reviews") await renderRemainingAiReviews();
    else if (path === "/admin/sermons" && !new URLSearchParams(location.search).has("legacy")) await renderDashboard();
    else if (path === "/admin/sermons") await renderSermonList();
    else if (path === "/admin/sermons/new") await renderSermonForm();
    else if (/^\/admin\/sermons\/[0-9a-f-]+\/review$/i.test(path)) await renderGuidedSermonReview(path.split("/").at(-2)!);
    else if (/^\/admin\/sermons\/[0-9a-f-]+$/i.test(path)) await renderSermonForm(path.split("/").at(-1));
    else if (path === "/admin/taxonomies/speakers") await renderTaxonomy("speakers");
    else if (path === "/admin/taxonomies/series") await renderTaxonomy("series");
    else if (path === "/admin/taxonomies/books") await renderTaxonomy("books");
    else if (path === "/admin/audit") await renderAuditHistory();
    else main.innerHTML = `${pageHeading("Not found", "That administration screen does not exist.")}<a class="button" href="/admin" data-route>Return to dashboard</a>`;
    document.title = `${main.querySelector("h1")?.textContent ?? "Administration"} — Saving Grace Bible Church`;
    main.focus({ preventScroll: true });
  } catch (error) {
    main.innerHTML = `${pageHeading("Administration unavailable", "The local dashboard could not load its data.")}${feedback(errorMessage(error), true)}<button class="button" id="retry-dashboard" type="button">Retry</button>`;
    document.querySelector<HTMLButtonElement>("#retry-dashboard")?.addEventListener("click", () => void renderRoute());
  } finally {
    setBusy(false);
  }
}

document.addEventListener("click", (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-route], nav a");
  if (!link || link.origin !== location.origin || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  void navigate(`${link.pathname}${link.search}`);
});
window.addEventListener("popstate", () => { if (confirmDiscard()) { dirty = false; void renderRoute(); } else history.forward(); });
window.addEventListener("beforeunload", (event) => { if (dirty) event.preventDefault(); });
const mobileNavigation = window.matchMedia("(max-width: 800px)");
const sidebar = document.querySelector<HTMLElement>("#admin-sidebar")!;
const workspace = document.querySelector<HTMLElement>(".workspace")!;
const navBackdrop = document.querySelector<HTMLButtonElement>(".nav-backdrop")!;

function setNavigationOpen(requested: boolean, returnFocus = false): void {
  const open = mobileNavigation.matches && requested;
  document.body.classList.toggle("nav-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  navBackdrop.hidden = !open;
  sidebar.inert = mobileNavigation.matches && !open;
  workspace.inert = open;
  if (open) sidebar.querySelector<HTMLAnchorElement>("[aria-current=page], a")?.focus();
  else if (returnFocus) menuButton.focus();
}

menuButton.addEventListener("click", () => setNavigationOpen(!document.body.classList.contains("nav-open")));
navBackdrop.addEventListener("click", () => setNavigationOpen(false, true));
mobileNavigation.addEventListener("change", () => setNavigationOpen(false));
document.addEventListener("keydown", event => {
  if (!document.body.classList.contains("nav-open")) return;
  if (event.key === "Escape") { event.preventDefault(); setNavigationOpen(false, true); }
  if (event.key === "Tab") {
    const links = [...sidebar.querySelectorAll<HTMLAnchorElement>("a[href]")];
    const first = links[0];
    const last = links.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
setNavigationOpen(false);

void renderRoute();
