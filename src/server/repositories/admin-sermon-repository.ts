import type {
  AcknowledgeEmptyEnrichmentReviewInput,
  AdminSermonListQuery,
  CreateSermonInput,
  DeletionSeoDisposition,
  EnrichmentReviewItemDecisionInput,
  EnrichmentReviewProgressInput,
  PrimaryPassageDecisionInput,
  TaxonomyKind,
  UpdateSermonInput,
  applicationRoleSchema,
  controlledMediaInputSchema,
  scriptureReferenceInputSchema,
  taxonomyResponseSchema,
  taxonomyUpdateInputSchema,
  taxonomyWriteInputSchema
} from "../../api/contracts/admin-sermons";
import type { SermonStatus } from "../../domain/sermon";
import type { ContentReadinessResult } from "../../domain/content-readiness";
import type { z } from "zod";

export type ControlledMediaInput = z.infer<typeof controlledMediaInputSchema>;
export type ScriptureReferenceInput = z.infer<typeof scriptureReferenceInputSchema>;
export type TaxonomyWriteInput = z.infer<typeof taxonomyWriteInputSchema>;
export type TaxonomyUpdateInput = z.infer<typeof taxonomyUpdateInputSchema>;
export type TaxonomyDto = z.infer<typeof taxonomyResponseSchema>;
export type AuditActorRole = z.infer<typeof applicationRoleSchema> | "system";

export interface StoredSermonSummary {
  id: string;
  title: string;
  slug: string;
  status: SermonStatus;
  serviceDate: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  rowVersion: number;
  updatedAt: string;
  speaker: { id: string; name: string; slug: string } | null;
  series: Array<{ id: string; name: string; slug: string }>;
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
  readiness: ContentReadinessResult;
}

export interface StoredSermonDetail extends StoredSermonSummary {
  summary: string | null;
  summaryStatus: CreateSermonInput["summaryStatus"];
  summarySourceKind: CreateSermonInput["summarySourceKind"];
  summarySourceReference: string | null;
  summaryCreatedAt: string | null;
  summaryUpdatedAt: string | null;
  summaryReviewedAt: string | null;
  summaryApprovedAt: string | null;
  summaryRowVersion: number;
  seoDescription: string | null;
  body: string | null;
  speaker: { id: string; name: string; slug: string } | null;
  series: Array<{ id: string; name: string; slug: string }>;
  books: Array<{ id: string; name: string; slug: string }>;
  scriptureReferences: Array<
    ScriptureReferenceInput & {
      id: string;
      parseStatus: "unparsed" | "exact" | "partial" | "unresolved" | "curated";
      originalReferenceText: string | null;
      provenance: "legacy_import" | "administrator" | "title_proposal" | "administrator_correction";
      reviewStatus: "unreviewed" | "proposed" | "confirmed" | "rejected";
      reviewerSubject: string | null;
      reviewedAt: string | null;
      parserVersion: string | null;
      rowVersion: number;
    }
  >;
  primaryPassageReview: {
    proposalOutcome: "proposed" | "no_reference" | "manual_review_required" | "administrator_entered";
    evidenceSource: "local_youtube_title" | "administrator";
    parserVersion: string;
    reviewStatus: "pending" | "confirmed_passage" | "confirmed_none" | "rejected";
    reviewedBySubject: string | null;
    reviewedAt: string | null;
    rowVersion: number;
  } | null;
  media: Array<ControlledMediaInput & { id: string }>;
  transcript: (CreateSermonInput["transcript"] & {
    rowVersion: number;
    reviewedAt: string | null;
    approvedAt: string | null;
  }) | null;
  questionAnswers: Array<CreateSermonInput["questionAnswers"][number] & {
    id: string;
    displayOrder: number;
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
}

export interface StoredSermonPage {
  data: StoredSermonSummary[];
  totalItems: number;
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
}

export interface EnrichmentReviewStateDto {
  sermonId: string;
  identityStatus: "pending" | "confirmed";
  currentStage: number;
  completedAt: string | null;
  sourceRecordKey: string | null;
  expectedItemCount: number | null;
  expectedItemSetSha256: string | null;
  expectedTranscriptSha256: string | null;
  expectedTranscriptRowVersion: number | null;
  emptyItemSetAcknowledgedBySubject: string | null;
  emptyItemSetAcknowledgedAt: string | null;
  storedItemCount: number;
  atomicItemCount: number;
  actualItemSetSha256: string | null;
  rowVersion: number;
}

export interface EnrichmentReviewItemDto {
  id: string;
  sermonId: string;
  identitySha256: string;
  sourceRecordKey: string;
  category: "caption_error" | "name_or_scripture_reference";
  displayOrder: number;
  categoryOrdinal: number;
  label: string;
  detail: string;
  supportingParagraphs: number[];
  sourceMarker: string | null;
  sourceTranscriptSha256: string;
  decisionStatus: "pending" | "accepted" | "corrected" | "left_unresolved" | "rejected";
  correctionText: string | null;
  transcriptRowVersion: number;
  decidedBySubject: string | null;
  decidedAt: string | null;
  rowVersion: number;
}

export interface EnrichmentReviewWorkflowDto {
  state: EnrichmentReviewStateDto;
  items: EnrichmentReviewItemDto[];
  recordPosition: number;
  recordCount: number;
}

export interface AuditEventDto {
  id: string;
  actorSubject: string;
  actorRole: AuditActorRole;
  action: string;
  entityType: string;
  entityId: string;
  outcome: "succeeded" | "denied" | "failed";
  changedFields: string[];
  requestCorrelationId: string;
  reviewItemIdentitySha256: string | null;
  createdAt: string;
}

export interface AuditEventInput {
  actorSubject: string;
  actorRole: AuditActorRole;
  action: string;
  entityType: string;
  entityId: string;
  outcome: "succeeded" | "denied" | "failed";
  changedFields: string[];
  requestCorrelationId: string;
  reviewItemIdentitySha256?: string | null;
}

export interface DeletionTombstoneDto {
  id: string;
  formerSermonId: string;
  formerSlug: string;
  actorSubject: string;
  actorRole: "admin";
  action: "sermon.permanent_delete";
  reason: string;
  wasPreviouslyPublished: boolean;
  seoDisposition: "redirect" | "gone" | null;
  redirectTargetPath: string | null;
  requestCorrelationId: string;
  createdAt: string;
}

export interface DeletionTombstoneInput {
  formerSermonId: string;
  formerSlug: string;
  actorSubject: string;
  reason: string;
  wasPreviouslyPublished: boolean;
  seoDisposition: DeletionSeoDisposition | null;
  requestCorrelationId: string;
}

export interface AdminSermonTransaction {
  findSermonForUpdate(id: string): Promise<StoredSermonDetail | null>;
  insertSermon(input: CreateSermonInput, actorSubject: string): Promise<string>;
  updateSermon(
    id: string,
    input: UpdateSermonInput,
    actorSubject: string
  ): Promise<void>;
  transitionSermon(
    id: string,
    status: SermonStatus,
    scheduledFor: string | null,
    publishedAt: string | null,
    actorSubject: string
  ): Promise<void>;
  recordSlugRedirect(sermonId: string, oldSlug: string, newSlug: string): Promise<void>;
  validateRedirectTarget(targetPath: string, deletingSermonId: string): Promise<boolean>;
  recordDeletionDisposition(
    sermonId: string,
    formerSlug: string,
    disposition: DeletionSeoDisposition,
    reason: string
  ): Promise<void>;
  insertDeletionTombstone(input: DeletionTombstoneInput): Promise<void>;
  deleteSermon(id: string): Promise<void>;
  validateRelationshipIds(input: {
    speakerId?: string | null | undefined;
    seriesIds?: string[] | undefined;
    bookClassificationIds?: string[] | undefined;
  }): Promise<string | null>;
  replaceRelationships(
    id: string,
    input: {
      speakerId?: CreateSermonInput["speakerId"] | undefined;
      seriesIds?: CreateSermonInput["seriesIds"] | undefined;
      bookClassificationIds?: CreateSermonInput["bookClassificationIds"] | undefined;
      scriptureReferences?: CreateSermonInput["scriptureReferences"] | undefined;
      media?: CreateSermonInput["media"] | undefined;
      transcript?: CreateSermonInput["transcript"] | undefined;
      questionAnswers?: CreateSermonInput["questionAnswers"] | undefined;
    },
    actorSubject: string
  ): Promise<void>;
  refreshSearchTerms(id: string): Promise<void>;
  decidePrimaryPassage(
    sermonId: string,
    input: PrimaryPassageDecisionInput,
    actorSubject: string
  ): Promise<void>;
  findEnrichmentReviewForUpdate(sermonId: string): Promise<EnrichmentReviewStateDto | null>;
  findEnrichmentReviewItemForUpdate(
    sermonId: string,
    itemId: string
  ): Promise<EnrichmentReviewItemDto | null>;
  updateEnrichmentReviewProgress(
    sermonId: string,
    input: EnrichmentReviewProgressInput,
    actorSubject: string
  ): Promise<void>;
  acknowledgeEmptyEnrichmentReviewItems(
    sermonId: string,
    input: AcknowledgeEmptyEnrichmentReviewInput,
    actorSubject: string
  ): Promise<boolean>;
  updateEnrichmentReviewItemDecision(
    itemId: string,
    input: EnrichmentReviewItemDecisionInput,
    transcriptRowVersion: number,
    originalWording: string | null,
    actorSubject: string
  ): Promise<void>;
  preserveEnrichmentReviewItemsForFindingCorrection(
    sermonId: string,
    transcriptRowVersion: number,
    actorSubject: string
  ): Promise<void>;
  resetEnrichmentReviewItemsForTranscriptChange(
    sermonId: string,
    transcriptRowVersion: number,
    exceptItemId: string | null,
    actorSubject: string
  ): Promise<void>;
  alignEnrichmentReviewItemsWithTranscriptVersion(
    sermonId: string,
    transcriptRowVersion: number,
    actorSubject: string
  ): Promise<void>;
  reopenEnrichmentReview(
    sermonId: string,
    identityChanged: boolean,
    actorSubject: string
  ): Promise<void>;
  completeEnrichmentReview(sermonId: string, actorSubject: string): Promise<void>;
  hasBlockingEnrichmentReviewItems(
    sermonId: string,
    transcriptRowVersion: number | null
  ): Promise<boolean>;
  touchSermon(id: string, actorSubject: string): Promise<void>;
  insertTaxonomy(kind: TaxonomyKind, input: TaxonomyWriteInput): Promise<TaxonomyDto>;
  findTaxonomyForUpdate(kind: TaxonomyKind, id: string): Promise<TaxonomyDto | null>;
  updateTaxonomy(
    kind: TaxonomyKind,
    id: string,
    input: TaxonomyUpdateInput
  ): Promise<TaxonomyDto>;
  appendAudit(event: AuditEventInput): Promise<void>;
}

export interface AdminSermonRepository {
  transaction<T>(work: (transaction: AdminSermonTransaction) => Promise<T>): Promise<T>;
  listSermons(query: AdminSermonListQuery): Promise<StoredSermonPage>;
  findSermon(id: string): Promise<StoredSermonDetail | null>;
  findEnrichmentReview(sermonId: string): Promise<EnrichmentReviewWorkflowDto | null>;
  hasSermonOrTombstone(id: string): Promise<boolean>;
  listTaxonomies(kind: TaxonomyKind): Promise<TaxonomyDto[]>;
  listAuditEvents(sermonId: string): Promise<AuditEventDto[]>;
  listRecentAuditEvents(limit: number): Promise<AuditEventDto[]>;
  listDeletionTombstones(limit: number): Promise<DeletionTombstoneDto[]>;
}
