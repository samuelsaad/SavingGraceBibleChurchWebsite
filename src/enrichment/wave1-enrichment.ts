export const wave1EnrichmentProcessingVersion = "phase3b2c-wave1-extractive-drafts-v2" as const;

export interface PreparedWaveOneContent {
  transcript: string;
  description: string;
  questionAnswers: Array<{ question: string; answer: string }>;
  sourceWordCount: number;
  cleanedWordCount: number;
  sourceWordSequenceSha256: string;
  cleanedWordSequenceSha256: string;
  uncertaintyMarkers: Array<{ marker: string; safeReason: string }>;
  warnings: Array<{ code: string; safeDetail: string }>;
}

/**
 * Historical entry point retained only so old private provenance remains
 * intelligible. The extractive description/Q&A implementation was removed:
 * it must never fall back to ranked transcript fragments or fixed wrappers.
 */
export function prepareWaveOneContent(_bytes: Uint8Array): PreparedWaveOneContent {
  throw new Error(
    "mechanical_wave1_generation_retired: an explicitly approved text-generation model and grounded private workflow are required"
  );
}
