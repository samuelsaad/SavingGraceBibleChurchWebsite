import { resolve } from "node:path";
import type { Pool } from "pg";
import { ZodError, type ZodType } from "zod";
import { publicSermonListQuerySchema } from "../api/contracts/public-sermons";
import { PostgresSermonRepository } from "../server/repositories/postgres-sermon-repository";
import { enrichmentDraftBundleSchema, type EnrichmentDraftBundle } from "./contracts";
import {
  phase3b2PilotManifestSchema,
  type Phase3b2PilotManifest,
  type Phase3b2SafeOutcome
} from "./pilot-contracts";
import { canonicalYouTubeIdentity, prepareExistingCaptionText } from "./pilot-caption";
import {
  phase3b2PunctuationCompletionManifestSchema,
  punctuationPackSchema,
  type Phase3b2PunctuationCompletionManifest
} from "./pilot-punctuation-contracts";
import {
  PunctuationWorkflowError,
  assertSafeDirectory,
  ensureSafeDirectory,
  lexicalTokens,
  normalizePunctuationText,
  persistNoClobber,
  punctuationFailure,
  readSafeFile,
  resolveSafeDirectChild,
  sourceUncertaintyPassages,
  phase3b2PunctuationProcessingVersion,
  validatePunctuationPack,
  type PunctuationFailureCode,
  type ValidatedPunctuationResult
} from "./pilot-punctuation";
import {
  deterministicPilotUuid,
  ensurePrivatePilotSermon,
  existingOrWriteBundle,
  sourceReference,
  verifyPilotDatabase
} from "./phase3b2-pilot";
import { importEnrichmentDraftBundle } from "./postgres-enrichment";

const punctuationPilotActorSubject = "local-phase3b2b-punctuation-importer";

export interface TrustedPunctuationSource {
  recordKey: string;
  record: Phase3b2PilotManifest["records"][number];
  sourceText: string;
  preparation: Extract<ReturnType<typeof prepareExistingCaptionText>, { usable: false }>;
}

export type Phase3b2bSafeOutcome = Omit<Phase3b2SafeOutcome, "videoId"> & {
  recordKey: string;
};

export interface Phase3b2VerificationReport {
  authorisedRecordCount: 2;
  idempotentRerunCount: 2;
  exactSourceSystemAndIdentity: true;
  everySermonDraft: true;
  everyDescriptionDraft: true;
  everyTranscriptDraft: true;
  everyQuestionAnswerDraft: true;
  reviewerAndApproverFieldsAllNull: true;
  provenanceAndManualReviewComplete: true;
  publicSearchIsolated: true;
  publicRoutesIsolated: true;
  historicalReadinessIsolated: true;
  noUnexpectedCompletionRecords: true;
}

type Phase3b2PrivateBundle = Extract<EnrichmentDraftBundle, { schemaVersion: 3 }>;

function parseUnknown<T>(schema: ZodType<T>, input: unknown, detail: string): T {
  try {
    return schema.parse(input);
  } catch (error) {
    throw new PunctuationWorkflowError("schema_failure", detail, { cause: error });
  }
}

async function readJsonFile<T>(path: string, schema: ZodType<T>, label: string): Promise<T> {
  const bytes = await readSafeFile(path);
  let input: unknown;
  try {
    input = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new PunctuationWorkflowError("corrupt_json", `${label} is not valid JSON.`, { cause: error });
  }
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new PunctuationWorkflowError("schema_failure", `${label} failed schema validation.`, { cause: error });
    }
    throw error;
  }
}

function decodeUtf8(bytes: Buffer, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new PunctuationWorkflowError("corrupt_json", `${label} is not valid UTF-8.`, { cause: error });
  }
}

export async function loadTrustedPunctuationSources(
  pilotRootInput: string,
  manifestInput: unknown
): Promise<{ pilotRoot: string; manifest: Phase3b2PilotManifest; sources: TrustedPunctuationSource[] }> {
  const manifest = parseUnknown(
    phase3b2PilotManifestSchema,
    manifestInput,
    "The base Phase 3B.2 manifest failed schema validation."
  );
  const pilotRoot = resolve(pilotRootInput);
  await assertSafeDirectory(pilotRoot);
  const manualSources: TrustedPunctuationSource[] = [];
  for (const [index, record] of manifest.records.entries()) {
    let identity;
    try {
      identity = canonicalYouTubeIdentity(record.videoUrl, manifest.allowlistedVideoIds);
    } catch (error) {
      throw new PunctuationWorkflowError(
        "unauthorised_record",
        "A base pilot URL does not resolve to an authorised canonical video identity.",
        { cause: error }
      );
    }
    if (identity.videoId !== record.videoId) {
      throw new PunctuationWorkflowError(
        "unauthorised_record",
        "A base pilot record does not match its canonical video identity."
      );
    }
    const captionPath = resolveSafeDirectChild(pilotRoot, record.captionFilename, "file", ".txt");
    const sourceText = normalizePunctuationText(
      decodeUtf8(await readSafeFile(captionPath), "A mapped caption input")
    );
    const preparation = prepareExistingCaptionText(sourceText);
    if (!preparation.usable && preparation.failure.code === "manual_punctuation_required") {
      manualSources.push({
        recordKey: `authorised-record-${index + 1}`,
        record,
        sourceText,
        preparation
      });
    }
  }
  if (manualSources.length !== 2) {
    throw new PunctuationWorkflowError(
      "unauthorised_record",
      "Trusted Phase 3B.2 source state does not identify exactly two manual-punctuation records."
    );
  }
  return { pilotRoot, manifest, sources: manualSources };
}

export function assertExactCompletionScope(
  completion: Phase3b2PunctuationCompletionManifest,
  manifest: Phase3b2PilotManifest,
  trustedSources: readonly TrustedPunctuationSource[]
): void {
  if (completion.sourceSnapshotId !== manifest.sourceSnapshotId) {
    throw new PunctuationWorkflowError(
      "unauthorised_record",
      "The completion source snapshot does not match trusted Phase 3B.2 state."
    );
  }
  const expected = trustedSources.map((source) => source.record.videoId).sort();
  const actual = completion.records.map((record) => record.videoId).sort();
  if (expected.length !== 2 || actual.length !== 2 || expected.some((id, index) => id !== actual[index])) {
    throw new PunctuationWorkflowError(
      "unauthorised_record",
      "The completion must exactly match the two trusted manual-punctuation records."
    );
  }
}

export function validateSupportingParagraphs(
  record: Phase3b2PunctuationCompletionManifest["records"][number],
  paragraphCount: number
): void {
  const allReferences = [
    record.descriptionSupportingParagraphs,
    ...record.questionAnswers.map((item) => item.supportingParagraphs),
    ...record.possibleCaptionErrors.map((item) => item.supportingParagraphs),
    ...record.apparentNamesAndScriptureReferences.map((item) => item.supportingParagraphs)
  ];
  if (allReferences.some((references) => references.some(
    (paragraph) => paragraph < 1 || paragraph > paragraphCount
  ))) {
    throw new PunctuationWorkflowError(
      "supporting_reference_failure",
      "A supporting paragraph reference is outside the punctuated transcript."
    );
  }
}

async function validateRecord(
  pilotRoot: string,
  trusted: TrustedPunctuationSource,
  record: Phase3b2PunctuationCompletionManifest["records"][number]
): Promise<{ validated: ValidatedPunctuationResult; packPath: string }> {
  const packPath = resolveSafeDirectChild(
    pilotRoot,
    record.punctuationPackFilename,
    "file",
    ".private.json"
  );
  const pack = await readJsonFile(packPath, punctuationPackSchema, "The punctuation pack");
  const validated = validatePunctuationPack(record.videoId, trusted.sourceText, pack);
  validateSupportingParagraphs(record, validated.metrics.paragraphCount);
  return { validated, packPath };
}

function recordOutcome(
  trusted: TrustedPunctuationSource,
  overrides: Partial<Phase3b2bSafeOutcome>
): Phase3b2bSafeOutcome {
  return {
    recordKey: trusted.recordKey,
    captionSupplied: true,
    captionLanguage: trusted.record.captionLanguage,
    captionTrackType: trusted.record.captionTrackType,
    sourceCharacterCount: trusted.preparation.metrics.sourceCharacterCount,
    cleanedCharacterCount: null,
    apparentCompleteness: "unusable",
    uncertaintyMarkerCount: trusted.preparation.metrics.uncertaintyMarkerCount,
    warningCodes: trusted.preparation.warnings.map((warning) => warning.code),
    descriptionDraftProduced: false,
    questionAnswerCount: 0,
    importedOutcome: "not_imported",
    manualAttentionRequired: true,
    processingDurationMs: 0,
    estimatedAdministratorReviewMinutes: Math.max(
      60,
      Math.ceil(trusted.preparation.metrics.sourceWordCount / 90)
    ),
    failure: null,
    ...overrides
  };
}

function failureOutcome(
  trusted: TrustedPunctuationSource,
  failure: PunctuationWorkflowError,
  started: number
): Phase3b2bSafeOutcome {
  return recordOutcome(trusted, {
    warningCodes: [
      ...trusted.preparation.warnings.map((warning) => warning.code),
      failure.code
    ],
    processingDurationMs: Math.max(0, Math.round(performance.now() - started)),
    failure: { code: failure.code, safeDetail: failure.safeDetail }
  });
}

function notAttemptedOutcome(trusted: TrustedPunctuationSource): Phase3b2bSafeOutcome {
  return recordOutcome(trusted, {
    warningCodes: [
      ...trusted.preparation.warnings.map((warning) => warning.code),
      "not_attempted_prior_failure"
    ],
    failure: {
      code: "not_attempted_prior_failure",
      safeDetail: "This authorised record was not attempted because a prior record failed."
    }
  });
}

function warningsFor(
  trusted: TrustedPunctuationSource,
  record: Phase3b2PunctuationCompletionManifest["records"][number]
): Array<{ code: string; safeDetail: string }> {
  return [
    ...trusted.preparation.warnings,
    ...(trusted.preparation.metrics.uncertaintyMarkerCount > 0
      ? [{
          code: "source_uncertainties_retained",
          safeDetail: "Explicit source uncertainty markers remain for administrator review."
        }]
      : []),
    {
      code: "codex_punctuation_applied",
      safeDetail: "Transcript text received punctuation, capitalisation and paragraph boundaries inside the authorised Codex session."
    },
    ...(record.possibleCaptionErrors.length > 0
      ? [{
          code: "possible_caption_errors_require_review",
          safeDetail: "Possible caption errors remain in the private administrator report."
        }]
      : []),
    ...(record.apparentNamesAndScriptureReferences.length > 0
      ? [{
          code: "names_and_scripture_references_require_verification",
          safeDetail: "Apparent name or Scripture-reference items require administrator verification."
        }]
      : []),
    ...(trusted.record.captionTrackType === "unknown"
      ? [{
          code: "caption_track_type_unresolved",
          safeDetail: "The plain-text export does not identify whether the caption track was manual or automatic."
        }]
      : []),
    {
      code: "service_date_placeholder",
      safeDetail: "The private pilot record uses a local placeholder service date pending administrator verification."
    }
  ];
}

function buildCandidate(
  trusted: TrustedPunctuationSource,
  record: Phase3b2PunctuationCompletionManifest["records"][number],
  validated: ValidatedPunctuationResult,
  target: { id: string; rowVersion: number },
  warnings: Array<{ code: string; safeDetail: string }>,
  elapsed: number
): EnrichmentDraftBundle {
  const now = new Date().toISOString();
  const unresolvedPassages = sourceUncertaintyPassages(trusted.sourceText);
  const canonicalUrl = `https://www.youtube.com/watch?v=${trusted.record.videoId}`;
  const reference = sourceReference(
    trusted.record.videoId,
    validated.metrics.sourceContentSha256,
    phase3b2PunctuationProcessingVersion
  );
  return enrichmentDraftBundleSchema.parse({
    schemaVersion: 3,
    sourceWordPressId: trusted.record.sourceWordPressId,
    targetSermonId: target.id,
    expectedRowVersion: target.rowVersion,
    description: {
      bodyText: record.descriptionDraft,
      provenance: { sourceKind: "generated_draft", sourceReference: reference }
    },
    transcript: {
      bodyText: validated.cleanedText,
      provenance: { sourceKind: "caption", sourceReference: reference }
    },
    questionAnswers: record.questionAnswers.map((item) => ({
      question: item.question,
      answer: item.answer,
      provenance: { sourceKind: "generated_draft", sourceReference: reference }
    })),
    sourceProvenance: {
      provider: "youtube",
      videoId: trusted.record.videoId,
      canonicalUrl,
      captionLanguage: trusted.record.captionLanguage,
      captionTrackType: trusted.record.captionTrackType,
      originalFilename: trusted.record.captionFilename,
      sourceContentSha256: validated.metrics.sourceContentSha256,
      retrievalAttribution: "authorised_youtube_studio_export",
      sourceCharacterCount: trusted.preparation.metrics.sourceCharacterCount,
      cleanedCharacterCount: validated.cleanedText.length,
      apparentCompleteness: "requires_manual_review",
      uncertaintyMarkerCount: trusted.preparation.metrics.uncertaintyMarkerCount,
      warnings,
      unresolvedPassages,
      processingVersion: phase3b2PunctuationProcessingVersion,
      importedAt: now,
      processedAt: now,
      processingDurationMs: elapsed,
      estimatedReviewMinutes: Math.max(60, Math.ceil(validated.metrics.sourceTokenCount / 90) + 25),
      manualAttentionRequired: true,
      accuracyReviewStatus: "required"
    }
  });
}

async function persistValidationReport(
  preparedRoot: string,
  trusted: TrustedPunctuationSource,
  record: Phase3b2PunctuationCompletionManifest["records"][number],
  validated: ValidatedPunctuationResult,
  packPath: string
): Promise<void> {
  const pack = await readJsonFile(packPath, punctuationPackSchema, "The punctuation pack");
  const report = {
    schemaVersion: 2,
    processingVersion: phase3b2PunctuationProcessingVersion,
    recordKey: trusted.recordKey,
    tokenSequenceComparison: {
      unicodeNormalization: "NFC",
      tokenPolicy: "whitespace-delimited non-punctuation content, Unicode default case folding",
      sourceSha256: validated.metrics.sourceTokenSequenceSha256,
      cleanedSha256: validated.metrics.cleanedTokenSequenceSha256,
      match: validated.metrics.tokenSequencesMatch
    },
    preservation: {
      zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens:
        validated.metrics.zeroAddedRemovedSubstitutedDuplicatedOrReorderedTokens,
      whitespaceBoundariesPreserved: validated.metrics.whitespaceBoundariesPreserved,
      sourceSegmentsCompleteAndUnique: validated.metrics.sourceSegmentsCompleteAndUnique,
      chunkReassemblyComplete: validated.metrics.chunkReassemblyComplete,
      sourceTokenCount: validated.metrics.sourceTokenCount,
      cleanedTokenCount: validated.metrics.cleanedTokenCount
    },
    chunks: pack.chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      index: chunk.index,
      tokenStart: chunk.tokenStart,
      tokenEndExclusive: chunk.tokenEndExclusive,
      sourceStart: chunk.sourceStart,
      sourceEnd: chunk.sourceEnd,
      sourceSha256: chunk.sourceSha256,
      cleanedOutputSha256: chunk.cleanedOutputSha256
    })),
    possibleCaptionErrors: record.possibleCaptionErrors,
    apparentNamesAndScriptureReferences: record.apparentNamesAndScriptureReferences,
    descriptionSupportingParagraphs: record.descriptionSupportingParagraphs,
    questionAnswerSupportingParagraphs: record.questionAnswers.map((item, index) => ({
      displayOrder: index + 1,
      supportingParagraphs: item.supportingParagraphs
    })),
    accuracyStatement: "No transcription, Scripture or theological accuracy is claimed. Administrator comparison and explicit approval remain required."
  };
  await persistNoClobber(
    resolveSafeDirectChild(
      preparedRoot,
      `${trusted.record.videoId}.phase3b2b-v2.review.private.json`,
      "file",
      ".private.json"
    ),
    `${JSON.stringify(report, null, 2)}\n`
  );
}

async function persistOutcomeAggregate(
  preparedRoot: string,
  outcomes: readonly Phase3b2bSafeOutcome[]
): Promise<void> {
  const stableOutcomes = outcomes.map(({ processingDurationMs: _processingDurationMs, ...outcome }) => outcome);
  const outcomeClass = outcomes.map((outcome) =>
    outcome.failure?.code ?? outcome.importedOutcome
  ).join("-");
  const content = `${JSON.stringify({ schemaVersion: 2, outcomes: stableOutcomes }, null, 2)}\n`;
  await persistNoClobber(
    resolveSafeDirectChild(
      preparedRoot,
      `safe-outcomes-phase3b2b-${outcomeClass}.private.json`,
      "file",
      ".private.json"
    ),
    content
  );
}

export async function runPhase3b2PunctuationCompletion(
  pool: Pool,
  pilotRootInput: string,
  baseManifestInput: unknown,
  completionManifestInput: unknown
): Promise<Phase3b2bSafeOutcome[]> {
  const trusted = await loadTrustedPunctuationSources(pilotRootInput, baseManifestInput);
  const completion = parseUnknown(
    phase3b2PunctuationCompletionManifestSchema,
    completionManifestInput,
    "The Phase 3B.2b completion manifest failed schema validation."
  );
  assertExactCompletionScope(completion, trusted.manifest, trusted.sources);
  const preparedRoot = resolveSafeDirectChild(trusted.pilotRoot, "prepared-private", "directory");
  await ensureSafeDirectory(preparedRoot);
  const outcomes: Phase3b2bSafeOutcome[] = [];

  for (const [index, trustedSource] of trusted.sources.entries()) {
    const started = performance.now();
    const record = completion.records.find((candidate) => candidate.videoId === trustedSource.record.videoId)!;
    let validated: ValidatedPunctuationResult;
    let packPath: string;
    try {
      ({ validated, packPath } = await validateRecord(trusted.pilotRoot, trustedSource, record));
      await persistValidationReport(preparedRoot, trustedSource, record, validated, packPath);
      const canonicalUrl = `https://www.youtube.com/watch?v=${trustedSource.record.videoId}`;
      let target: { id: string; rowVersion: number };
      try {
        target = await ensurePrivatePilotSermon(
          pool,
          trusted.manifest,
          trustedSource.record,
          validated.metrics.sourceContentSha256,
          canonicalUrl
        );
      } catch (error) {
        throw punctuationFailure(
          error,
          "database_verification_failure",
          "The trusted private pilot target could not be verified or prepared safely."
        );
      }
      const elapsed = Math.max(0, Math.round(performance.now() - started));
      const warnings = warningsFor(trustedSource, record);
      const candidate = buildCandidate(
        trustedSource,
        record,
        validated,
        target,
        warnings,
        elapsed
      );
      const bundlePath = resolveSafeDirectChild(
        preparedRoot,
        `${trustedSource.record.videoId}.phase3b2b-v2.private.json`,
        "file",
        ".private.json"
      );
      const bundle = await existingOrWriteBundle(bundlePath, candidate);
      let imported: Awaited<ReturnType<typeof importEnrichmentDraftBundle>>;
      try {
        imported = await importEnrichmentDraftBundle(pool, bundle, punctuationPilotActorSubject);
      } catch (error) {
        throw punctuationFailure(
          error,
          "database_verification_failure",
          "The validated private draft bundle could not be imported safely."
        );
      }
      outcomes.push(recordOutcome(trustedSource, {
        cleanedCharacterCount: validated.cleanedText.length,
        apparentCompleteness: "requires_manual_review",
        warningCodes: warnings.map((warning) => warning.code),
        descriptionDraftProduced: true,
        questionAnswerCount: record.questionAnswers.length,
        importedOutcome: imported.outcome,
        processingDurationMs: bundle.schemaVersion === 3
          ? bundle.sourceProvenance.processingDurationMs
          : elapsed,
        estimatedAdministratorReviewMinutes: bundle.schemaVersion === 3
          ? bundle.sourceProvenance.estimatedReviewMinutes
          : Math.max(60, Math.ceil(validated.metrics.sourceTokenCount / 90) + 25),
        failure: null
      }));
    } catch (error) {
      const failure = punctuationFailure(
        error,
        "unexpected_failure",
        "The punctuation record stopped safely because an unexpected technical failure occurred."
      );
      outcomes.push(failureOutcome(trustedSource, failure, started));
      for (const remaining of trusted.sources.slice(index + 1)) {
        outcomes.push(notAttemptedOutcome(remaining));
      }
      break;
    }
  }

  await persistOutcomeAggregate(preparedRoot, outcomes);
  return outcomes;
}

function assertVerification(value: boolean, detail: string): asserts value {
  if (!value) {
    throw new PunctuationWorkflowError("database_verification_failure", detail);
  }
}

export async function verifyPhase3b2PunctuationCompletion(
  pool: Pool,
  pilotRootInput: string,
  baseManifestInput: unknown,
  completionManifestInput: unknown
): Promise<Phase3b2VerificationReport> {
  const trusted = await loadTrustedPunctuationSources(pilotRootInput, baseManifestInput);
  const completion = parseUnknown(
    phase3b2PunctuationCompletionManifestSchema,
    completionManifestInput,
    "The Phase 3B.2b completion manifest failed schema validation."
  );
  assertExactCompletionScope(completion, trusted.manifest, trusted.sources);
  const preparedRoot = resolveSafeDirectChild(trusted.pilotRoot, "prepared-private", "directory");
  await assertSafeDirectory(preparedRoot);

  const rerunOutcomes: string[] = [];
  const verifiedBundles: Phase3b2PrivateBundle[] = [];
  for (const trustedSource of trusted.sources) {
    const record = completion.records.find((candidate) => candidate.videoId === trustedSource.record.videoId)!;
    await validateRecord(trusted.pilotRoot, trustedSource, record);
    const bundlePath = resolveSafeDirectChild(
      preparedRoot,
      `${trustedSource.record.videoId}.phase3b2b-v2.private.json`,
      "file",
      ".private.json"
    );
    const bundle = await readJsonFile(bundlePath, enrichmentDraftBundleSchema, "The private draft bundle");
    assertVerification(bundle.schemaVersion === 3, "A private draft bundle has the wrong schema version.");
    assertVerification(
      bundle.sourceProvenance.processingVersion === phase3b2PunctuationProcessingVersion &&
      bundle.sourceProvenance.videoId === trustedSource.record.videoId &&
      bundle.sourceWordPressId === trustedSource.record.sourceWordPressId &&
      bundle.targetSermonId === deterministicPilotUuid(trustedSource.record.videoId),
      "A private draft bundle does not match the trusted completion identity."
    );
    const rerun = await importEnrichmentDraftBundle(pool, bundle, punctuationPilotActorSubject);
    rerunOutcomes.push(rerun.outcome);
    verifiedBundles.push(bundle);
  }
  assertVerification(
    rerunOutcomes.length === 2 && rerunOutcomes.every((outcome) => outcome === "unchanged"),
    "The idempotent draft-import rerun did not return unchanged for exactly two records."
  );

  const client = await pool.connect();
  try {
    await verifyPilotDatabase(client);
  } finally {
    client.release();
  }
  const sourceIds = trusted.sources.map((source) => source.record.sourceWordPressId);
  const aggregate = await pool.query<{
    pilot_records: number;
    exact_source_records: number;
    migration_records: number;
    draft_sermons: number;
    draft_descriptions: number;
    draft_transcripts: number;
    draft_questions: number;
    non_draft_questions: number;
    review_approval_values: number;
    provenance_records: number;
    manual_review_records: number;
    completion_version_records: number;
    unexpected_completion_records: number;
    public_search_document_length: number;
    published_pilot_records: number;
    complete_readiness_records: number;
    pilot_rows_in_wordpress_scope: number;
  }>(
    `SELECT
       (SELECT count(*)::integer FROM sermons WHERE source_wordpress_id = ANY($1::bigint[])) AS pilot_records,
       (SELECT count(*)::integer FROM sermons
         WHERE source_wordpress_id = ANY($1::bigint[]) AND source_status = 'phase3b2_pilot') AS exact_source_records,
       (SELECT count(*)::integer FROM migration_records
         WHERE source_system = 'phase3b2_pilot' AND source_entity_type = 'private_caption'
           AND source_id = ANY($2::text[])) AS migration_records,
       (SELECT count(*)::integer FROM sermons
         WHERE source_wordpress_id = ANY($1::bigint[]) AND status = 'draft') AS draft_sermons,
       (SELECT count(*)::integer FROM sermons
         WHERE source_wordpress_id = ANY($1::bigint[]) AND summary_status = 'draft') AS draft_descriptions,
       (SELECT count(*)::integer FROM sermon_transcripts transcript JOIN sermons s ON s.id = transcript.sermon_id
         WHERE s.source_wordpress_id = ANY($1::bigint[]) AND transcript.status = 'draft') AS draft_transcripts,
       (SELECT count(*)::integer FROM sermon_question_answers qa JOIN sermons s ON s.id = qa.sermon_id
         WHERE s.source_wordpress_id = ANY($1::bigint[]) AND qa.status = 'draft') AS draft_questions,
       (SELECT count(*)::integer FROM sermon_question_answers qa JOIN sermons s ON s.id = qa.sermon_id
         WHERE s.source_wordpress_id = ANY($1::bigint[]) AND qa.status <> 'draft') AS non_draft_questions,
       (SELECT count(*)::integer FROM sermons s
         LEFT JOIN sermon_transcripts transcript ON transcript.sermon_id = s.id
         LEFT JOIN sermon_question_answers qa ON qa.sermon_id = s.id
         WHERE s.source_wordpress_id = ANY($1::bigint[]) AND (
           s.summary_reviewed_by_subject IS NOT NULL OR s.summary_approved_by_subject IS NOT NULL
           OR s.summary_reviewed_at IS NOT NULL OR s.summary_approved_at IS NOT NULL
           OR transcript.reviewed_by_subject IS NOT NULL OR transcript.approved_by_subject IS NOT NULL
           OR transcript.reviewed_at IS NOT NULL OR transcript.approved_at IS NOT NULL
           OR qa.reviewed_by_subject IS NOT NULL OR qa.approved_by_subject IS NOT NULL
           OR qa.reviewed_at IS NOT NULL OR qa.approved_at IS NOT NULL
         )) AS review_approval_values,
       (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN sermons s ON s.id = source.sermon_id
         WHERE s.source_wordpress_id = ANY($1::bigint[])) AS provenance_records,
       (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN sermons s ON s.id = source.sermon_id
         WHERE s.source_wordpress_id = ANY($1::bigint[])
           AND source.manual_attention_required AND source.accuracy_review_status = 'required') AS manual_review_records,
       (SELECT count(*)::integer FROM sermon_enrichment_sources
         WHERE processing_version = $3) AS completion_version_records,
       (SELECT count(*)::integer FROM sermon_enrichment_sources source JOIN sermons s ON s.id = source.sermon_id
         WHERE source.processing_version = $3 AND NOT (s.source_wordpress_id = ANY($1::bigint[]))) AS unexpected_completion_records,
       (SELECT coalesce(sum(char_length(s.summary_search_document)
         + char_length(s.transcript_search_document)
         + char_length(s.question_answer_search_document)), 0)::integer
         FROM sermons s WHERE s.source_wordpress_id = ANY($1::bigint[])) AS public_search_document_length,
       (SELECT count(*)::integer FROM sermons
         WHERE source_wordpress_id = ANY($1::bigint[]) AND status = 'published') AS published_pilot_records,
       (SELECT count(*)::integer FROM sermon_content_readiness readiness JOIN sermons s ON s.id = readiness.sermon_id
         WHERE s.source_wordpress_id = ANY($1::bigint[]) AND readiness.is_complete) AS complete_readiness_records,
       (SELECT count(*)::integer FROM migration_records record JOIN sermons s ON s.id = record.target_id
         WHERE s.source_wordpress_id = ANY($1::bigint[]) AND record.source_system = 'wordpress') AS pilot_rows_in_wordpress_scope`,
    [sourceIds, sourceIds.map(String), phase3b2PunctuationProcessingVersion]
  );
  const row = aggregate.rows[0]!;
  const expectedQuestions = completion.records.reduce((count, record) => count + record.questionAnswers.length, 0);
  assertVerification(row.pilot_records === 2 && row.exact_source_records === 2 && row.migration_records === 2,
    "The database does not contain exactly two trusted Phase 3B.2b source records.");
  assertVerification(row.draft_sermons === 2 && row.draft_descriptions === 2 && row.draft_transcripts === 2,
    "Every Phase 3B.2b sermon, description and transcript must remain draft.");
  assertVerification(row.draft_questions === expectedQuestions && row.non_draft_questions === 0,
    "Every expected Phase 3B.2b question and answer must remain draft with no extras.");
  assertVerification(row.review_approval_values === 0,
    "Review or approval metadata was unexpectedly present on Phase 3B.2b content.");
  assertVerification(
    row.provenance_records === 2 && row.manual_review_records === 2 && row.completion_version_records === 2,
    "Phase 3B.2b provenance or mandatory manual-review evidence is incomplete."
  );
  assertVerification(row.unexpected_completion_records === 0,
    "Unexpected additional records use the Phase 3B.2b processing version.");
  assertVerification(
    row.public_search_document_length === 0 && row.published_pilot_records === 0,
    "Phase 3B.2b content is unexpectedly public or searchable."
  );
  assertVerification(row.complete_readiness_records === 0 && row.pilot_rows_in_wordpress_scope === 0,
    "Phase 3B.2b content is unexpectedly included in historical readiness.");

  for (const bundle of verifiedBundles) {
    const trustedSource = trusted.sources.find(
      (source) => source.record.sourceWordPressId === bundle.sourceWordPressId
    )!;
    const stored = await pool.query<{
      id: string;
      title: string;
      slug: string;
      service_date: string;
      source_wordpress_id: string;
      source_status: string;
      status: string;
      summary: string | null;
      summary_source_kind: string | null;
      summary_source_reference: string | null;
      transcript_body: string;
      transcript_source_kind: string;
      transcript_source_reference: string | null;
      provider: string;
      video_id: string;
      canonical_url: string;
      caption_language: string;
      caption_track_type: string;
      original_filename: string;
      source_content_sha256: string;
      retrieval_attribution: string;
      source_character_count: number;
      cleaned_character_count: number;
      apparent_completeness: string;
      uncertainty_marker_count: number;
      warnings: unknown;
      unresolved_passages: unknown;
      processing_version: string;
      imported_at: Date;
      processed_at: Date;
      processing_duration_ms: number;
      estimated_review_minutes: number;
      manual_attention_required: boolean;
      accuracy_review_status: string;
      matching_media: number;
      matching_migration_receipts: number;
    }>(
      `SELECT
         s.id, s.title, s.slug, s.service_date::text, s.source_wordpress_id,
         s.source_status, s.status, s.summary, s.summary_source_kind,
         s.summary_source_reference, transcript.body_text AS transcript_body,
         transcript.source_kind AS transcript_source_kind,
         transcript.source_reference AS transcript_source_reference,
         source.provider, source.video_id, source.canonical_url,
         source.caption_language, source.caption_track_type, source.original_filename,
         source.source_content_sha256, source.retrieval_attribution,
         source.source_character_count, source.cleaned_character_count,
         source.apparent_completeness, source.uncertainty_marker_count,
         source.warnings, source.unresolved_passages, source.processing_version,
         source.imported_at, source.processed_at, source.processing_duration_ms,
         source.estimated_review_minutes, source.manual_attention_required,
         source.accuracy_review_status,
         (SELECT count(*)::integer FROM sermon_media media
          WHERE media.sermon_id = s.id AND media.provider = 'youtube'
            AND media.external_id = $2 AND media.canonical_url = $3) AS matching_media,
         (SELECT count(*)::integer FROM migration_records receipt
          WHERE receipt.target_id = s.id AND receipt.source_system = 'phase3b2_pilot'
            AND receipt.source_entity_type = 'private_caption'
            AND receipt.source_id = $4 AND receipt.source_status = 'draft'
            AND receipt.source_url = $3 AND receipt.source_checksum_sha256 = $5
            AND receipt.target_entity_type = 'sermon' AND receipt.outcome = 'included'
            AND receipt.reason_code = 'authorised_private_pilot') AS matching_migration_receipts
       FROM sermons s
       JOIN sermon_transcripts transcript ON transcript.sermon_id = s.id
       JOIN sermon_enrichment_sources source ON source.sermon_id = s.id
       WHERE s.id = $1`,
      [
        bundle.targetSermonId,
        trustedSource.record.videoId,
        bundle.sourceProvenance.canonicalUrl,
        String(bundle.sourceWordPressId),
        bundle.sourceProvenance.sourceContentSha256
      ]
    );
    const actual = stored.rows[0];
    const provenance = bundle.sourceProvenance;
    assertVerification(actual !== undefined, "A trusted Phase 3B.2b database record is missing.");
    assertVerification(
      actual.id === deterministicPilotUuid(trustedSource.record.videoId) &&
      actual.title === trustedSource.record.title &&
      actual.slug === trustedSource.record.slug &&
      actual.service_date === trustedSource.record.serviceDate &&
      Number(actual.source_wordpress_id) === bundle.sourceWordPressId &&
      actual.source_status === "phase3b2_pilot" && actual.status === "draft" &&
      actual.matching_media === 1 && actual.matching_migration_receipts === 1,
      "A Phase 3B.2b sermon, media row or migration receipt does not match trusted identity."
    );
    assertVerification(
      actual.summary === bundle.description.bodyText &&
      actual.summary_source_kind === bundle.description.provenance.sourceKind &&
      actual.summary_source_reference === bundle.description.provenance.sourceReference &&
      actual.transcript_body === bundle.transcript.bodyText &&
      actual.transcript_source_kind === bundle.transcript.provenance.sourceKind &&
      actual.transcript_source_reference === bundle.transcript.provenance.sourceReference,
      "Stored Phase 3B.2b description or transcript content differs from its validated bundle."
    );
    assertVerification(
      actual.provider === provenance.provider &&
      actual.video_id === provenance.videoId &&
      actual.canonical_url === provenance.canonicalUrl &&
      actual.caption_language === provenance.captionLanguage &&
      actual.caption_track_type === provenance.captionTrackType &&
      actual.original_filename === provenance.originalFilename &&
      actual.source_content_sha256 === provenance.sourceContentSha256 &&
      actual.retrieval_attribution === provenance.retrievalAttribution &&
      actual.source_character_count === provenance.sourceCharacterCount &&
      actual.cleaned_character_count === provenance.cleanedCharacterCount &&
      actual.apparent_completeness === provenance.apparentCompleteness &&
      actual.uncertainty_marker_count === provenance.uncertaintyMarkerCount &&
      JSON.stringify(actual.warnings) === JSON.stringify(provenance.warnings) &&
      JSON.stringify(actual.unresolved_passages) === JSON.stringify(provenance.unresolvedPassages) &&
      actual.processing_version === provenance.processingVersion &&
      actual.imported_at.toISOString() === provenance.importedAt &&
      actual.processed_at.toISOString() === provenance.processedAt &&
      actual.processing_duration_ms === provenance.processingDurationMs &&
      actual.estimated_review_minutes === provenance.estimatedReviewMinutes &&
      actual.manual_attention_required === true &&
      actual.accuracy_review_status === "required",
      "Stored Phase 3B.2b provenance or uncertainty differs from the validated private bundle."
    );

    const storedQuestions = await pool.query<{
      question_text: string;
      answer_text: string;
      display_order: number;
      source_kind: string;
      source_reference: string | null;
    }>(
      `SELECT question_text, answer_text, display_order, source_kind, source_reference
       FROM sermon_question_answers WHERE sermon_id = $1 ORDER BY display_order`,
      [bundle.targetSermonId]
    );
    assertVerification(
      storedQuestions.rows.length === bundle.questionAnswers.length &&
      storedQuestions.rows.every((question, index) => {
        const expected = bundle.questionAnswers[index];
        if (!expected) return false;
        return question.display_order === index + 1 &&
          question.question_text === expected.question && question.answer_text === expected.answer &&
          question.source_kind === expected.provenance.sourceKind &&
          question.source_reference === expected.provenance.sourceReference;
      }),
      "Stored Phase 3B.2b question-and-answer drafts differ from the validated private bundle."
    );
  }

  const publicRepository = new PostgresSermonRepository(pool);
  const publicDetails = await Promise.all(trusted.sources.map((source) =>
    publicRepository.findPublishedBySlug(source.record.slug)
  ));
  const publishedList = await publicRepository.listPublished(
    publicSermonListQuerySchema.parse({ page: 1, pageSize: 50 })
  );
  const pilotIds = new Set(trusted.sources.map((source) => deterministicPilotUuid(source.record.videoId)));
  assertVerification(
    publicDetails.every((detail) => detail === null) &&
      publishedList.data.every((item) => !pilotIds.has(item.id)),
    "A Phase 3B.2b record is visible through a public repository route."
  );

  return {
    authorisedRecordCount: 2,
    idempotentRerunCount: 2,
    exactSourceSystemAndIdentity: true,
    everySermonDraft: true,
    everyDescriptionDraft: true,
    everyTranscriptDraft: true,
    everyQuestionAnswerDraft: true,
    reviewerAndApproverFieldsAllNull: true,
    provenanceAndManualReviewComplete: true,
    publicSearchIsolated: true,
    publicRoutesIsolated: true,
    historicalReadinessIsolated: true,
    noUnexpectedCompletionRecords: true
  };
}

export function classifyFailureCode(error: unknown): PunctuationFailureCode {
  return punctuationFailure(error).code;
}

export function sourceTokenCount(source: string): number {
  return lexicalTokens(source).length;
}
