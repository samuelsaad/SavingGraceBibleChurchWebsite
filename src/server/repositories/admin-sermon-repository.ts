import type {
  AdminSermonListQuery,
  CreateSermonInput,
  DeletionSeoDisposition,
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
    }
  >;
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
    withApprovedDescription: number;
    withApprovedTranscript: number;
    withRequiredQuestionAnswers: number;
    withValidControlledMedia: number;
  };
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
  hasSermonOrTombstone(id: string): Promise<boolean>;
  listTaxonomies(kind: TaxonomyKind): Promise<TaxonomyDto[]>;
  listAuditEvents(sermonId: string): Promise<AuditEventDto[]>;
  listRecentAuditEvents(limit: number): Promise<AuditEventDto[]>;
  listDeletionTombstones(limit: number): Promise<DeletionTombstoneDto[]>;
}
