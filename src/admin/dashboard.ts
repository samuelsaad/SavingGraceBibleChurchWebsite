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

type Relationship = { id: string; name: string; slug: string };
type Readiness = {
  isComplete: boolean;
  isContentComplete: boolean;
  hasOneSpeaker: boolean;
  hasRequiredBibleBook: boolean;
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
  enrichmentSource: {
    provider: "youtube";
    videoId: string;
    canonicalUrl: string;
    captionLanguage: string;
    captionTrackType: "manual" | "automatic" | "unknown";
    originalFilename: string;
    sourceContentSha256: string;
    retrievalAttribution: "authorised_youtube_studio_export";
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
  headers.set("x-local-identity", "admin");
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
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
  if (pathname === "/admin/sermons/new") return "new";
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
  document.body.classList.remove("nav-open");
  menuButton.setAttribute("aria-expanded", "false");
  await renderRoute();
}

function pageHeading(title: string, description: string, action = ""): string {
  return `<header class="page-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action}</header>`;
}

function sermonRows(sermons: SermonSummary[]): string {
  if (!sermons.length) return `<tr><td colspan="7" class="empty-state"><strong>No sermons match these filters.</strong><br />Try clearing a filter or choosing another content task.</td></tr>`;
  return sermons.map((sermon) => `<tr>
    <td><a href="/admin/sermons/${sermon.id}" data-route>${escapeHtml(sermon.title)}</a><div class="subtle">/${escapeHtml(sermon.slug)}/</div></td>
    <td><span class="status-pill ${escapeHtml(sermon.status)}">${escapeHtml(sermon.status)}</span></td>
    <td>${escapeHtml(humanDate(sermon.serviceDate))}</td>
    <td>${escapeHtml(sermon.speaker?.name ?? "—")}</td>
    <td>${escapeHtml(sermon.series.map((item) => item.name).join(", ") || "—")}</td>
    <td>${sermon.scheduledFor ? `<strong>${escapeHtml(humanDate(sermon.scheduledFor))}</strong>` : "—"}</td>
    <td><span class="status-pill ${sermon.readiness.isComplete ? "published" : "scheduled"}">${sermon.readiness.isComplete ? "Complete" : "Needs work"}</span></td>
  </tr>`).join("");
}

async function renderDashboard(): Promise<void> {
  const sermons = await api<ListResponse>("/api/v1/admin/sermons?page=1&pageSize=6");
  const statuses: SermonStatus[] = ["draft", "pending", "scheduled", "published", "unpublished", "archived"];
  const progress = sermons.readinessProgress;
  const pilotQueue = sermons.data.filter((sermon) => sermon.enrichmentReview !== null);
  main.innerHTML = `${pageHeading("Dashboard", "Follow the guided checklist until each sermon is ready for review and publication.", '<a class="button primary" href="/admin/sermons/new" data-route>Create sermon</a>')}
    <div class="callout"><strong>Private local pilot only.</strong><p>These records remain draft, loopback-only and excluded from public and search surfaces. No larger historical batch has begun.</p></div>
    <section class="panel progress-panel" aria-labelledby="enrichment-progress-heading">
      <h2 id="enrichment-progress-heading">Historical content progress</h2>
      <p><strong>${progress.complete} of ${progress.total} local records complete</strong> · ${progress.remaining} remaining</p>
      <progress max="${Math.max(progress.total, 1)}" value="${progress.complete}">${progress.complete} of ${progress.total}</progress>
      <div class="stats-grid compact">
        <article class="stat-card"><span>One speaker</span><strong>${progress.withOneSpeaker}/${progress.total}</strong></article>
        <article class="stat-card"><span>Canonical Bible book</span><strong>${progress.withRequiredBibleBook}/${progress.total}</strong></article>
        <article class="stat-card"><span>Approved description</span><strong>${progress.withApprovedDescription}/${progress.total}</strong></article>
        <article class="stat-card"><span>Approved transcript</span><strong>${progress.withApprovedTranscript}/${progress.total}</strong></article>
        <article class="stat-card"><span>Approved questions</span><strong>${progress.withRequiredQuestionAnswers}/${progress.total}</strong></article>
        <article class="stat-card"><span>Controlled media</span><strong>${progress.withValidControlledMedia}/${progress.total}</strong></article>
      </div>
      <div class="action-row"><a class="button" href="/admin/sermons?contentIssue=missing_speaker" data-route>Find missing speakers</a><a class="button" href="/admin/sermons?contentIssue=missing_description" data-route>Find missing descriptions</a><a class="button" href="/admin/sermons?contentIssue=description_awaiting_review" data-route>Review descriptions</a><a class="button" href="/admin/sermons?contentIssue=missing_transcript" data-route>Find missing transcripts</a><a class="button" href="/admin/sermons?contentIssue=insufficient_questions" data-route>Find missing questions</a></div>
    </section>
    <section class="panel" aria-labelledby="pilot-work-queue-heading">
      <h2 id="pilot-work-queue-heading">Phase 3B.2 pilot work queue</h2>
      <p class="subtle">Content review completion and replacement-launch metadata are shown separately.</p>
      <ol class="review-queue">${pilotQueue.map((sermon) => {
        const completed = sermon.enrichmentReview?.completedAt !== null;
        const status = completed && !sermon.readiness.hasRequiredBibleBook
          ? "Content reviewed · Bible-book assignment required"
          : completed
            ? "Content reviewed"
            : "Administrator review required";
        return `<li><div><strong>${escapeHtml(sermon.title)}</strong><span>${escapeHtml(status)}</span></div><a class="button" href="/admin/sermons/${sermon.id}/review" data-route>Open guided review</a></li>`;
      }).join("")}</ol>
    </section>
    <section class="stats-grid" aria-label="Sermon counts by state">
      ${statuses.map((status) => `<article class="stat-card"><span>${escapeHtml(status)}</span><strong>${sermons.countsByStatus[status]}</strong></article>`).join("")}
    </section>
    <div class="grid-two">
      <section class="panel"><h2>Recently updated</h2><div class="table-wrap"><table><thead><tr><th>Sermon</th><th>State</th><th>Service date</th><th>Speaker</th><th>Series</th><th>Scheduled</th><th>Checklist</th></tr></thead><tbody>${sermonRows(sermons.data)}</tbody></table></div></section>
      <aside class="panel"><h2>What the states mean</h2><dl>${statuses.map((status) => `<dt><span class="status-pill ${status}">${status}</span></dt><dd>${escapeHtml(stateDescriptions[status])}</dd>`).join("")}</dl><div class="callout"><strong>SEO non-regression is a launch gate.</strong><p>Published slugs retain their paths. Unapproved descriptions, transcripts and questions are never public.</p></div></aside>
    </div>`;
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

function firstIncompleteReviewStage(review: EnrichmentReviewResponse): number {
  return enrichmentReviewStages.findIndex((_, index) => !reviewStageComplete(review, index + 1)) + 1 || 6;
}

function reviewStageNavigation(review: EnrichmentReviewResponse): string {
  return `<nav class="review-stage-nav" aria-label="Sermon review stages">
    <ol>${enrichmentReviewStages.map((label, index) => {
      const stage = index + 1;
      const complete = reviewStageComplete(review, stage);
      const current = review.review.currentStage === stage;
      const blocked = review.review.completedAt === null && stage > firstIncompleteReviewStage(review);
      return `<li><button type="button" class="review-stage-button${current ? " current" : ""}" data-review-stage="${stage}"${current ? ' aria-current="step"' : ""}${blocked ? ' disabled aria-disabled="true"' : ""}>
        <span class="review-stage-number">${stage}</span>
        <span><strong>${escapeHtml(label)}</strong><small>${complete ? "Complete" : current ? "Current stage" : blocked ? "Complete earlier stage first" : "Not complete"}</small></span>
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

function renderIdentityReviewStage(
  review: EnrichmentReviewResponse,
  speakers: Taxonomy[],
  books: Taxonomy[]
): string {
  const sermon = review.sermon;
  const source = sermon.enrichmentSource!;
  const unresolvedDate = sermon.serviceDate === "1970-01-01";
  const completed = review.review.completedAt !== null;
  const canonicalBooks = books.filter((book) => book.canonicalBookId !== null);
  const selectedBookId = sermon.books[0]?.id ?? "";
  return `<form id="review-identity-form" class="review-stage-panel stack" novalidate>
    <header class="review-stage-heading"><p>Stage 1 of 6</p><h2>Identity and provenance</h2><p>Confirm that this draft belongs to the correct sermon before reviewing its words. Nothing here publishes content.</p></header>
    <div id="review-stage-feedback"></div>
    <div class="review-form-grid">
      <label><span>Sermon title</span><input name="title" required maxlength="240" value="${escapeHtml(sermon.title)}"${completed ? " readonly" : ""} /></label>
      <label><span>Speaker</span><select name="speakerId" required${completed ? " disabled" : ""}>${filterOption(speakers, sermon.speaker?.id ?? "", "Select the verified speaker")}</select><small class="field-hint">No speaker is selected automatically.</small></label>
      <label><span>Service date</span><input name="serviceDate" type="date" value="${unresolvedDate ? "" : escapeHtml(sermon.serviceDate)}"${completed ? " readonly" : ""} /><small class="field-hint">${unresolvedDate ? "Date unresolved — verify and enter the preached date." : "Confirm this is the date preached."}</small></label>
      <div class="review-readonly-field"><span>Draft status</span><strong>Draft • Private</strong><small>Review and approval do not publish this sermon.</small></div>
      <label><span>Primary Bible book</span><select name="bookClassificationId">${filterOption(canonicalBooks, selectedBookId, "No Bible book assigned")}</select><small class="field-hint">Choose the canonical book only after personal verification. There is no automatic or default assignment.</small></label>
    </div>
    <section class="source-summary" aria-labelledby="source-summary-heading">
      <div><p class="eyebrow">Private source</p><h3 id="source-summary-heading">Authorised YouTube Studio export</h3></div>
      <dl class="source-facts">
        <div><dt>Video identity</dt><dd><code>${escapeHtml(source.videoId)}</code></dd></div>
        <div><dt>Caption language</dt><dd>${escapeHtml(source.captionLanguage)}</dd></div>
        <div><dt>Caption track</dt><dd>${source.captionTrackType === "unknown" ? "Not identified by the export" : escapeHtml(source.captionTrackType)}</dd></div>
        <div><dt>Accuracy</dt><dd>Administrator verification required</dd></div>
      </dl>
      ${technicalProvenance(source)}
    </section>
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
    <header class="review-stage-heading"><p>Stage 2 of 6</p><h2 id="flagged-review-heading">Flagged review items</h2><p>Review the exact associated transcript wording. Accepting leaves it unchanged; correcting saves the edited wording and decision together.</p></header>
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
    <header class="review-stage-heading"><p>Stage 3 of 6</p><h2>Complete transcript</h2><p>Read the complete draft in a comfortable workspace. Saving edits does not approve them.</p></header>
    <div id="review-stage-feedback"></div>
    <div class="review-content-status"><span>Current status</span><strong>${escapeHtml(plainReviewStatus(transcript?.status ?? "missing"))}</strong></div>
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

function renderDescriptionReviewStage(review: EnrichmentReviewResponse): string {
  const summary = review.sermon.summary ?? "";
  return `<form id="review-description-form" class="review-stage-panel stack" novalidate>
    <header class="review-stage-heading"><p>Stage 4 of 6</p><h2>Sermon description</h2><p>Review the visible description separately from the transcript. Approval still does not publish the sermon.</p></header>
    <div id="review-stage-feedback"></div>
    <div class="review-content-status"><span>Current status</span><strong>${escapeHtml(plainReviewStatus(review.sermon.summaryStatus))}</strong></div>
    <label class="review-editor-label"><span>Sermon description</span><textarea id="review-description-body" name="summary" maxlength="2000" required>${escapeHtml(summary)}</textarea><small class="field-hint">Approval requires 80–2,000 characters of useful plain text.</small></label>
    <p class="review-counts" id="review-description-counts">${summary.trim().length.toLocaleString()} of 80–2,000 characters</p>
    <div class="review-decision-bar">
      <button class="button" type="submit" data-description-review-action="save">Save description draft</button>
      <button class="button danger" type="submit" data-description-review-action="reject">Reject and return to draft</button>
      <button class="button primary" type="submit" data-description-review-action="approve"${summary.trim().length < 80 ? " disabled" : ""}>Approve description</button>
    </div>
    ${reviewStageActions(review, 4)}
  </form>`;
}

function reviewQuestionCard(item: SermonDetail["questionAnswers"][number], index: number, total: number): string {
  return `<form class="review-qa-card" data-review-qa="${escapeHtml(item.id)}">
    <header><div><p>Question ${index + 1} of ${total}</p><h3>Question ${index + 1}</h3></div><span class="status-pill">${escapeHtml(plainReviewStatus(item.status))}</span></header>
    <label><span>Question</span><textarea name="question" maxlength="1000" required>${escapeHtml(item.question)}</textarea></label>
    <label><span>Answer</span><textarea name="answer" maxlength="10000" required>${escapeHtml(item.answer)}</textarea></label>
    <div class="qa-order-actions" aria-label="Reorder question ${index + 1}">
      <button class="button quiet" type="button" data-qa-move="up"${index === 0 ? " disabled" : ""}>Move up</button>
      <button class="button quiet" type="button" data-qa-move="down"${index === total - 1 ? " disabled" : ""}>Move down</button>
    </div>
    <div class="review-decision-bar">
      <button class="button" type="submit" data-qa-action="save">Save pair</button>
      <button class="button danger" type="submit" data-qa-action="reject">Reject pair</button>
      <button class="button primary" type="submit" data-qa-action="approve">Approve pair</button>
    </div>
  </form>`;
}

function renderQuestionReviewStage(review: EnrichmentReviewResponse): string {
  const questions = [...review.sermon.questionAnswers].sort((a, b) => a.displayOrder - b.displayOrder);
  const approved = questions.filter((item) => item.status === "approved").length;
  return `<section class="review-stage-panel" aria-labelledby="qa-review-heading">
    <header class="review-stage-heading"><p>Stage 5 of 6</p><h2 id="qa-review-heading">Ordered questions and answers</h2><p>Review each pair independently. Five to ten retained pairs must all be approved before the collection is complete.</p></header>
    <div id="review-stage-feedback"></div>
    <div class="review-content-status"><span>Collection progress</span><strong>${approved} of ${questions.length} pairs approved</strong></div>
    <div class="review-qa-list">${questions.map((item, index) => reviewQuestionCard(item, index, questions.length)).join("")}</div>
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
    <header class="review-stage-heading"><p>Stage 6 of 6</p><h2 id="final-review-heading">Final review summary</h2><p>Finishing records that the editorial review is complete. It does not submit, schedule or publish this draft.</p></header>
    <div id="review-stage-feedback"></div>
    <ul class="checklist review-final-checklist">
      ${finalChecklistItem("One speaker confirmed", review.review.identityStatus === "confirmed" && Boolean(sermon.speaker), sermon.speaker ? "A verified speaker is selected." : "Return to Identity and choose the speaker.")}
      ${finalChecklistItem("Canonical Bible book assigned", sermon.readiness.hasRequiredBibleBook, sermon.readiness.hasRequiredBibleBook ? "Replacement-launch metadata is complete." : "Content review may finish, but replacement launch remains blocked until Samuel assigns the Bible book.")}
      ${finalChecklistItem("Service date confirmed", dateConfirmed, dateConfirmed ? "The preached date was verified." : "The service date is unresolved.")}
      ${finalChecklistItem("Provenance reviewed", review.review.identityStatus === "confirmed", "Source identity, language, track and attribution were presented in Stage 1.")}
      ${finalChecklistItem("Flagged items resolved", review.progress.stageCompletion.findings, review.progress.totalItemCount === 0 ? review.progress.stageCompletion.findings ? "The verified empty set was explicitly acknowledged." : "The verified empty set requires an explicit acknowledgement." : `${review.progress.resolvedItemCount} of ${review.progress.totalItemCount} items resolved.`)}
      ${finalChecklistItem("Transcript approved", review.progress.stageCompletion.transcript, plainReviewStatus(sermon.transcript?.status ?? "missing"))}
      ${finalChecklistItem("Description approved", review.progress.stageCompletion.description, plainReviewStatus(sermon.summaryStatus))}
      ${finalChecklistItem("Five to ten Q&A pairs approved", review.progress.stageCompletion.questionAnswers, `${sermon.questionAnswers.filter((item) => item.status === "approved").length} of ${sermon.questionAnswers.length} approved.`)}
      ${finalChecklistItem("Controlled media valid", sermon.readiness.hasValidControlledMedia, sermon.readiness.hasValidControlledMedia ? "Controlled media passed validation." : "Controlled media still requires attention.")}
      ${finalChecklistItem("Sermon remains draft and unpublished", sermon.status === "draft", `Current sermon state: ${sermon.status}.`)}
    </ul>
    <div class="review-decision-bar">
      <button class="button" type="button" data-review-pause>Save and pause</button>
      <button class="button primary" type="button" id="finish-enrichment-review"${review.progress.canFinish ? "" : " disabled"}>Finish review</button>
    </div>
    ${review.review.completedAt ? `<p class="feedback">Review finished ${escapeHtml(humanDate(review.review.completedAt))}. The sermon remains draft and private.</p>` : ""}
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
  body.addEventListener("input", () => {
    const length = body.value.trim().length;
    counts.textContent = `${length.toLocaleString()} of 80–2,000 characters`;
    const approve = form.querySelector<HTMLButtonElement>('[data-description-review-action="approve"]');
    if (approve) approve.disabled = length < 80;
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
  const [review, taxonomies] = await Promise.all([
    api<EnrichmentReviewResponse>(`/api/v1/admin/sermons/${id}/review`),
    loadTaxonomies()
  ]);
  if (review.review.completedAt !== null && readOnlyStage !== undefined) {
    review.review.currentStage = Math.max(1, Math.min(6, readOnlyStage));
  }
  dirty = false;
  main.innerHTML = `<header class="review-record-header">
    <div><a href="/admin/sermons" data-route>Back to sermons</a><p class="eyebrow">Guided private review</p><h1>${escapeHtml(review.sermon.title)}</h1><p>Record ${review.recordPosition} of ${review.recordCount}</p></div>
    <div class="review-record-status"><span class="status-pill">Draft • Private</span><strong>${review.review.completedAt ? "Content review complete" : `${review.progress.percentReviewed}% reviewed`}</strong>${review.review.completedAt ? "<small>Completed editorial stages are read-only. Bible-book metadata remains available in Stage 1.</small>" : ""}</div>
    <progress max="100" value="${review.progress.percentReviewed}">${review.progress.percentReviewed}%</progress>
  </header>
  <div class="review-workflow-layout">
    ${reviewStageNavigation(review)}
    <div class="review-stage-workspace">${reviewStageMarkup(review, taxonomies.speakers, taxonomies.books)}</div>
  </div>`;

  if (review.review.completedAt !== null) {
    for (const control of document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
      ".review-stage-workspace input, .review-stage-workspace select, .review-stage-workspace textarea, .review-stage-workspace button"
    )) {
      const isBibleBookControl = control.matches('[name="bookClassificationId"], [data-identity-action="save"]');
      const isReadOnlyNavigation = control.matches("[data-review-stage]");
      if (!isBibleBookControl && !isReadOnlyNavigation) {
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
    if (review.review.completedAt !== null && identityStatus === undefined) {
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
          bookClassificationIds: bookClassificationId ? [bookClassificationId] : [],
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
  if (!query.has("pageSize")) query.set("pageSize", "20");
  const [sermons, taxonomies] = await Promise.all([
    api<ListResponse>(`/api/v1/admin/sermons?${query.toString()}`),
    loadTaxonomies()
  ]);
  const currentPage = sermons.pagination.page;
  const pageQuery = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/admin/sermons?${next.toString()}`;
  };
  main.innerHTML = `${pageHeading("Sermons", "Search and filter every editorial state. Public endpoints remain published-only.", '<a class="button primary" href="/admin/sermons/new" data-route>New sermon</a>')}
    <section class="panel">
      <form class="filters" id="sermon-filters" role="search">
        <label><span>Title or slug</span><input name="query" type="search" value="${escapeHtml(query.get("query") ?? "")}" autocomplete="off" /></label>
        <label><span>State</span><select name="status"><option value="">All states</option>${(["draft","pending","scheduled","published","unpublished","archived"] as SermonStatus[]).map((status) => `<option value="${status}"${query.get("status") === status ? " selected" : ""}>${status}</option>`).join("")}</select></label>
        <label><span>Speaker</span><select name="speakerId">${filterOption(taxonomies.speakers, query.get("speakerId") ?? "", "All speakers")}</select></label>
        <label><span>Series</span><select name="seriesId">${filterOption(taxonomies.series, query.get("seriesId") ?? "", "All series")}</select></label>
        <label><span>Service date from</span><input name="serviceDateFrom" type="date" value="${escapeHtml(query.get("serviceDateFrom") ?? "")}" /></label>
        <label><span>Service date to</span><input name="serviceDateTo" type="date" value="${escapeHtml(query.get("serviceDateTo") ?? "")}" /></label>
        <label><span>Content task</span><select name="contentIssue">
          <option value="">All content</option>
          ${[
            ["complete", "Complete"],
            ["missing_speaker", "Missing speaker"],
            ["missing_description", "Missing sermon description"],
            ["description_awaiting_review", "Description awaiting review"],
            ["missing_transcript", "Missing transcript"],
            ["transcript_awaiting_review", "Transcript awaiting review"],
            ["insufficient_questions", "Needs 5–10 questions"],
            ["questions_awaiting_review", "Questions awaiting review"],
            ["missing_media", "Missing controlled media"]
          ].map(([value, label]) => `<option value="${value}"${query.get("contentIssue") === value ? " selected" : ""}>${label}</option>`).join("")}
        </select></label>
        <button class="button" type="submit">Apply filters</button>
      </form>
      <div class="table-wrap"><table><caption class="sr-only">Filtered sermons</caption><thead><tr><th>Sermon</th><th>State</th><th>Service date</th><th>Speaker</th><th>Series</th><th>Scheduled</th><th>Checklist</th></tr></thead><tbody>${sermonRows(sermons.data)}</tbody></table></div>
      <div class="pagination"><span class="subtle">${sermons.pagination.totalItems} result${sermons.pagination.totalItems === 1 ? "" : "s"} · Page ${currentPage} of ${Math.max(sermons.pagination.totalPages, 1)}</span><div class="action-row">${currentPage > 1 ? `<a class="button" href="${pageQuery(currentPage - 1)}" data-route>Previous</a>` : ""}${currentPage < sermons.pagination.totalPages ? `<a class="button" href="${pageQuery(currentPage + 1)}" data-route>Next</a>` : ""}</div></div>
    </section>`;
  document.querySelector<HTMLFormElement>("#sermon-filters")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const params = new URLSearchParams({ page: "1", pageSize: "20" });
    for (const [key, value] of data.entries()) if (String(value).trim()) params.set(key, String(value).trim());
    void navigate(`/admin/sermons?${params.toString()}`);
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

function readinessChecklist(readiness: Readiness | null): string {
  const items = [
    ["One speaker selected", readiness?.hasOneSpeaker ?? false],
    ["Canonical Bible book assigned", readiness?.hasRequiredBibleBook ?? false],
    ["Sermon description approved", readiness?.hasApprovedDescription ?? false],
    ["Complete transcript approved", readiness?.hasApprovedTranscript ?? false],
    ["5–10 questions and answers approved", readiness?.hasRequiredQuestionAnswers ?? false],
    ["Controlled sermon media valid", readiness?.hasValidControlledMedia ?? false]
  ] as const;
  return `<ul class="checklist">${items.map(([label, complete]) => `<li class="${complete ? "complete" : "incomplete"}"><span aria-hidden="true">${complete ? "✓" : "○"}</span><span>${escapeHtml(label)}</span></li>`).join("")}</ul>`;
}

function enrichmentSourcePanel(source: SermonDetail["enrichmentSource"]): string {
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
  main.innerHTML = `${pageHeading(title, description, '<a class="button" href="/admin/sermons" data-route>Back to sermons</a>')}
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
        <label><span>Scripture references</span><textarea name="scriptureReferences" placeholder="One display reference per line">${escapeHtml(detail?.scriptureReferences.map((item) => item.displayText).join("\n") ?? "")}</textarea><small class="field-hint">Each edited line is stored as a curated reference. Imported source provenance remains separate and is never exposed here.</small></label>
      </section>
      <section class="panel form-grid">
        <div class="wide step-heading"><span>Step 3 of 6</span><h2>3. Media</h2><p>Add controlled provider URLs. Raw embed or iframe code is never accepted.</p></div>
        <fieldset><legend>YouTube video</legend><div class="stack"><label><span>Canonical URL</span><input name="youtubeUrl" type="url" value="${escapeHtml(youtube?.canonicalUrl ?? "")}" placeholder="https://www.youtube.com/watch?v=…" /></label><label><span>Accessible title</span><input name="youtubeTitle" value="${escapeHtml(youtube?.title ?? "Sermon video")}" maxlength="500" /></label></div></fieldset>
        <fieldset><legend>SermonAudio audio</legend><div class="stack"><label><span>Canonical URL</span><input name="sermonAudioUrl" type="url" value="${escapeHtml(sermonAudio?.canonicalUrl ?? "")}" placeholder="https://www.sermonaudio.com/…" /></label><label><span>Accessible title</span><input name="sermonAudioTitle" value="${escapeHtml(sermonAudio?.title ?? "Sermon audio")}" maxlength="500" /></label></div></fieldset>
        <div class="wide callout">Raw iframe or embed HTML is never accepted. The application validates controlled provider URLs and generates any future embed markup itself.</div>
      </section>
      <section class="panel form-grid">
        <div class="wide step-heading"><span>Step 4 of 6</span><h2>4. Full transcript</h2><p>Add the complete plain-text transcript, then move it through human review. Only approved text can appear publicly.</p></div>
        ${enrichmentSourcePanel(detail?.enrichmentSource ?? null)}
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
        <h3>Completion checklist</h3>${readinessChecklist(detail?.readiness ?? null)}
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
      scriptureReferences: String(data.get("scriptureReferences") ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((displayText) => ({ displayText })),
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

async function renderRoute(): Promise<void> {
  updateNavigation();
  setBusy(true);
  main.innerHTML = '<div class="loading-card" role="status">Loading local administration…</div>';
  try {
    const path = location.pathname.replace(/\/$/, "") || "/admin";
    if (path === "/admin") await renderDashboard();
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
  if (!link || link.origin !== location.origin) return;
  event.preventDefault();
  void navigate(`${link.pathname}${link.search}`);
});
window.addEventListener("popstate", () => { if (confirmDiscard()) { dirty = false; void renderRoute(); } else history.forward(); });
window.addEventListener("beforeunload", (event) => { if (dirty) event.preventDefault(); });
menuButton.addEventListener("click", () => {
  const open = !document.body.classList.contains("nav-open");
  document.body.classList.toggle("nav-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
});

void renderRoute();
