import {
  allowedDashboardActions,
  buildControlledMediaInputs,
  buildDeletionSeoDisposition,
  expectedPublicSermonUrl,
  shouldWarnAboutSlugChange
} from "./dashboard-model";
import type { SermonStatus } from "../domain/sermon";

type Relationship = { id: string; name: string; slug: string };
type Readiness = {
  isComplete: boolean;
  hasOneSpeaker: boolean;
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
};
type Taxonomy = Relationship & {
  kind: "speakers" | "series" | "books";
  description: string | null;
  canonicalBookId: number | null;
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
    withApprovedTranscript: number;
    withRequiredQuestionAnswers: number;
    withValidControlledMedia: number;
  };
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
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
  main.innerHTML = `${pageHeading("Dashboard", "Follow the guided checklist until each sermon is ready for review and publication.", '<a class="button primary" href="/admin/sermons/new" data-route>Create sermon</a>')}
    <div class="callout"><strong>Local demonstration data only.</strong><p>These anonymised records test the workflow. The 453 real historical sermons have not yet received their reviewed transcripts and questions.</p></div>
    <section class="panel progress-panel" aria-labelledby="enrichment-progress-heading">
      <h2 id="enrichment-progress-heading">Historical content progress</h2>
      <p><strong>${progress.complete} of ${progress.total} local records complete</strong> · ${progress.remaining} remaining</p>
      <progress max="${Math.max(progress.total, 1)}" value="${progress.complete}">${progress.complete} of ${progress.total}</progress>
      <div class="stats-grid compact">
        <article class="stat-card"><span>One speaker</span><strong>${progress.withOneSpeaker}/${progress.total}</strong></article>
        <article class="stat-card"><span>Approved transcript</span><strong>${progress.withApprovedTranscript}/${progress.total}</strong></article>
        <article class="stat-card"><span>Approved questions</span><strong>${progress.withRequiredQuestionAnswers}/${progress.total}</strong></article>
        <article class="stat-card"><span>Controlled media</span><strong>${progress.withValidControlledMedia}/${progress.total}</strong></article>
      </div>
      <div class="action-row"><a class="button" href="/admin/sermons?contentIssue=missing_speaker" data-route>Find missing speakers</a><a class="button" href="/admin/sermons?contentIssue=missing_transcript" data-route>Find missing transcripts</a><a class="button" href="/admin/sermons?contentIssue=insufficient_questions" data-route>Find missing questions</a></div>
    </section>
    <section class="stats-grid" aria-label="Sermon counts by state">
      ${statuses.map((status) => `<article class="stat-card"><span>${escapeHtml(status)}</span><strong>${sermons.countsByStatus[status]}</strong></article>`).join("")}
    </section>
    <div class="grid-two">
      <section class="panel"><h2>Recently updated</h2><div class="table-wrap"><table><thead><tr><th>Sermon</th><th>State</th><th>Service date</th><th>Speaker</th><th>Series</th><th>Scheduled</th><th>Checklist</th></tr></thead><tbody>${sermonRows(sermons.data)}</tbody></table></div></section>
      <aside class="panel"><h2>What the states mean</h2><dl>${statuses.map((status) => `<dt><span class="status-pill ${status}">${status}</span></dt><dd>${escapeHtml(stateDescriptions[status])}</dd>`).join("")}</dl><div class="callout"><strong>SEO non-regression is a launch gate.</strong><p>Published slugs retain their paths. Unapproved transcripts and questions are never public.</p></div></aside>
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
    ["Complete transcript approved", readiness?.hasApprovedTranscript ?? false],
    ["5–10 questions and answers approved", readiness?.hasRequiredQuestionAnswers ?? false],
    ["Controlled sermon media valid", readiness?.hasValidControlledMedia ?? false]
  ] as const;
  return `<ul class="checklist">${items.map(([label, complete]) => `<li class="${complete ? "complete" : "incomplete"}"><span aria-hidden="true">${complete ? "✓" : "○"}</span><span>${escapeHtml(label)}</span></li>`).join("")}</ul>`;
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
        <div class="wide step-heading"><span>Step 1 of 6</span><h2>1. Sermon basics</h2><p>Start with the title, stable public address, service date and summary.</p></div>
        <label><span>Title</span><input id="sermon-title" name="title" required maxlength="240" value="${escapeHtml(detail?.title ?? "")}" /></label>
        <label><span>Slug</span><input id="sermon-slug" name="slug" required maxlength="200" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeHtml(detail?.slug ?? "")}" /><small class="field-hint">Lowercase letters, numbers, and hyphens. Historic changes create a redirect.</small></label>
        <label><span>Service date</span><input name="serviceDate" type="date" required value="${escapeHtml(detail?.serviceDate ?? new Date().toISOString().slice(0, 10))}" /></label>
        <label><span>Schedule time</span><input id="scheduled-for" type="datetime-local" value="${detail?.scheduledFor ? escapeHtml(detail.scheduledFor.slice(0, 16)) : ""}" /><small class="field-hint">Used only by the Schedule action and must be in the future.</small></label>
        <label class="wide"><span>Summary</span><textarea name="summary" maxlength="2000">${escapeHtml(detail?.summary ?? "")}</textarea></label>
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
        <div class="step-heading"><span>Step 6 of 6</span><h2>6. Review and publish</h2><p>Resolve every checklist item before scheduling or publishing. Saving a draft remains available at any time.</p></div>
        ${detail?.historicalBackfillRequired ? '<div class="callout"><strong>Historical backfill required.</strong><p>This imported record preserves its original WordPress state, but launch remains blocked until its transcript and questions are approved.</p></div>' : ""}
        <h3>Completion checklist</h3>${readinessChecklist(detail?.readiness ?? null)}
        <h3>Search preview</h3>
        <div class="seo-preview"><strong id="seo-title-preview">${escapeHtml(detail?.title ?? "Untitled sermon")}</strong><code id="seo-url-preview">${escapeHtml(expectedPublicSermonUrl(detail?.slug ?? "new-sermon"))}</code><p class="subtle">The current schema has no arbitrary SEO metadata store. Explicit allowlisted SEO fields remain a future ordered migration and contract decision.</p></div>
        <div id="slug-warning"></div>
      </section>
      <div class="form-actions"><button class="button primary" type="submit">${detail ? "Save changes" : "Create draft"}</button><span class="subtle" id="dirty-state">No unsaved changes</span></div>
    </form>
    ${detail ? `<section class="panel" id="editorial-actions"><h2>Review and publishing actions</h2><p><strong>Current state:</strong> <span class="status-pill ${detail.status}">${detail.status}</span> — ${escapeHtml(stateDescriptions[detail.status])}</p>${detail.readiness.isComplete ? '<p class="feedback">The content checklist is complete. Schedule and publish actions are available when valid for this state.</p>' : `<div class="callout"><strong>Not ready to schedule or publish.</strong><p>${escapeHtml(detail.readiness.issues.map((issue) => issue.message).join(" "))}</p></div>`}<div class="action-row">${allowedDashboardActions(detail.status).map((action) => `<button class="button${action === "archive" ? " danger" : action === "publish" || action === "schedule" ? " primary" : ""}" type="button" data-transition="${action}">${action[0]!.toUpperCase()}${action.slice(1)}</button>`).join("")}</div>${detail.status === "archived" ? '<hr /><button class="button danger" id="open-delete" type="button">Permanently delete…</button>' : ""}</section><section class="panel" id="sermon-audit"><h2>Audit history</h2><div class="subtle">Loading audit events…</div></section>` : ""}
    ${detail?.status === "archived" ? deletionDialog(detail) : ""}`;

  const form = document.querySelector<HTMLFormElement>("#sermon-form")!;
  const titleInput = document.querySelector<HTMLInputElement>("#sermon-title")!;
  const slugInput = document.querySelector<HTMLInputElement>("#sermon-slug")!;
  const dirtyState = document.querySelector<HTMLElement>("#dirty-state")!;
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
        const scheduledInput = document.querySelector<HTMLInputElement>("#scheduled-for")!;
        const payload: { rowVersion: number; scheduledFor?: string } = { rowVersion: detail.rowVersion };
        if (action === "schedule") {
          if (!scheduledInput.value) { document.querySelector<HTMLElement>("#form-feedback")!.innerHTML = feedback("Choose a future schedule time first.", true); scheduledInput.focus(); return; }
          payload.scheduledFor = new Date(scheduledInput.value).toISOString();
        }
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
  main.innerHTML = `${pageHeading(kind[0]!.toUpperCase() + kind.slice(1), `Manage controlled ${kind} used by sermon relationships.`)}<div id="taxonomy-feedback"></div><div class="grid-two"><section class="panel"><h2>Existing ${kind}</h2><div class="table-wrap"><table><thead><tr><th>Name</th><th>Slug</th><th>Updated</th><th></th></tr></thead><tbody>${response.data.length ? response.data.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td><code>${escapeHtml(item.slug)}</code></td><td>${escapeHtml(humanDate(item.updatedAt))}</td><td><button class="button quiet" type="button" data-edit-taxonomy="${item.id}">Edit</button></td></tr>`).join("") : `<tr><td colspan="4" class="empty-state">No ${escapeHtml(kind)} yet.</td></tr>`}</tbody></table></div></section><section class="panel"><h2 id="taxonomy-form-title">Add ${escapeHtml(singular)}</h2><form id="taxonomy-form" class="stack"><input type="hidden" name="id" /><input type="hidden" name="rowVersion" /><label><span>Name</span><input name="name" required maxlength="240" /></label><label><span>Slug</span><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxlength="200" /></label>${kind === "books" ? '<label><span>Canonical Bible book ID</span><input name="canonicalBookId" type="number" min="1" max="66" /><small class="field-hint">Optional. Leave empty when historic classification is unresolved.</small></label>' : '<label><span>Description</span><textarea name="description" maxlength="10000"></textarea></label>'}<div class="action-row"><button class="button primary" type="submit">Save</button><button class="button" type="reset">Clear</button></div></form></section></div>`;
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
