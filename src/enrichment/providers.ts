import type { EnrichmentDraftBundle } from "./contracts";

export interface TranscriptDraftRequest {
  sourceWordPressId: number;
  sermonTitle: string;
  controlledMediaUrls: string[];
}

export interface TranscriptDraftProvider {
  readonly providerName: string;
  prepareDraft(request: TranscriptDraftRequest): Promise<EnrichmentDraftBundle["transcript"]>;
}

export interface DescriptionDraftRequest {
  sourceWordPressId: number;
  sermonTitle: string;
  transcriptBody: string;
  scriptureReferences: string[];
}

export interface DescriptionDraftProvider {
  readonly providerName: string;
  prepareDraft(request: DescriptionDraftRequest): Promise<EnrichmentDraftBundle["description"]>;
}

export interface QuestionAnswerDraftRequest {
  sourceWordPressId: number;
  sermonTitle: string;
  transcriptBody: string;
  scriptureReferences: string[];
}

export interface QuestionAnswerDraftProvider {
  readonly providerName: string;
  prepareDrafts(
    request: QuestionAnswerDraftRequest
  ): Promise<EnrichmentDraftBundle["questionAnswers"]>;
}

// Deliberately interfaces only. Provider selection, credentials, network access,
// cost approval, description/transcript/Q&A generation and human review belong to a separately
// authorised milestone.
