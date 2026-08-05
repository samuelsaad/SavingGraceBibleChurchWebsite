import {
  adminSermonDetailSchema,
  adminSermonListResponseSchema,
  adminAuditHistoryResponseSchema,
  auditEventResponseSchema,
  deletionTombstoneResponseSchema,
  permanentDeletionResultSchema,
  taxonomyResponseSchema,
  type AdminSermonDetail,
  type AdminSermonListQuery,
  type CreateSermonInput,
  type PermanentlyDeleteSermonInput,
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
import { conflict, invalid, notFound } from "./errors";
import { isFutureSchedule, transitionSermonStatus } from "./sermon-lifecycle";
import type {
  AdminSermonRepository,
  AuditEventInput,
  StoredSermonDetail,
  StoredSermonSummary,
  TaxonomyUpdateInput,
  TaxonomyWriteInput
} from "../server/repositories/admin-sermon-repository";

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
    speakers: sermon.speakers,
    series: sermon.series
  };
}

function sermonDetailDto(sermon: StoredSermonDetail): AdminSermonDetail {
  return adminSermonDetailSchema.parse({
    ...sermonSummaryDto(sermon),
    summary: sermon.summary,
    body: sermon.body,
    speakers: sermon.speakers,
    series: sermon.series,
    books: sermon.books,
    scriptureReferences: sermon.scriptureReferences,
    media: sermon.media
  });
}

function successfulAudit(
  identity: ApplicationIdentity,
  action: string,
  entityType: string,
  entityId: string,
  changedFields: string[],
  requestCorrelationId: string
): AuditEventInput {
  return {
    actorSubject: identity.subject,
    actorRole: identity.role,
    action,
    entityType,
    entityId,
    outcome: "succeeded",
    changedFields,
    requestCorrelationId
  };
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

  async create(
    input: CreateSermonInput,
    identity: ApplicationIdentity,
    requestCorrelationId: string
  ): Promise<AdminSermonDetail> {
    assertAdminAccess(identity);
    return this.repository.transaction(async (transaction) => {
      const invalidRelationship = await transaction.validateRelationshipIds(input);
      if (invalidRelationship) invalid(invalidRelationship, "One or more relationship IDs do not exist");
      const id = await transaction.insertSermon(input, identity.subject);
      await transaction.replaceRelationships(id, input);
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
            "body",
            "speakerIds",
            "seriesIds",
            "bookClassificationIds",
            "scriptureReferences",
            "media"
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
      const invalidRelationship = await transaction.validateRelationshipIds(input);
      if (invalidRelationship) invalid(invalidRelationship, "One or more relationship IDs do not exist");
      await transaction.updateSermon(id, input, identity.subject);
      await transaction.replaceRelationships(id, input);
      await transaction.refreshSearchTerms(id);
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
