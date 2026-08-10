export type TranscriptAssociationFailure =
  | "missing"
  | "ambiguous"
  | "stale"
  | "blank"
  | "unchanged";

export class TranscriptAssociationError extends Error {
  constructor(
    public readonly reason: TranscriptAssociationFailure,
    message: string
  ) {
    super(message);
  }
}

type TranscriptParagraph = {
  text: string;
  separatorAfter: string;
};

function splitTranscript(value: string): TranscriptParagraph[] {
  const paragraphs: TranscriptParagraph[] = [];
  const separator = /\n\s*\n/gu;
  let start = 0;
  for (const match of value.matchAll(separator)) {
    const index = match.index;
    if (index === undefined) continue;
    paragraphs.push({
      text: value.slice(start, index),
      separatorAfter: match[0]
    });
    start = index + match[0].length;
  }
  paragraphs.push({ text: value.slice(start), separatorAfter: "" });
  return paragraphs;
}

function exactParagraphIndexes(
  paragraphNumbers: readonly number[],
  paragraphCount: number
): number[] {
  if (!paragraphNumbers.length) {
    throw new TranscriptAssociationError(
      "missing",
      "The finding has no associated transcript paragraphs."
    );
  }
  const unique = new Set(paragraphNumbers);
  const ordered = paragraphNumbers.every(
    (paragraphNumber, index) => index === 0 || paragraphNumber > paragraphNumbers[index - 1]!
  );
  if (unique.size !== paragraphNumbers.length || !ordered) {
    throw new TranscriptAssociationError(
      "ambiguous",
      "The finding has a duplicated or ambiguous transcript association."
    );
  }
  const indexes = paragraphNumbers.map((paragraphNumber) => paragraphNumber - 1);
  if (indexes.some((index) => index < 0 || index >= paragraphCount)) {
    throw new TranscriptAssociationError(
      "missing",
      "The associated transcript wording is missing from this transcript version."
    );
  }
  return indexes;
}

export function associatedTranscriptWording(
  transcript: string,
  paragraphNumbers: readonly number[]
): string {
  const paragraphs = splitTranscript(transcript);
  const indexes = exactParagraphIndexes(paragraphNumbers, paragraphs.length);
  const selected = indexes.map((index) => paragraphs[index]!.text);
  if (selected.some((paragraph) => !paragraph.trim())) {
    throw new TranscriptAssociationError(
      "missing",
      "The associated transcript wording is blank in this transcript version."
    );
  }
  return selected.join("\n\n");
}

export function applyAssociatedTranscriptCorrection(input: {
  transcript: string;
  paragraphNumbers: readonly number[];
  expectedOriginalWording: string;
  correctedWording: string;
}): { bodyText: string; originalWording: string; correctedWording: string } {
  const paragraphs = splitTranscript(input.transcript);
  const indexes = exactParagraphIndexes(input.paragraphNumbers, paragraphs.length);
  const originalWording = indexes.map((index) => paragraphs[index]!.text).join("\n\n");
  if (input.expectedOriginalWording !== originalWording) {
    throw new TranscriptAssociationError(
      "stale",
      "The associated transcript wording has changed; reload this finding and try again."
    );
  }
  if (!input.correctedWording.trim()) {
    throw new TranscriptAssociationError("blank", "Corrected transcript wording cannot be blank.");
  }
  if (input.correctedWording.trim() === originalWording.trim()) {
    throw new TranscriptAssociationError(
      "unchanged",
      "Corrected transcript wording must be materially different."
    );
  }
  const replacements = splitTranscript(input.correctedWording);
  if (
    replacements.length !== indexes.length ||
    replacements.some((paragraph) => !paragraph.text.trim())
  ) {
    throw new TranscriptAssociationError(
      "ambiguous",
      "Keep the same associated paragraph boundaries so other findings remain exact."
    );
  }
  indexes.forEach((paragraphIndex, replacementIndex) => {
    paragraphs[paragraphIndex]!.text = replacements[replacementIndex]!.text;
  });
  return {
    bodyText: paragraphs.map((paragraph) => paragraph.text + paragraph.separatorAfter).join(""),
    originalWording,
    correctedWording: input.correctedWording
  };
}
