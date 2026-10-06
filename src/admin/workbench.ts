import { reviewDestination, type WorkbenchSnapshot, type WorkbenchSermon } from "../domain/admin-workbench";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/gu, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const icon = (kind: "check" | "arrow" | "search" | "alert") => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
  check: '<path d="m5 12 4 4L19 6"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>'
}[kind]}</svg>`;
const date = (value: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
const categories: Record<string, string> = { source: "Source & wording", speaker: "Speaker", identity: "Identity", passage: "Passage", content: "Description & Q&A", other: "Other requirements" };
function category(component: string) { return ["findings", "transcript"].includes(component) ? "source" : ["description", "questions"].includes(component) ? "content" : ["speaker", "identity", "passage"].includes(component) ? component : "other"; }

export function workbenchBanner(row: WorkbenchSermon): string {
  return `<section class="wb-record-banner ${row.complete ? "is-complete" : "is-attention"}" aria-label="Current collection review status">
    <div>${icon(row.complete ? "check" : "alert")}<strong>${row.complete ? "Review complete · restricted frontend ready" : "Needs your attention"}</strong></div>
    <p>${row.complete ? "The current saved acceptance matches this version. Human approvals and delegated AI decisions remain separately recorded; no repeated substantive review is required." : "Resolve the specific saved concerns below. Earlier accepted work and its attribution remain preserved."}</p>
    ${row.complete ? "" : `<ul>${row.concerns.map(c => `<li><strong>${escape(c.label)}.</strong> ${escape(c.informationNeeded)} <a href="${reviewDestination(row.id, c.component)}" data-route>Open ${escape(c.component === "questions" ? "Q&A" : c.component)} review</a></li>`).join("")}</ul>`}
    <small>Restricted acceptance is not publication approval. Changing relevant content or evidence can invalidate acceptance.</small>
  </section>`;
}

export function renderWorkbench(target: HTMLElement, snapshot: WorkbenchSnapshot, defaultView: "attention" | "all" = "attention") {
  const params = new URLSearchParams(location.search);
  let view = ["attention", "complete", "all"].includes(params.get("view") ?? "") ? params.get("view")! : defaultView;
  let query = params.get("q") ?? "";
  let reason = params.get("reason") ?? "";
  let page = 1;
  const pageSize = 20;
  const counts = snapshot.counts;
  const perReason = Object.fromEntries(Object.keys(categories).map(key => [key, snapshot.data.filter(r => !r.complete && r.concerns.some(c => category(c.component) === key)).length]));
  target.innerHTML = `<header class="wb-heading"><div><h1>Sermon workspace</h1><p>Finished work, clearly marked. Remaining evidence, ready to resolve.</p></div><button type="button" class="button" data-wb-refresh>Refresh status</button></header>
    <section class="wb-summary" aria-label="Collection status"><div class="wb-summary-text"><span class="wb-complete-mark">${icon("check")}</span><p><strong>${counts.complete} of ${counts.total} sermons complete</strong><span>${counts.attention ? `${counts.attention} need attention before restricted acceptance.` : "There are no outstanding records in this collection."} Completion does not publish content.</span></p></div><div class="wb-completion-track" role="img" aria-label="${counts.complete} of ${counts.total} complete"><span style="width:${counts.total ? counts.complete / counts.total * 100 : 0}%"></span></div></section>
    <nav class="wb-views" aria-label="Filter by review status">${[["attention", "Needs attention", counts.attention], ["complete", "Complete", counts.complete], ["all", "All sermons", counts.total]].map(([key, label, count]) => `<button type="button" data-wb-view="${key}" aria-pressed="${view === key}">${label}<span>${count}</span></button>`).join("")}</nav>
    <form class="wb-tools" role="search"><label class="wb-search"><span class="sr-only">Search sermons by title or speaker</span>${icon("search")}<input name="q" type="search" placeholder="Search title or speaker…" value="${escape(query)}" autocomplete="off" /></label><label class="wb-reason"><span>Attention needed</span><select name="reason"><option value="">All reasons</option>${Object.entries(categories).filter(([key]) => perReason[key]).map(([key, label]) => `<option value="${key}"${key === reason ? " selected" : ""}>${label} (${perReason[key]})</option>`).join("")}</select></label><button class="button" type="submit">Search</button></form>
    <div class="wb-results-meta"><p data-wb-count aria-live="polite" aria-atomic="true"></p><button class="wb-clear" type="button" data-wb-clear>Clear filters</button></div>
    <div data-wb-results></div><nav class="wb-pagination" aria-label="Sermon result pages"></nav>
    <footer class="wb-footnote"><p>Complete describes the current saved local workflow. Human approvals, visitor eligibility and publication remain separate.</p><small>Checked ${escape(new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(new Date(snapshot.checkedAt)))} · Local private workspace</small><a href="/admin/sermons?legacy=1" data-route>Advanced library filters</a></footer>`;

  const results = target.querySelector<HTMLElement>("[data-wb-results]")!;
  function draw() {
    const matching = snapshot.data.filter(r => (view === "all" || r.complete === (view === "complete")) && (!query || `${r.title} ${r.speaker ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && (!reason || r.concerns.some(c => category(c.component) === reason)));
    const pages = Math.max(1, Math.ceil(matching.length / pageSize));
    page = Math.min(page, pages);
    const slice = matching.slice((page - 1) * pageSize, page * pageSize);
    target.querySelector("[data-wb-count]")!.textContent = matching.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matching.length)} of ${matching.length} sermons` : "No sermons found";
    target.querySelector<HTMLButtonElement>("[data-wb-clear]")!.hidden = !query && !reason;
    for (const b of target.querySelectorAll<HTMLButtonElement>("[data-wb-view]")) b.setAttribute("aria-pressed", String(b.dataset.wbView === view));
    const select = target.querySelector<HTMLSelectElement>('[name="reason"]')!;
    select.disabled = view === "complete";
    results.innerHTML = slice.length ? `<div class="wb-column-head" aria-hidden="true"><span>Sermon / speaker</span><span>Review status</span><span>Next step</span></div><ol class="wb-list">${slice.map(row => {
      const labels = [...new Set(row.concerns.map(c => c.label))];
      return `<li class="wb-item"><details><summary><span class="wb-identity"><strong>${escape(row.title)}</strong><span>${escape(date(row.serviceDate))}<span class="wb-separator"> / </span>${escape(row.speaker ?? "Speaker not identified")}</span></span><span class="wb-state ${row.complete ? "complete" : "attention"}">${icon(row.complete ? "check" : "alert")}${row.complete ? "Complete" : "Needs attention"}</span><span class="wb-next"><span>${row.complete ? "Saved completion verified" : escape(labels.join(" · "))}</span><span class="wb-inspect">${row.complete ? "View details" : "Resolve evidence"}${icon("arrow")}</span></span></summary>
        <div class="wb-detail">${row.complete ? `<div class="wb-accepted"><h2>Completed sermon</h2><p>The saved completion matches the current content. Original human and AI review history remains preserved.</p><a class="button" href="${reviewDestination(row.id, "completion")}" data-route>Open sermon</a></div>` : `<div class="wb-resolution"><h2>What needs your decision</h2><p class="wb-muted">These are the saved evidence exceptions, not a request to redo the whole sermon.</p><ul>${row.concerns.map(c => `<li><div><h3>${escape(c.label)}</h3><p>${escape(c.informationNeeded)}</p><small>${c.scope ? `${escape(c.scope)} · saved AI finding` : "Current record requirement"}${c.recordedAt ? ` · ${escape(date(c.recordedAt))}` : ""}</small></div><a class="button" href="${reviewDestination(row.id, c.component)}" data-route>${c.component === "speaker" ? "Choose speaker" : c.component === "identity" ? "Check identity" : c.component === "passage" ? "Check passage" : c.component === "description" ? "Review description" : c.component === "questions" ? "Review Q&A" : "Open evidence"}${icon("arrow")}</a></li>`).join("")}</ul></div>`}
        <div class="wb-decision-guide"><strong>Your next step</strong><p>${row.complete ? 'Open the sermon to read its description, transcript and ordered Q&A, or use its media controls.' : 'Save a supported correction or record a finding decision in the existing form. If evidence is missing, leave it unresolved. Finishing a review is separate from publishing.'}</p><span>Publication state: <strong>${escape(row.publicationStatus)}</strong></span></div></div></details></li>`;
    }).join("")}</ol>` : '<section class="wb-empty"><h2>No sermons match</h2><p>Try another title, speaker or reason—or clear your filters.</p><button type="button" class="button" data-wb-empty-clear>Clear filters</button></section>';
    target.querySelector(".wb-pagination")!.innerHTML = `<button type="button" class="button" data-wb-prev${page === 1 ? " disabled" : ""}>Previous</button><span>Page ${page} of ${pages}</span><button type="button" class="button" data-wb-next${page === pages ? " disabled" : ""}>Next</button>`;
    const url = new URL(location.href); url.searchParams.set("view", view);
    query ? url.searchParams.set("q", query) : url.searchParams.delete("q");
    reason ? url.searchParams.set("reason", reason) : url.searchParams.delete("reason");
    history.replaceState({}, "", url);
  }
  target.querySelector<HTMLFormElement>(".wb-tools")!.addEventListener("submit", event => { event.preventDefault(); query = target.querySelector<HTMLInputElement>('[name="q"]')!.value.trim(); reason = target.querySelector<HTMLSelectElement>('[name="reason"]')!.value; page = 1; draw(); });
  target.querySelector('[name="reason"]')!.addEventListener("change", () => { reason = target.querySelector<HTMLSelectElement>('[name="reason"]')!.value; page = 1; draw(); });
  target.addEventListener("click", click);
  function click(event: Event) {
    const button = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!button || !target.contains(button)) return;
    if (button.hasAttribute("data-wb-refresh")) { location.reload(); return; }
    if (button.dataset.wbView) { view = button.dataset.wbView; reason = ""; target.querySelector<HTMLSelectElement>('[name="reason"]')!.value = ""; page = 1; draw(); }
    if (button.hasAttribute("data-wb-clear") || button.hasAttribute("data-wb-empty-clear")) { query = ""; reason = ""; target.querySelector<HTMLInputElement>('[name="q"]')!.value = ""; target.querySelector<HTMLSelectElement>('[name="reason"]')!.value = ""; page = 1; draw(); }
    if (button.hasAttribute("data-wb-prev") || button.hasAttribute("data-wb-next")) { page += button.hasAttribute("data-wb-next") ? 1 : -1; draw(); target.querySelector<HTMLElement>(".wb-views")!.scrollIntoView({ block: "start" }); target.querySelector<HTMLButtonElement>(button.hasAttribute("data-wb-next") ? "[data-wb-next]" : "[data-wb-prev]")?.focus({ preventScroll: true }); }
  }
  // The shared main survives SPA navigation. Replace—not accumulate—listeners.
  const priorCleanup = (target as HTMLElement & { workbenchCleanup?: () => void }).workbenchCleanup;
  priorCleanup?.();
  (target as HTMLElement & { workbenchCleanup?: () => void }).workbenchCleanup = () => target.removeEventListener("click", click);
  draw();
}
