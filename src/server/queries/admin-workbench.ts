import type { Pool } from "pg";
import { audioCohorts, audioRefreshedEligibilitySql, type AudioCohort } from "../../domain/sermonaudio-review";
import { restrictedEligibilitySql, d161RestrictedEligibilitySql, d162RestrictedEligibilitySql, d167RestrictedEligibilitySql } from "../../domain/restricted-acceptance";
import { concernLabel, summarizeWorkbench, type ReviewConcern, type WorkbenchSermon } from "../../domain/admin-workbench";
import {localWordingCompletionSql} from '../../domain/local-wording-completion';
import {correctiveCompletionSql} from '../../domain/local-corrective-review';
import {d175AcceptanceSql,d175SourceNamespace} from '../../domain/sermonaudio-completion';

const laterManifests = {
  d168: "87e2d08e592a089cd7bfe1fcc42c5e8399f1bbd78b83d49de8e2933c1b8df21a",
  d169: "0ce1014db9d2b25e27280d48d9e76d9f8c2d0d9999e56730df4d06bf558066c8"
} as const;

/** Uses the same version, dependency, withdrawal and media-refresh gates as the
 * restricted selectors. This function is never used by public routes. */
export function workbenchEligibilitySql(cohort: AudioCohort,alias='s'): string {
  if(!/^[a-z][a-z_]*$/u.test(alias))throw Error('sql_alias_refused');
  const existing = { d158: restrictedEligibilitySql, d161: d161RestrictedEligibilitySql,
    d162: d162RestrictedEligibilitySql, d167: d167RestrictedEligibilitySql };
  if (cohort in existing) return existing[cohort as keyof typeof existing](alias);
  const key = cohort as keyof typeof laterManifests;
  const c = audioCohorts[key];
  const sql = `((s.status='draft' AND s.published_at IS NULL AND s.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM ${c.table} a WHERE a.sermon_id=s.id AND a.decision='D-${key.slice(1)}'
    AND a.source_manifest_sha256='${laterManifests[key]}' AND a.environment='local_loopback'
    AND a.fingerprint_format='${key}-utc-jsonb-v1' AND a.accepted_row_version=s.row_version
    AND a.content_dependency_sha256=${c.dependency}(s.id)
    AND NOT EXISTS(SELECT 1 FROM ${c.withdrawals} w WHERE w.sermon_id=s.id)))
    OR ${audioRefreshedEligibilitySql("s", key)})`;
  return sql.replace(/\bs\./gu,alias+'.');
}

export async function readAdminWorkbench(pool: Pool) {
  const db = await pool.connect();
  try {
    // Dependency receipts use canonical UTC serialization. Keep this local to
    // the read-only snapshot; never change global settings or pooled defaults.
    await db.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await db.query("SET LOCAL TIME ZONE 'UTC'");
    const installed = (await db.query<{name:string}>("SELECT tablename AS name FROM pg_tables WHERE schemaname='public'")).rows.map(r => r.name);
    const cohorts = (Object.keys(audioCohorts) as AudioCohort[]).filter(key => installed.includes(audioCohorts[key].table));
    const accepted = cohorts.map(c=>workbenchEligibilitySql(c)).join(" OR ") || "false";
    const localComplete = installed.includes('sermon_extensions') ? `(${localWordingCompletionSql('s')} OR ${correctiveCompletionSql('s')} OR ${d175AcceptanceSql('s')})` : 'false';
    const prior = cohorts.map(key => `EXISTS(SELECT 1 FROM ${audioCohorts[key].table} a WHERE a.sermon_id=s.id)`).join(" OR ") || "false";
    const rows = (await db.query(`SELECT s.id,s.title,to_char(s.service_date,'YYYY-MM-DD') service_date,
      s.status,s.row_version,sp.name speaker,((${accepted}) OR ${localComplete}) complete,(${localComplete}) local_complete,(${prior}) previously_accepted,
      (SELECT payload->>'language' FROM sermon_extensions WHERE sermon_id=s.id AND namespace='${d175SourceNamespace}') language
      FROM sermons s LEFT JOIN speakers sp ON sp.id=s.speaker_id WHERE s.deleted_at IS NULL
      ORDER BY s.service_date DESC,s.id`)).rows;
    // Last recorded exceptions are evidence to inspect, not fresh AI judgments.
    // Never surface historical exceptions for a currently valid acceptance.
    const held = rows.filter(r => !r.complete).map(r => r.id);
    const concerns = new Map<string, ReviewConcern[]>();
    if (held.length && installed.includes("sermon_ai_component_reviews")) {
      const saved = (await db.query(`SELECT * FROM (SELECT DISTINCT ON(r.sermon_id,r.component)
        r.sermon_id,r.component,r.outcome,r.assessment->>'exceptionCode' code,
        r.assessment->>'informationNeeded' information_needed,r.scope_id,r.reviewed_at
        FROM sermon_ai_component_reviews r JOIN remaining_ai_review_members m ON m.scope_id=r.scope_id AND m.sermon_id=r.sermon_id
        WHERE r.sermon_id=ANY($1::uuid[]) AND r.component<>'completion'
        ORDER BY r.sermon_id,r.component,r.created_at DESC,r.id DESC) latest WHERE outcome='needs_human'`, [held])).rows;
      for (const r of saved) {
        const list = concerns.get(r.sermon_id) ?? [];
        list.push({ component: r.component, code: r.code ?? "evidence_required",
          label: concernLabel(r.component, r.code ?? ""), informationNeeded: r.information_needed ?? "Inspect the retained evidence and record your decision.",
          scope: r.scope_id, recordedAt: r.reviewed_at?.toISOString() ?? null });
        concerns.set(r.sermon_id, list);
      }
    }
    if (held.length && installed.includes("sermon_ai_content_reviews")) {
      const saved = (await db.query(`SELECT * FROM (SELECT DISTINCT ON(r.sermon_id,r.artifact_key)
        r.sermon_id,r.artifact_key,r.outcome,r.assessment->>'exceptionCode' code,
        r.assessment->>'informationNeeded' information_needed,r.scope_id,r.reviewed_at
        FROM sermon_ai_content_reviews r JOIN delegated_ai_review_members m ON m.scope_id=r.scope_id AND m.sermon_id=r.sermon_id
        WHERE r.sermon_id=ANY($1::uuid[]) ORDER BY r.sermon_id,r.artifact_key,r.created_at DESC,r.id DESC) latest
        WHERE outcome='needs_human'`, [held])).rows;
      for (const r of saved) {
        const component = r.artifact_key === "description" ? "description" : "questions";
        const list = concerns.get(r.sermon_id) ?? [];
        list.push({ component, code: r.code ?? "content_exception", label: concernLabel(component, r.code ?? ""),
          informationNeeded: r.information_needed ?? "A saved content exception needs your decision. Open the affected artifact and its evidence.",
          scope: r.scope_id, recordedAt: r.reviewed_at?.toISOString() ?? null });
        concerns.set(r.sermon_id, list);
      }
    }
    const data: WorkbenchSermon[] = rows.map(r => {
      const issues = concerns.get(r.id) ?? [];
      if (!r.complete && !r.speaker && !issues.some(i => i.component === "speaker")) issues.push({ component: "speaker", code: "missing_speaker", label: concernLabel("speaker", ""), informationNeeded: "Choose the correct speaker from explicit source evidence; do not infer the identity.", scope: null, recordedAt: null });
      if (!r.complete && !issues.length) {
        const component = r.previously_accepted ? "freshness" : "completion";
        issues.push({ component, code: component, label: concernLabel(component, ""), informationNeeded: r.previously_accepted
          ? "The saved acceptance no longer matches every current dependency, or has been withdrawn. Inspect the changed evidence; earlier decisions remain preserved."
          : "No current restricted acceptance is recorded. Inspect the existing review stages for the remaining requirements; this does not mean content must be regenerated.", scope: null, recordedAt: null });
      }
      return { id: r.id, title: r.title, serviceDate: r.service_date, speaker: r.speaker, publicationStatus: r.status,
        rowVersion: r.row_version, complete: r.complete, ...(r.local_complete ? {localCompletion:true} : {}), ...(r.language==='ar'?{language:'ar' as const}:{}), previouslyAccepted: r.previously_accepted, concerns: r.complete ? [] : issues };
    });
    await db.query("COMMIT");
    return summarizeWorkbench(data, new Date().toISOString());
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { db.release(); }
}
