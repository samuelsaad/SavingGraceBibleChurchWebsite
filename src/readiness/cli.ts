import { createPostgresPool } from "../server/database";
import { assertDisposableLocalDatabase } from "../migration/local-database-safety";
import {
  evaluateHistoricalLaunchReadiness,
  type HistoricalReadinessRecord
} from "./launch-readiness";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertDisposableLocalDatabase(connectionString);
  const pool = createPostgresPool(connectionString);
  try {
    const result = await pool.query<{
      source_wordpress_id: string;
      has_one_speaker: boolean;
      has_approved_description: boolean;
      has_approved_transcript: boolean;
      approved_question_count: number;
      total_question_count: number;
      all_questions_approved: boolean;
      has_valid_controlled_media: boolean;
    }>(
      `SELECT
         readiness.source_wordpress_id,
         readiness.has_one_speaker,
         readiness.has_approved_description,
         readiness.has_approved_transcript,
         readiness.approved_question_count,
         readiness.total_question_count,
         readiness.all_questions_approved,
         readiness.has_valid_controlled_media
       FROM sermon_content_readiness readiness
       WHERE readiness.source_wordpress_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM migration_records record
           WHERE record.target_id = readiness.sermon_id
             AND record.outcome = 'included'
             AND record.source_system = 'wordpress'
         )
       ORDER BY readiness.source_wordpress_id`
    );
    const records: HistoricalReadinessRecord[] = result.rows.map((row) => ({
      sourceWordPressId: Number(row.source_wordpress_id),
      hasOneSpeaker: row.has_one_speaker,
      hasApprovedDescription: row.has_approved_description,
      hasApprovedTranscript: row.has_approved_transcript,
      approvedQuestionCount: row.approved_question_count,
      totalQuestionCount: row.total_question_count,
      allQuestionsApproved: row.all_questions_approved,
      hasValidControlledMedia: row.has_valid_controlled_media
    }));
    const report = evaluateHistoricalLaunchReadiness(records, 453);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.passed) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown readiness error";
  process.stderr.write(`Launch readiness check failed: ${message}\n`);
  process.exitCode = 1;
});
