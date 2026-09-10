import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { assessSermonTitle, sermonTitlePolicyVersion, type TitleEvidence, type TitleAssessment } from "../domain/sermon-title";
import { PostgresAdminSermonTransaction } from "../server/repositories/postgres-admin-sermon-repository";

export const titleCorrectionActor = "local-requested-title-correction";
export const titleCorrectionAction = "sermon.title_correction_requested_by_samuel";
export const titleHash = (value: string): string => createHash("sha256").update(value).digest("hex");
export interface TitlePlanRecord {
  id: string;
  rowVersion: number;
  originalTitle: string;
  sourceEvidence: TitleEvidence;
  assessment: TitleAssessment;
  original15: boolean;
  identityConfirmed: boolean;
  completedReview: boolean;
}
export interface TitlePlan {
  policy: typeof sermonTitlePolicyVersion;
  createdAt: string;
  records: TitlePlanRecord[];
}

/** Metadata only: never retrieves transcript, description or Q&A bodies. */
export async function createTitlePlan(client: PoolClient): Promise<TitlePlan> {
  const rows = await client.query<{
    id: string; row_version: number; title: string; processing_version: string | null;
    identity_status: string | null; completed: boolean; evidence: TitleEvidence;
  }>(`SELECT s.id,s.row_version,s.title,e.processing_version,r.identity_status,
      r.completed_at IS NOT NULL AS completed,
      jsonb_build_object(
        'passageTexts', COALESCE((SELECT jsonb_agg(x.display_text ORDER BY x.id)
          FROM scripture_references x WHERE x.sermon_id=s.id),'[]'::jsonb),
        'passages', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'canonicalBookId',x.canonical_book_id,'startChapter',x.start_chapter,
          'startVerse',x.start_verse,'endChapter',x.end_chapter,'endVerse',x.end_verse) ORDER BY x.id)
          FROM scripture_references x WHERE x.sermon_id=s.id AND x.canonical_book_id IS NOT NULL),'[]'::jsonb),
        'sourceTitles', COALESCE((SELECT jsonb_agg(left(m.title,length(m.title)-length(' — private evaluation source')) ORDER BY m.id)
          FROM sermon_media m WHERE m.sermon_id=s.id AND m.provider='youtube'
          AND right(m.title,length(' — private evaluation source'))=' — private evaluation source'
          AND e.retrieval_attribution='authorised_youtube_data_api'),'[]'::jsonb)
      ) AS evidence
    FROM sermons s LEFT JOIN sermon_enrichment_sources e ON e.sermon_id=s.id
    LEFT JOIN sermon_enrichment_reviews r ON r.sermon_id=s.id ORDER BY s.id`);
  return {
    policy: sermonTitlePolicyVersion, createdAt: new Date().toISOString(),
    records: rows.rows.map((row) => ({
      id: row.id, rowVersion: row.row_version, originalTitle: row.title,
      sourceEvidence: row.evidence, assessment: assessSermonTitle(row.title, row.evidence),
      original15: ["phase3b2-caption-v1", "phase3b2b-punctuation-v2", "phase3b2c-wave1-extractive-drafts-v2"].includes(row.processing_version ?? ""),
      identityConfirmed: row.identity_status === "confirmed", completedReview: row.completed
    }))
  };
}

export function summarizeTitlePlan(plan: TitlePlan) {
  const group = (records: TitlePlanRecord[]) => ({
    inspected: records.length,
    correctable: records.filter((r) => r.assessment.outcome === "correctable").length,
    clean: records.filter((r) => r.assessment.outcome === "clean").length,
    manualReview: records.filter((r) => r.assessment.outcome === "manual_review").length,
    identitiesToReopen: records.filter((r) => r.assessment.outcome === "correctable" && r.identityConfirmed).length
  });
  return { all: group(plan.records), original15: group(plan.records.filter((r) => r.original15)),
    later: group(plan.records.filter((r) => !r.original15)) };
}

/** Caller owns the guarded transaction; normal metadata-edit and audit primitives are reused. */
export async function applyTitlePlan(client: PoolClient, plan: TitlePlan, planSha256: string) {
  if (plan.policy !== sermonTitlePolicyVersion || !/^[a-f0-9]{64}$/.test(planSha256) ||
      new Set(plan.records.map((r) => r.id)).size !== plan.records.length) throw Error("title_plan_invalid");
  const transaction = new PostgresAdminSermonTransaction(client);
  let corrected = 0;
  let unchanged = 0;
  for (const record of plan.records) {
    if (record.assessment.outcome !== "correctable") continue;
    const assessment = assessSermonTitle(record.originalTitle, record.sourceEvidence);
    if (assessment.outcome !== "correctable" || assessment.title !== record.assessment.title) throw Error("title_plan_policy_drift");
    const result = await client.query<{ title: string; row_version: number }>(
      "SELECT title,row_version FROM sermons WHERE id=$1 FOR UPDATE", [record.id]);
    const current = result.rows[0];
    if (!current) throw Error("title_plan_missing_identity");
    if (current.title === assessment.title) {
      const audit = await client.query(`SELECT 1 FROM audit_events WHERE entity_id=$1
        AND action=$2 AND actor_role='system' AND request_correlation_id=$3`,
      [record.id, titleCorrectionAction, planSha256]);
      if (audit.rows.length !== 1) throw Error("title_plan_concurrent_edit");
      unchanged++;
      continue;
    }
    if (current.title !== record.originalTitle || current.row_version !== record.rowVersion) throw Error("title_plan_concurrent_edit");
    await transaction.updateSermon(record.id, { title: assessment.title, rowVersion: record.rowVersion }, titleCorrectionActor);
    await transaction.refreshSearchTerms(record.id);
    await transaction.reopenEnrichmentReview(record.id, true, titleCorrectionActor);
    await transaction.appendAudit({
      actorSubject: titleCorrectionActor, actorRole: "system", action: titleCorrectionAction,
      entityType: "sermon", entityId: record.id, outcome: "succeeded", changedFields: ["title"],
      requestCorrelationId: planSha256
    });
    corrected++;
  }
  return { corrected, unchanged };
}

/** Server-side hashes: no content bodies leave PostgreSQL during preservation checks. */
export async function preservationSnapshot(client: PoolClient, changedIds: string[]) {
  const tables = (await client.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`)).rows;
  const fingerprints: Record<string, string> = {};
  for (const { table_name: table } of tables) {
    if (!/^[a-z_]+$/.test(table)) throw Error("unexpected_table_identifier");
    let expression = "to_jsonb(t)";
    let where = "";
    let parameters: unknown[] = [];
    if (table === "sermons") {
      expression = "CASE WHEN id=ANY($1::uuid[]) THEN to_jsonb(t)-ARRAY['title','row_version','updated_at','updated_by_subject','search_vector','search_terms'] ELSE to_jsonb(t) END";
      parameters = [changedIds];
    } else if (table === "sermon_enrichment_reviews") {
      expression = "CASE WHEN sermon_id=ANY($1::uuid[]) THEN to_jsonb(t)-ARRAY['identity_status','current_stage','completed_by_subject','completed_at','updated_at','updated_by_subject','row_version'] ELSE to_jsonb(t) END";
      parameters = [changedIds];
    } else if (table === "audit_events") {
      where = "WHERE NOT (action=$1 AND actor_subject=$2)";
      parameters = [titleCorrectionAction, titleCorrectionActor];
    }
    const result = await client.query<{ hash: string }>(`SELECT encode(digest(COALESCE(
      string_agg(j::text,E'\\n' ORDER BY j::text),''),'sha256'),'hex') AS hash
      FROM (SELECT ${expression} AS j FROM "${table}" t ${where}) q`, parameters);
    fingerprints[table] = result.rows[0]!.hash;
  }
  return fingerprints;
}

export async function guardedTitleTransaction<T>(pool: Pool, write: boolean, work: (client: PoolClient) => Promise<T>) {
  if (write && process.env.ALLOW_LOCAL_DB_WRITE !== "1") throw Error("title_write_gate_required");
  const client = await pool.connect();
  try {
    await client.query(write ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const target = await client.query<{ ok: boolean }>(`SELECT current_database()='savinggrace_sermons_test'
      AND inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=5432
      AND current_setting('server_version_num')::int BETWEEN 160000 AND 169999 AS ok`);
    if (!target.rows[0]?.ok) throw Error("title_database_target_mismatch");
    if (write) await client.query("SET LOCAL savinggrace.application_request='on'");
    const result = await work(client);
    await client.query(write ? "COMMIT" : "ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
