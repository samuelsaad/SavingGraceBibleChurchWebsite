import { createHash } from "node:crypto";
import {
  adminSermonDetailSchema,
  adminSermonListResponseSchema,
  adminAuditHistoryResponseSchema,
  auditEventResponseSchema,
  deletionTombstoneResponseSchema,
  enrichmentReviewResponseSchema,
  permanentDeletionResultSchema,
  taxonomyResponseSchema,
  type AcknowledgeEmptyEnrichmentReviewInput,
  type AdminSermonDetail,
  type AdminSermonListQuery,
  type CreateSermonInput,
  type EnrichmentReviewItemDecisionInput,
  type EnrichmentReviewProgressInput,
  type EnrichmentReviewResponse,
  type FinishEnrichmentReviewInput,
  type PermanentlyDeleteSermonInput,
  type PrimaryPassageDecisionInput,
  type SermonStateAction,
  type SermonTransitionInput,
  type TaxonomyKind,
  type UpdateSermonInput
} from "../api/contracts/admin-sermons";
import {
  assertAdminAccess,
  assertMayEditSermon,
  assertMayManageTaxonomies,
  assertMayPermanentlyDelete,
  assertMayReadSermon,
  assertMayTransitionSermon,
  assertMayViewAudit,
  type ApplicationIdentity
} from "./authorization";
import { conflict, invalid, invalidMany, notFound } from "./errors";
import { isFutureSchedule, transitionSermonStatus } from "./sermon-lifecycle";
import {
  applyAssociatedTranscriptCorrection,
  associatedTranscriptWording,
  TranscriptAssociationError
} from "../enrichment/review-wording";
import type {
  AdminSermonRepository,
  AuditEventInput,
  EnrichmentReviewWorkflowDto,
  StoredSermonDetail,
  StoredSermonSummary,
  TaxonomyUpdateInput,
  TaxonomyWriteInput
} from "../server/repositories/admin-sermon-repository";
import { evaluateReviewSetIntegrity } from "../enrichment/review-set-integrity";
import {
  groundedSermonEnrichmentReferenceIsCurrent,
  isSupersededWave1SourceReference,
  parseGroundedSermonEnrichmentSourceReference
} from "../enrichment/sermon-enrichment-policy";
import { inspectGeneratedText } from "../enrichment/generated-text-mechanical-qa";

function transcriptSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertGroundedReferenceIsCurrent(
  reference: string | null | undefined,
  sermon: StoredSermonDetail,
  path: string
): void {
  const grounded = parseGroundedSermonEnrichmentSourceReference(reference);
  if (!grounded) return;
  if (!sermon.transcript || sermon.transcript.status !== "approved" || sermon.transcript.approvedAt === null ||
    !groundedSermonEnrichmentReferenceIsCurrent(reference, {
      groundingRevisionId: sermon.transcript.groundingRevisionId,
      transcriptSha256: transcriptSha256(sermon.transcript.bodyText),
      legacyBindings: sermon.transcript.legacyGroundingBindings
    })) {
    invalid(path, "This generated draft is stale because its approved transcript identity or content changed");
  }
}

function assertGeneratedDescriptionPassedMechanicalQa(summary: string | null, path: string): void {
  if (!summary) return;
  const mechanicalQa = inspectGeneratedText(summary, []);
  if (mechanicalQa.blockingIssueCount > 0) {
    invalid(path, "The generated description must pass the deterministic editorial proofread before review or approval");
  }
}

function assertGeneratedQuestionAnswerPassedMechanicalQa(
  item: { question: string; answer: string },
  path: string
): void {
  const mechanicalQa = inspectGeneratedText("", [item]);
  if (mechanicalQa.blockingIssueCount > 0) {
    invalid(path, "The generated Q&A pair must pass the deterministic editorial proofread before review or approval");
  }
}

function sermonSummaryDto(sermon: StoredSermonSummary) {
  return {
    id: sermon.id,
    title: sermon.title,
    slug: sermon.slug,
    status: sermon.status,
    serviceDate: sermon.serviceDate,
    scheduledFor: sermon.scheduledFor,
    publishedAt: sermon.publishedAt,
    rowVersion: sermon.rowVersion,
    updatedAt: sermon.updatedAt,
    speaker: sermon.speaker,
    series: sermon.series,
    historicalBackfillRequired: sermon.historicalBackfillRequired,
    enrichmentReview: sermon.enrichmentReview,
    primaryPassage: sermon.primaryPassage,
    youtubeSource: sermon.youtubeSource,
    readiness: sermon.readiness
  };
}

function sermonDetailDto(sermon: StoredSermonDetail): AdminSermonDetail {
  const generatedDescription = sermon.summarySourceKind === "generated_draft" ? (sermon.summary ?? "") : "";
  const hasGeneratedQuestionAnswer = sermon.questionAnswers.some((item) => item.sourceKind === "generated_draft");
  const generatedQuestionAnswers = sermon.questionAnswers.map((item) => item.sourceKind === "generated_draft"
    ? { question: item.question, answer: item.answer }
    : { question: "", answer: "" });
  const generatedTextMechanicalQa = generatedDescription || hasGeneratedQuestionAnswer
    ? inspectGeneratedText(generatedDescription, generatedQuestionAnswers)
    : null;
  return adminSermonDetailSchema.parse({
    ...sermonSummaryDto(sermon),
    summary: sermon.summary,
    summaryStatus: sermon.summaryStatus,
    summarySourceKind: sermon.summarySourceKind,
    summarySourceReference: sermon.summarySourceReference,
    summaryCreatedAt: sermon.summaryCreatedAt,
    summaryUpdatedAt: sermon.summaryUpdatedAt,
    summaryReviewedAt: sermon.summaryReviewedAt,
    summaryApprovedAt: sermon.summaryApprovedAt,
    summaryRowVersion: sermon.summaryRowVersion,
    seoDescription: sermon.seoDescription,
    body: sermon.body,
    speaker: sermon.speaker,
    series: sermon.series,
    books: sermon.books,
    scriptureReferences: sermon.scriptureReferences,
    primaryPassageReview: sermon.primaryPassageReview,
    media: sermon.media,
    transcript: sermon.transcript,
    questionAnswers: sermon.questionAnswers,
    generatedTextMechanicalQa,
    enrichmentSource: sermon.enrichmentSource
  });
}

function successfulAudit(
  identity: ApplicationIdentity,
  action: string,
  entityType: string,
  entityId: string,
  changedFields: string[],
  requestCorrelationId: string,
  reviewItemIdentitySha256: string | null = null
): AuditEventInput {
  return {
    actorSubject: identity.subject,
    actorRole: identity.role,
    action,
    entityType,
    entityId,
    outcome: "succeeded",
    changedFields,
    requestCorrelationId,
    reviewItemIdentitySha256
  };
}

function reviewItemContext(
  transcript: string,
  marker: string | null
): { before: string; flagged: string; after: string } | null {
  if (!marker) return null;
  const index = transcript.indexOf(marker);
  if (index < 0) return null;
  const contextLength = 220;
  return {
    before: transcript.slice(Math.max(0, index - contextLength), index).trimStart(),
    flagged: marker,
    after: transcript.slice(index + marker.length, index + marker.length + contextLength).trimEnd()
  };
}

function supportingParagraphContext(
  transcript: string,
  paragraphNumbers: readonly number[]
): Array<{ paragraphNumber: number; text: string }> {
  const paragraphs = transcript.split(/\n\s*\n/u);
  return paragraphNumbers.flatMap((paragraphNumber) => {
    const text = paragraphs[paragraphNumber - 1]?.trim();
    return text ? [{ paragraphNumber, text }] : [];
  });
}

function reviewItemAssociation(
  transcript: string,
  paragraphNumbers: readonly number[]
): { associatedWording: string | null; associationStatus: "exact" | "missing" | "ambiguous" } {
  try {
    return {
      associatedWording: associatedTranscriptWording(transcript, paragraphNumbers),
      associationStatus: "exact"
    };
  } catch (error) {
    if (error instanceof TranscriptAssociationError) {
      return {
        associatedWording: null,
        associationStatus: error.reason === "ambiguous" ? "ambiguous" : "missing"
      };
    }
    throw error;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function enrichmentReviewDto(
  sermon: StoredSermonDetail,
  workflow: EnrichmentReviewWorkflowDto
): EnrichmentReviewResponse {
  const transcript = sermon.transcript?.bodyText ?? "";
  const emptyItemSetAcknowledged =
    workflow.state.emptyItemSetAcknowledgedBySubject !== null &&
    workflow.state.emptyItemSetAcknowledgedAt !== null;
  const integrity = evaluateReviewSetIntegrity({
    sourceRecordKey: workflow.state.sourceRecordKey,
    expectedItemCount: workflow.state.expectedItemCount,
    expectedItemSetSha256: workflow.state.expectedItemSetSha256,
    databaseItemSetSha256: workflow.state.actualItemSetSha256,
    expectedTranscriptSha256: workflow.state.expectedTranscriptSha256,
    expectedTranscriptRowVersion: workflow.state.expectedTranscriptRowVersion,
    storedItemCount: workflow.state.storedItemCount,
    atomicItemCount: workflow.state.atomicItemCount,
    transcriptBody: transcript,
    transcriptRowVersion: sermon.transcript?.rowVersion ?? null,
    emptyItemSetAcknowledged,
    items: workflow.items
  });
  const stageCompletion = {
    identity: workflow.state.completedAt !== null || (
      workflow.state.identityStatus === "confirmed" &&
      sermon.speaker !== null &&
      sermon.serviceDate !== "1970-01-01"
    ),
    findings: integrity.findingsComplete,
    transcript: workflow.state.completedAt !== null || (
      sermon.transcript?.status === "approved" && sermon.transcript.approvedAt !== null
    ),
    description: workflow.state.completedAt !== null || (
      sermon.summaryStatus === "approved" && sermon.summaryApprovedAt !== null
    ),
    questionAnswers: workflow.state.completedAt !== null || (
      sermon.questionAnswers.length >= 5 &&
      sermon.questionAnswers.length <= 10 &&
      sermon.questionAnswers.every((item) => item.status === "approved" && item.approvedAt !== null)
    ),
    final: workflow.state.completedAt !== null
  };
  const stageComplete = [
    stageCompletion.identity,
    stageCompletion.findings,
    stageCompletion.transcript,
    stageCompletion.description,
    stageCompletion.questionAnswers,
    stageCompletion.final
  ];
  const completedStageCount = stageComplete.filter(Boolean).length;
  const canFinish =
    stageComplete.slice(0, 5).every(Boolean) &&
    sermon.readiness.hasValidControlledMedia &&
    sermon.status === "draft";
  return enrichmentReviewResponseSchema.parse({
    sermon: sermonDetailDto(sermon),
    recordPosition: workflow.recordPosition,
    recordCount: workflow.recordCount,
    review: {
      identityStatus: workflow.state.identityStatus,
      currentStage: workflow.state.currentStage,
      emptyItemSetAcknowledgedBySubject: workflow.state.emptyItemSetAcknowledgedBySubject,
      emptyItemSetAcknowledgedAt: workflow.state.emptyItemSetAcknowledgedAt,
      completedAt: workflow.state.completedAt,
      rowVersion: workflow.state.rowVersion
    },
    items: workflow.items.map((item) => ({
      ...item,
      ...reviewItemAssociation(transcript, item.supportingParagraphs),
      context: reviewItemContext(
        transcript,
        item.decisionStatus === "corrected" ? item.correctionText : item.sourceMarker
      ),
      supportingContext: supportingParagraphContext(transcript, item.supportingParagraphs)
    })),
    progress: {
      resolvedItemCount: integrity.resolvedItemCount,
      unresolvedItemCount: integrity.unresolvedItemCount,
      totalItemCount: integrity.expectedItemCount,
      presentItemCount: workflow.state.storedItemCount,
      itemSetMatches: integrity.itemSetMatches,
      transcriptMatchesExpected: integrity.transcriptMatchesExpected,
      reviewSetVerified: integrity.reviewSetVerified,
      requiresEmptyItemSetAcknowledgement: integrity.requiresEmptyItemSetAcknowledgement,
      stageCompletion,
      completedStageCount,
      percentReviewed: Math.round((completedStageCount / 6) * 100),
      canFinish
    }
  });
}

function assertTaxonomyShape(
  kind: TaxonomyKind,
  input: {
    description?: string | null | undefined;
    canonicalBookId?: number | null | undefined;
  }
): void {
  if (kind !== "books" && input.canonicalBookId !== undefined && input.canonicalBookId !== null) {
    invalid("canonicalBookId", "canonicalBookId is valid only for book classifications");
  }
  if (kind === "books" && input.description !== undefined && input.description !== null) {
    invalid("description", "Book classifications do not have descriptions");
  }
}

export class AdminSermonService {
  constructor(
    private readonly repository: AdminSermonRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async list(
    query: AdminSermonListQuery,
    identity: ApplicationIdentity
  ): Promise<unknown> {
    assertAdminAccess(identity);
    const page = await this.repository.listSermons(query);
    return adminSermonListResponseSchema.parse({
      data: page.data.map(sermonSummaryDto),
      countsByStatus: page.countsByStatus,
      readinessProgress: page.readinessProgress,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: page.totalItems,
        totalPages: Math.ceil(page.totalItems / query.pageSize)
      }
    });
  }

  async detail(id: string, identity: ApplicationIdentity): Promise<AdminSermonDetail> {
    assertAdminAccess(identity);
    const sermon = await this.repository.findSermon(id);
    if (!sermon) notFound("Sermon was not found");
    assertMayReadSermon(identity, sermon);
    return sermonDetailDto(sermon);
  }

  async enrichmentReviewDetail(
    id: string,
    identity: ApplicationIdentity
  ): Promise<EnrichmentReviewResponse> {
    assertAdminAccess(identity);
    const [sermon, workflow] = await Promise.all([
      this.repository.findSermon(id),
      this.repository.findEnrichmentReview(id)
    ]);
    if (!sermon) notFound("Sermon was not found");
    assertMayReadSermon(identity, sermon);
    if (!workflow || !sermon.enrichmentSource) {
      notFound("A guided enrichment review is not available for this sermon");
    }
    return enrichmentReviewDto(sermon, workflow);
  }

  async updateEnrichmentReviewProgress(
    id: string,
    input: EnrichmentReviewProgressInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ): Promise<EnrichmentReviewResponse> {
    assertAdminAccess(identity);
    await this.repository.transaction(async (transaction) => {
      const sermon = await transaction.findSermonForUpdate(id);
      if (!sermon) notFound("Sermon was not found");
      if (sermon.rowVersion !== input.sermonRowVersion) conflict();
      assertMayEditSermon(identity, sermon);
      const review = await transaction.findEnrichmentReviewForUpdate(id);
      if (!review) notFound("A guided enrichment review is not available for this sermon");
      if (review.rowVersion !== input.reviewRowVersion) conflict();
      if (review.completedAt !== null && input.identityStatus !== "pending") {
        return;
      }
      if (input.identityStatus === "confirmed") {
        if (!sermon.speaker) {
          invalid("speakerId", "Choose and verify the sermon speaker before confirming identity");
        }
        if (sermon.serviceDate === "1970-01-01") {
          invalid("serviceDate", "Enter the verified service date before confirming identity");
        }
      }
      const identityComplete =
        (input.identityStatus ?? review.identityStatus) === "confirmed" &&
        sermon.speaker !== null &&
        sermon.serviceDate !== "1970-01-01";
      const findingsComplete = identityComplete && !await transaction.hasBlockingEnrichmentReviewItems(
        id,
        sermon.transcript?.rowVersion ?? null
      );
      const transcriptComplete =
        sermon.transcript?.status === "approved" && sermon.transcript.approvedAt !== null;
      const descriptionComplete =
        sermon.summaryStatus === "approved" && sermon.summaryApprovedAt !== null;
      const questionAnswersComplete =
        sermon.questionAnswers.length >= 5 &&
        sermon.questionAnswers.length <= 10 &&
        sermon.questionAnswers.every((item) => item.status === "approved" && item.approvedAt !== null);
      const firstIncompleteStage = !identityComplete
        ? 1
        : !findingsComplete
          ? 2
          : !transcriptComplete
            ? 3
            : !descriptionComplete
              ? 4
              : !questionAnswersComplete
                ? 5
                : 6;
      if (input.currentStage > firstIncompleteStage) {
        invalid("currentStage", "Complete the earliest incomplete review stage before moving forward");
      }
      await transaction.updateEnrichmentReviewProgress(id, input, identity.subject);
      if (input.identityStatus && input.identityStatus !== review.identityStatus) {
        await transaction.appendAudit(
          successfulAudit(
            identity,
            input.identityStatus === "confirmed"
              ? "sermon.enrichment_identity_confirmed"
              : "sermon.enrichment_identity_reopened",
            "sermon",
            id,
            ["enrichmentReview.identityStatus"],
            requestCorrelationId
          )
        );
      }
    });
    return this.enrichmentReviewDetail(id, identity);
  }

  async acknowledgeEmptyEnrichmentReviewItems(
    id: string,
    input: AcknowledgeEmptyEnrichmentReviewInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ): Promise<EnrichmentReviewResponse> {
    assertAdminAccess(identity);
    await this.repository.transaction(async (transaction) => {
      const sermon = await transaction.findSermonForUpdate(id);
      if (!sermon) notFound("Sermon was not found");
      if (sermon.rowVersion !== input.sermonRowVersion) conflict();
      assertMayEditSermon(identity, sermon);
      const review = await transaction.findEnrichmentReviewForUpdate(id);
      if (!review) notFound("A guided enrichment review is not available for this sermon");
      if (review.rowVersion !== input.reviewRowVersion) conflict();
      const transcript = sermon.transcript;
      if (!transcript || transcript.rowVersion !== input.transcriptRowVersion) conflict();
      if (
        review.identityStatus !== "confirmed" ||
        sermon.speaker === null ||
        sermon.serviceDate === "1970-01-01"
      ) {
        invalid("identity", "Confirm identity and required metadata before reviewing findings");
      }
      if (review.expectedItemCount !== 0) {
        invalid("reviewItems", "Empty-set acknowledgement is available only for a zero-item review set");
      }
      if (
        review.sourceRecordKey === null ||
        review.storedItemCount !== 0 ||
        review.atomicItemCount !== 0 ||
        review.expectedItemSetSha256 !== sha256("") ||
        review.actualItemSetSha256 !== review.expectedItemSetSha256 ||
        review.expectedTranscriptSha256 !== sha256(transcript.bodyText) ||
        review.expectedTranscriptRowVersion !== transcript.rowVersion
      ) {
        conflict("The empty review set or transcript expectation is not verified; reload after restoration.");
      }
      if (
        review.emptyItemSetAcknowledgedBySubject !== null ||
        review.emptyItemSetAcknowledgedAt !== null
      ) {
        conflict("The empty review set has already been acknowledged.");
      }
      const acknowledged = await transaction.acknowledgeEmptyEnrichmentReviewItems(
        id,
        input,
        identity.subject
      );
      if (!acknowledged) {
        conflict("The empty review set changed before it could be acknowledged; reload and inspect it again.");
      }
      await transaction.appendAudit(
        successfulAudit(
          identity,
          "sermon.enrichment_zero_findings_acknowledged",
          "sermon",
          id,
          ["enrichmentReview.emptyItemSetAcknowledgedAt"],
          requestCorrelationId
        )
      );
    });
    return this.enrichmentReviewDetail(id, identity);
  }

  async decideEnrichmentReviewItem(
    id: string,
    itemId: string,
    input: EnrichmentReviewItemDecisionInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ): Promise<EnrichmentReviewResponse> {
    assertAdminAccess(identity);
    await this.repository.transaction(async (transaction) => {
      const sermon = await transaction.findSermonForUpdate(id);
      if (!sermon) notFound("Sermon was not found");
      if (sermon.rowVersion !== input.sermonRowVersion) conflict();
      assertMayEditSermon(identity, sermon);
      const review = await transaction.findEnrichmentReviewForUpdate(id);
      if (!review) notFound("A guided enrichment review is not available for this sermon");
      if (review.rowVersion !== input.reviewRowVersion) conflict();
      const item = await transaction.findEnrichmentReviewItemForUpdate(id, itemId);
      if (!item) notFound("Review item was not found");
      if (item.rowVersion !== input.itemRowVersion) conflict();
      const transcript = sermon.transcript;
      if (!transcript || transcript.rowVersion !== input.transcriptRowVersion) conflict();
      if (item.transcriptRowVersion !== transcript.rowVersion) conflict();
      if (
        review.expectedTranscriptRowVersion !== transcript.rowVersion ||
        review.expectedTranscriptSha256 !== sha256(transcript.bodyText)
      ) {
        conflict("The transcript no longer matches this review set; reload before deciding.");
      }

      let resultingTranscriptRowVersion = transcript.rowVersion;
      let transcriptChanged = false;
      let originalWording: string | null = null;
      if (input.decision === "corrected") {
        let correction: ReturnType<typeof applyAssociatedTranscriptCorrection>;
        try {
          correction = applyAssociatedTranscriptCorrection({
            transcript: transcript.bodyText,
            paragraphNumbers: item.supportingParagraphs,
            expectedOriginalWording: input.originalWording!,
            correctedWording: input.correctionText!
          });
        } catch (error) {
          if (error instanceof TranscriptAssociationError) {
            if (error.reason === "stale") conflict(error.message);
            invalid("correctionText", error.message);
          }
          throw error;
        }
        originalWording = correction.originalWording;
        await transaction.replaceRelationships(
          id,
          {
            transcript: {
              bodyText: correction.bodyText,
              status: "draft",
              sourceKind: transcript.sourceKind,
              sourceReference: transcript.sourceReference
            }
          },
          identity.subject
        );
        await transaction.touchSermon(id, identity.subject);
        resultingTranscriptRowVersion += 1;
        transcriptChanged = true;
        await transaction.preserveEnrichmentReviewItemsForFindingCorrection(
          id,
          resultingTranscriptRowVersion,
          identity.subject
        );
      } else if (input.decision === "rejected" && transcript.status !== "draft") {
        await transaction.replaceRelationships(
          id,
          {
            transcript: {
              bodyText: transcript.bodyText,
              status: "draft",
              sourceKind: transcript.sourceKind,
              sourceReference: transcript.sourceReference
            }
          },
          identity.subject
        );
        await transaction.touchSermon(id, identity.subject);
        resultingTranscriptRowVersion += 1;
        transcriptChanged = true;
        await transaction.alignEnrichmentReviewItemsWithTranscriptVersion(
          id,
          resultingTranscriptRowVersion,
          identity.subject
        );
      }

      await transaction.updateEnrichmentReviewItemDecision(
        itemId,
        input,
        resultingTranscriptRowVersion,
        originalWording,
        identity.subject
      );
      await transaction.appendAudit(
        successfulAudit(
          identity,
          `sermon.enrichment_review_item_${input.decision}`,
          "sermon",
          id,
          transcriptChanged
            ? ["enrichmentReview.items", "transcript"]
            : ["enrichmentReview.items"],
          requestCorrelationId,
          item.identitySha256
        )
      );
    });
    return this.enrichmentReviewDetail(id, identity);
  }

  async finishEnrichmentReview(
    id: string,
    input: FinishEnrichmentReviewInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ): Promise<EnrichmentReviewResponse> {
    assertAdminAccess(identity);
    await this.repository.transaction(async (transaction) => {
      const sermon = await transaction.findSermonForUpdate(id);
      if (!sermon) notFound("Sermon was not found");
      if (sermon.rowVersion !== input.sermonRowVersion) conflict();
      assertMayEditSermon(identity, sermon);
      const review = await transaction.findEnrichmentReviewForUpdate(id);
      if (!review) notFound("A guided enrichment review is not available for this sermon");
      if (review.rowVersion !== input.reviewRowVersion) conflict();
      const blockingItems = await transaction.hasBlockingEnrichmentReviewItems(
        id,
        sermon.transcript?.rowVersion ?? null
      );
      const issues: Array<{ path: string; message: string }> = [];
      if (review.identityStatus !== "confirmed") {
        issues.push({ path: "identity", message: "Confirm identity, speaker, date and provenance." });
      }
      if (blockingItems) {
        issues.push({ path: "reviewItems", message: "Resolve every required flagged review item." });
      }
      if (!sermon.readiness.hasApprovedTranscript) {
        issues.push({ path: "transcript", message: "Approve the complete transcript." });
      }
      if (!sermon.readiness.hasApprovedDescription) {
        issues.push({ path: "summary", message: "Approve the sermon description." });
      }
      if (!sermon.readiness.hasRequiredQuestionAnswers) {
        issues.push({ path: "questionAnswers", message: "Approve five to ten ordered Q&A pairs." });
      }
      if (!sermon.readiness.hasValidControlledMedia) {
        issues.push({ path: "media", message: "Confirm valid controlled media." });
      }
      if (sermon.status !== "draft") {
        issues.push({ path: "status", message: "The pilot review can finish only while the sermon remains draft and private." });
      }
      if (issues.length) invalidMany("Complete the guided review checklist", issues);
      await transaction.completeEnrichmentReview(id, identity.subject);
      await transaction.appendAudit(
        successfulAudit(
          identity,
          "sermon.enrichment_review_finished",
          "sermon",
          id,
          ["enrichmentReview.completedAt"],
          requestCorrelationId
        )
      );
    });
    return this.enrichmentReviewDetail(id, identity);
  }

  async create(
    input: CreateSermonInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ): Promise<AdminSermonDetail> {
    assertAdminAccess(identity);
    return this.repository.transaction(async (transaction) => {
      if (input.summarySourceKind === "generated_draft" &&
        input.summaryStatus !== "draft" && input.summaryStatus !== "missing") {
        assertGeneratedDescriptionPassedMechanicalQa(input.summary, "summaryStatus");
      }
      for (const [index, item] of input.questionAnswers.entries()) {
        if (item.sourceKind === "generated_draft" && item.status !== "draft") {
          assertGeneratedQuestionAnswerPassedMechanicalQa(item, `questionAnswers.${index}.status`);
        }
      }
      const invalidRelationship = await transaction.validateRelationshipIds(input);
      if (invalidRelationship) invalid(invalidRelationship, "One or more relationship IDs do not exist");
      const id = await transaction.insertSermon(input, identity.subject);
      await transaction.replaceRelationships(id, input, identity.subject);
      await transaction.refreshSearchTerms(id);
      await transaction.appendAudit(
        successfulAudit(
          identity,
          "sermon.create",
          "sermon",
          id,
          [
            "title",
            "slug",
            "serviceDate",
            "summary",
            "summaryStatus",
            "summarySourceKind",
            "summarySourceReference",
            "seoDescription",
            "body",
            "speakerId",
            "seriesIds",
            "bookClassificationIds",
            "scriptureReferences",
            "media",
            "transcript",
            "questionAnswers"
          ],
          requestCorrelationId
        )
      );
      const created = await transaction.findSermonForUpdate(id);
      if (!created) notFound("Created sermon could not be read");
      return sermonDetailDto(created);
    });
  }

  async update(
    id: string,
    input: UpdateSermonInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ): Promise<AdminSermonDetail> {
    assertAdminAccess(identity);
    return this.repository.transaction(async (transaction) => {
      const sermon = await transaction.findSermonForUpdate(id);
      if (!sermon) notFound("Sermon was not found");
      if (sermon.rowVersion !== input.rowVersion) conflict();
      assertMayEditSermon(identity, sermon);
      if (input.summary !== undefined && input.summaryStatus === undefined) {
        invalid("summaryStatus", "Choose the sermon description review status when editing its text");
      }
      const summary = input.summary !== undefined ? input.summary : sermon.summary;
      const summaryStatus = input.summaryStatus ?? sermon.summaryStatus;
      const summarySourceReference = input.summarySourceReference !== undefined
        ? input.summarySourceReference
        : sermon.summarySourceReference;
      const summarySourceKind = input.summarySourceKind ?? sermon.summarySourceKind;
      const summaryLength = summary?.trim().length ?? 0;
      if (summaryStatus === "missing" && summaryLength > 0) {
        invalid("summaryStatus", "A nonblank sermon description cannot have missing status");
      }
      if (summaryStatus !== "missing" && summaryLength === 0) {
        invalid("summary", "Sermon description text is required once work has started");
      }
      if (summaryStatus === "approved" && summaryLength < 80) {
        invalid("summary", "An approved sermon description must contain at least 80 characters");
      }
      if (summaryStatus !== "draft" && summaryStatus !== "missing") {
        if (isSupersededWave1SourceReference(sermon.summarySourceReference) ||
          isSupersededWave1SourceReference(summarySourceReference)) {
          invalid(
            "summaryStatus",
            "This description came from the superseded extractive Wave 1 generator and must be replaced before review or approval"
          );
        }
        assertGroundedReferenceIsCurrent(summarySourceReference, sermon, "summaryStatus");
        if (summarySourceKind === "generated_draft" && summary) {
          assertGeneratedDescriptionPassedMechanicalQa(summary, "summaryStatus");
        }
      }
      if (input.questionAnswers !== undefined) {
        for (const [index, item] of input.questionAnswers.entries()) {
          if (item.status === "draft") continue;
          const current = sermon.questionAnswers[index];
          if (isSupersededWave1SourceReference(current?.sourceReference) ||
            isSupersededWave1SourceReference(item.sourceReference)) {
            invalid(
              `questionAnswers.${index}.status`,
              "This Q&A pair came from the superseded extractive Wave 1 generator and must be replaced before review or approval"
            );
          }
          assertGroundedReferenceIsCurrent(item.sourceReference, sermon, `questionAnswers.${index}.status`);
          if (item.sourceKind === "generated_draft") {
            assertGeneratedQuestionAnswerPassedMechanicalQa(item, `questionAnswers.${index}.status`);
          }
        }
      }
      const seoDescription = input.seoDescription !== undefined
        ? input.seoDescription
        : sermon.seoDescription;
      if (seoDescription && summaryStatus !== "approved") {
        invalid("seoDescription", "An SEO description override requires an approved sermon description");
      }
      const invalidRelationship = await transaction.validateRelationshipIds(input);
      if (invalidRelationship) invalid(invalidRelationship, "One or more relationship IDs do not exist");
      const transcriptBodyChanged = input.transcript !== undefined &&
        input.transcript.bodyText !== (sermon.transcript?.bodyText ?? "");
      const enrichmentReview = input.transcript !== undefined
        ? await transaction.findEnrichmentReviewForUpdate(id)
        : null;
      if (
        enrichmentReview &&
        transcriptBodyChanged &&
        input.transcript?.status === "approved"
      ) {
        invalid(
          "transcript.status",
          "Save changed transcript wording as draft, then repeat flagged-item review before approval"
        );
      }
      if (
        input.transcript?.status === "approved" &&
        await transaction.hasBlockingEnrichmentReviewItems(
          id,
          sermon.transcript?.rowVersion ?? null
        )
      ) {
        invalid(
          "transcript.status",
          "Resolve every required flagged review item before approving the transcript"
        );
      }
      await transaction.updateSermon(id, input, identity.subject);
      await transaction.replaceRelationships(id, input, identity.subject);
      await transaction.refreshSearchTerms(id);
      const identityChanged =
        (input.title !== undefined && input.title !== sermon.title) ||
        (input.serviceDate !== undefined && input.serviceDate !== sermon.serviceDate) ||
        (input.speakerId !== undefined && input.speakerId !== (sermon.speaker?.id ?? null));
      const reviewContentChanged =
        input.summary !== undefined ||
        input.summaryStatus !== undefined ||
        input.media !== undefined ||
        input.transcript !== undefined ||
        input.questionAnswers !== undefined;
      if (transcriptBodyChanged) {
        await transaction.resetEnrichmentReviewItemsForTranscriptChange(
          id,
          (sermon.transcript?.rowVersion ?? 0) + 1,
          null,
          identity.subject
        );
      } else if (input.transcript !== undefined) {
        await transaction.alignEnrichmentReviewItemsWithTranscriptVersion(
          id,
          (sermon.transcript?.rowVersion ?? 0) + 1,
          identity.subject
        );
      }
      if (identityChanged || (!transcriptBodyChanged && reviewContentChanged)) {
        await transaction.reopenEnrichmentReview(id, identityChanged, identity.subject);
      }
      if (input.slug !== undefined && input.slug !== sermon.slug && sermon.publishedAt !== null) {
        await transaction.recordSlugRedirect(id, sermon.slug, input.slug);
      }
      const changedFields = Object.keys(input).filter((field) => field !== "rowVersion");
      await transaction.appendAudit(
        successfulAudit(
          identity,
          "sermon.update",
          "sermon",
          id,
          changedFields,
          requestCorrelationId
        )
      );
      if (input.bookClassificationIds !== undefined) {
        await transaction.appendAudit(
          successfulAudit(
            identity,
            "sermon.bible_book_assignment_updated",
            "sermon",
            id,
            ["bookClassificationIds"],
            requestCorrelationId
          )
        );
      }
      const updated = await transaction.findSermonForUpdate(id);
      if (!updated) notFound("Updated sermon could not be read");
      return sermonDetailDto(updated);
    });
  }

  async decidePrimaryPassage(
    id: string,
    input: PrimaryPassageDecisionInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ): Promise<AdminSermonDetail> {
    assertAdminAccess(identity);
    return this.repository.transaction(async (transaction) => {
      const sermon = await transaction.findSermonForUpdate(id);
      if (!sermon) notFound("Sermon was not found");
      if (sermon.rowVersion !== input.sermonRowVersion) conflict();
      assertMayEditSermon(identity, sermon);
      if (!sermon.primaryPassageReview) {
        notFound("Primary-passage preparation is not available for this sermon");
      }
      if (sermon.primaryPassageReview.rowVersion !== input.reviewRowVersion) conflict();
      await transaction.decidePrimaryPassage(id, input, identity.subject);
      await transaction.refreshSearchTerms(id);
      const action = input.action === "confirm_passages"
        ? "sermon.primary_passages_confirmed"
        : input.action === "confirm_no_primary_passage"
          ? "sermon.no_primary_passage_confirmed"
          : "sermon.primary_passage_proposal_rejected";
      await transaction.appendAudit(
        successfulAudit(
          identity,
          action,
          "sermon",
          id,
          ["primaryPassageReview", "scriptureReferences"],
          requestCorrelationId
        )
      );
      const updated = await transaction.findSermonForUpdate(id);
      if (!updated) notFound("Updated sermon could not be read");
      return sermonDetailDto(updated);
    });
  }

  async transition(
    id: string,
    action: SermonStateAction,
    input: SermonTransitionInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ): Promise<AdminSermonDetail> {
    assertAdminAccess(identity);
    if (action === "schedule") {
      if (!isFutureSchedule(input.scheduledFor, this.now())) {
        invalid("scheduledFor", "Scheduling requires a future timestamp");
      }
    } else if (input.scheduledFor !== undefined) {
      invalid("scheduledFor", "scheduledFor is accepted only by the schedule transition");
    }

    return this.repository.transaction(async (transaction) => {
      const sermon = await transaction.findSermonForUpdate(id);
      if (!sermon) notFound("Sermon was not found");
      if (sermon.rowVersion !== input.rowVersion) conflict();
      assertMayTransitionSermon(identity, sermon, action);
      const nextStatus = transitionSermonStatus(sermon.status, action);
      if (!nextStatus) invalid("action", `Cannot ${action} a sermon in ${sermon.status} state`);
      if ((action === "schedule" || action === "publish") && !sermon.readiness.isComplete) {
        invalidMany(
          "Complete the sermon checklist before scheduling or publishing",
          sermon.readiness.issues.map((issue) => ({ path: issue.path, message: issue.message }))
        );
      }

      const scheduledFor = action === "schedule" ? input.scheduledFor! : null;
      const publishedAt =
        nextStatus === "published"
          ? (sermon.publishedAt ?? this.now().toISOString())
          : sermon.publishedAt;
      await transaction.transitionSermon(
        id,
        nextStatus,
        scheduledFor,
        publishedAt,
        identity.subject
      );
      await transaction.appendAudit(
        successfulAudit(
          identity,
          `sermon.${action}`,
          "sermon",
          id,
          action === "schedule" ? ["status", "scheduledFor"] : ["status"],
          requestCorrelationId
        )
      );
      const updated = await transaction.findSermonForUpdate(id);
      if (!updated) notFound("Transitioned sermon could not be read");
      return sermonDetailDto(updated);
    });
  }

  async listTaxonomies(kind: TaxonomyKind, _identity: ApplicationIdentity) {
    assertAdminAccess(_identity);
    return (await this.repository.listTaxonomies(kind)).map((value) =>
      taxonomyResponseSchema.parse(value)
    );
  }

  async createTaxonomy(
    kind: TaxonomyKind,
    input: TaxonomyWriteInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ) {
    assertMayManageTaxonomies(identity);
    assertTaxonomyShape(kind, input);
    return this.repository.transaction(async (transaction) => {
      const created = await transaction.insertTaxonomy(kind, input);
      await transaction.appendAudit(
        successfulAudit(
          identity,
          `${kind}.create`,
          kind === "books" ? "book_classification" : kind.slice(0, -1),
          created.id,
          ["name", "slug", ...(kind === "books" ? ["canonicalBookId"] : ["description"])],
          requestCorrelationId
        )
      );
      return taxonomyResponseSchema.parse(created);
    });
  }

  async updateTaxonomy(
    kind: TaxonomyKind,
    id: string,
    input: TaxonomyUpdateInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ) {
    assertMayManageTaxonomies(identity);
    assertTaxonomyShape(kind, input);
    return this.repository.transaction(async (transaction) => {
      const current = await transaction.findTaxonomyForUpdate(kind, id);
      if (!current) notFound("Taxonomy record was not found");
      if (current.rowVersion !== input.rowVersion) conflict();
      const updated = await transaction.updateTaxonomy(kind, id, input);
      await transaction.appendAudit(
        successfulAudit(
          identity,
          `${kind}.update`,
          kind === "books" ? "book_classification" : kind.slice(0, -1),
          id,
          Object.keys(input).filter((field) => field !== "rowVersion"),
          requestCorrelationId
        )
      );
      return taxonomyResponseSchema.parse(updated);
    });
  }

  async listAudit(id: string, identity: ApplicationIdentity) {
    assertMayViewAudit(identity);
    if (!(await this.repository.hasSermonOrTombstone(id))) notFound("Sermon was not found");
    return (await this.repository.listAuditEvents(id)).map((event) =>
      auditEventResponseSchema.parse(event)
    );
  }

  async auditHistory(identity: ApplicationIdentity) {
    assertMayViewAudit(identity);
    const [events, deletionTombstones] = await Promise.all([
      this.repository.listRecentAuditEvents(100),
      this.repository.listDeletionTombstones(100)
    ]);
    return adminAuditHistoryResponseSchema.parse({
      events: events.map((event) => auditEventResponseSchema.parse(event)),
      deletionTombstones: deletionTombstones.map((tombstone) =>
        deletionTombstoneResponseSchema.parse(tombstone)
      )
    });
  }

  async permanentlyDelete(
    id: string,
    input: PermanentlyDeleteSermonInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ) {
    assertMayPermanentlyDelete(identity);
    return this.repository.transaction(async (transaction) => {
      const sermon = await transaction.findSermonForUpdate(id);
      if (!sermon) notFound("Sermon was not found");
      if (sermon.rowVersion !== input.rowVersion) conflict();
      if (sermon.status !== "archived") {
        invalid("status", "A sermon must be archived before permanent deletion");
      }
      if (input.confirmation !== sermon.slug && input.confirmation !== sermon.title) {
        invalid("confirmation", "Confirmation must exactly match the sermon slug or title");
      }

      const wasPreviouslyPublished = sermon.publishedAt !== null;
      if (wasPreviouslyPublished && input.seoDisposition === null) {
        invalid(
          "seoDisposition",
          "A previously published sermon requires a redirect or gone disposition"
        );
      }
      if (!wasPreviouslyPublished && input.seoDisposition !== null) {
        invalid(
          "seoDisposition",
          "A never-published sermon must not create a public URL disposition"
        );
      }
      if (input.seoDisposition?.kind === "redirect") {
        const targetIsValid = await transaction.validateRedirectTarget(
          input.seoDisposition.targetPath,
          id
        );
        if (!targetIsValid) {
          invalid(
            "seoDisposition.targetPath",
            "Redirect target must be a different currently published sermon path"
          );
        }
      }

      if (input.seoDisposition) {
        await transaction.recordDeletionDisposition(
          id,
          sermon.slug,
          input.seoDisposition,
          input.reason
        );
      }
      await transaction.insertDeletionTombstone({
        formerSermonId: id,
        formerSlug: sermon.slug,
        actorSubject: identity.subject,
        reason: input.reason,
        wasPreviouslyPublished,
        seoDisposition: input.seoDisposition,
        requestCorrelationId
      });
      await transaction.appendAudit(
        successfulAudit(
          identity,
          "sermon.permanent_delete",
          "sermon",
          id,
          input.seoDisposition ? ["permanentDeletion", "seoDisposition"] : ["permanentDeletion"],
          requestCorrelationId
        )
      );
      await transaction.deleteSermon(id);

      return permanentDeletionResultSchema.parse({
        deleted: true,
        sermonId: id,
        formerSlug: sermon.slug,
        seoDisposition: input.seoDisposition
      });
    });
  }
}
