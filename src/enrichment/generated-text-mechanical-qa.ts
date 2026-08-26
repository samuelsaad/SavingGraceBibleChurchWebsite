export const generatedTextMechanicalQaVersion = "generated-text-mechanical-qa-v1" as const;

export type GeneratedTextContentArea = "description" | "question" | "answer";
export type GeneratedTextMechanicalIssueSeverity = "blocking" | "review";

export type GeneratedTextMechanicalIssueCode =
  | "jesus_incorrect_capitalisation"
  | "christ_incorrect_capitalisation"
  | "sentence_initial_lowercase"
  | "repeated_spacing"
  | "space_before_punctuation"
  | "duplicated_punctuation"
  | "broken_sentence_join"
  | "possible_caption_fragment"
  | "biblical_name_or_book_capitalisation"
  | "contextual_divine_term_capitalisation"
  | "inconsistent_name_or_place_spelling";

export interface GeneratedTextMechanicalIssue {
  code: GeneratedTextMechanicalIssueCode;
  severity: GeneratedTextMechanicalIssueSeverity;
  contentArea: GeneratedTextContentArea;
  itemIndex: number | null;
  characterIndex: number;
  autoCorrectable: boolean;
}

export interface GeneratedTextMechanicalQaReport {
  version: typeof generatedTextMechanicalQaVersion;
  completed: true;
  outcome: "passed" | "passed_with_review_flags" | "failed";
  blockingIssueCount: number;
  reviewIssueCount: number;
  issues: GeneratedTextMechanicalIssue[];
}

export interface GeneratedQuestionAnswerText {
  question: string;
  answer: string;
}

interface TextInspectionTarget {
  text: string;
  contentArea: GeneratedTextContentArea;
  itemIndex: number | null;
}

const canonicalCapitalisation = [
  { canonical: "Jesus", code: "jesus_incorrect_capitalisation" as const },
  { canonical: "Christ", code: "christ_incorrect_capitalisation" as const }
];

const contextSensitiveDivineTerms = ["god", "spirit", "scripture"];

const bibleBooks = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "Samuel", "Kings", "Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
  "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah",
  "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "Corinthians", "Galatians",
  "Ephesians", "Philippians", "Colossians", "Thessalonians", "Timothy", "Titus", "Philemon",
  "Hebrews", "James", "Peter", "Jude", "Revelation"
] as const;

const unambiguousBiblicalProperNames = [
  "Jerusalem", "Bethlehem", "Galilee", "Nazareth", "Moses", "Abraham", "David", "Paul"
] as const;

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function issue(
  target: TextInspectionTarget,
  code: GeneratedTextMechanicalIssueCode,
  severity: GeneratedTextMechanicalIssueSeverity,
  characterIndex: number,
  autoCorrectable: boolean
): GeneratedTextMechanicalIssue {
  return {
    code,
    severity,
    contentArea: target.contentArea,
    itemIndex: target.itemIndex,
    characterIndex,
    autoCorrectable
  };
}

function findAll(text: string, pattern: RegExp): RegExpMatchArray[] {
  return [...text.matchAll(pattern)];
}

function inspectTarget(target: TextInspectionTarget): GeneratedTextMechanicalIssue[] {
  const findings: GeneratedTextMechanicalIssue[] = [];
  for (const entry of canonicalCapitalisation) {
    const pattern = new RegExp(`\\b${escapePattern(entry.canonical)}\\b`, "giu");
    for (const match of findAll(target.text, pattern)) {
      if (match[0] !== entry.canonical) {
        findings.push(issue(target, entry.code, "blocking", match.index!, true));
      }
    }
  }

  for (const match of findAll(target.text, /[ \t]{2,}/gu)) {
    findings.push(issue(target, "repeated_spacing", "blocking", match.index!, true));
  }
  for (const match of findAll(target.text, /[ \t]+[,.!?;:]/gu)) {
    findings.push(issue(target, "space_before_punctuation", "blocking", match.index!, true));
  }
  for (const match of findAll(target.text, /(?:,,|;;|::|!!|\.\.\.\.)/gu)) {
    findings.push(issue(target, "duplicated_punctuation", "blocking", match.index!, false));
  }
  for (const match of findAll(target.text, /(?:[!?]["'’)]?|\b[a-z]{3,}\.)(?=[\p{L}])/gu)) {
    findings.push(issue(target, "broken_sentence_join", "blocking", match.index! + match[0].length, false));
  }

  const sentenceStartPattern = /(?:^|[.!?]["'’)]*\s+|\n\s*)([a-z][\p{L}'’]*)/gmu;
  for (const match of findAll(target.text, sentenceStartPattern)) {
    const word = match[1]!;
    if (word === "e.g" || word === "i.e") continue;
    const index = match.index! + match[0].lastIndexOf(word);
    if (!findings.some((item) => item.characterIndex === index &&
      (item.code === "jesus_incorrect_capitalisation" || item.code === "christ_incorrect_capitalisation"))) {
      findings.push(issue(target, "sentence_initial_lowercase", "blocking", index, false));
    }
  }

  if (target.contentArea !== "question") {
    const trimmed = target.text.trim();
    if (trimmed.length > 0 && !/[.!?]["'’)]*$/u.test(trimmed)) {
      findings.push(issue(target, "possible_caption_fragment", "review", Math.max(0, target.text.length - 1), false));
    }
    for (const match of findAll(target.text, /(?:^|[.!?]\s+)([^.!?]{1,80}[.!?])/gmu)) {
      const wordCount = match[1]!.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
      if (wordCount > 0 && wordCount < 4) {
        findings.push(issue(target, "possible_caption_fragment", "review", match.index!, false));
      }
    }
  }

  for (const term of contextSensitiveDivineTerms) {
    const pattern = new RegExp(`\\b${term}\\b`, "gu");
    for (const match of findAll(target.text, pattern)) {
      findings.push(issue(target, "contextual_divine_term_capitalisation", "review", match.index!, false));
    }
  }

  for (const canonical of bibleBooks) {
    const lower = canonical.toLocaleLowerCase("en-AU");
    const pattern = new RegExp(
      `(?:\\b(?:book of|from|in)\\s+${escapePattern(lower)}\\b|\\b${escapePattern(lower)}\\b(?=\\s+\\d))`,
      "gu"
    );
    for (const match of findAll(target.text, pattern)) {
      findings.push(issue(target, "biblical_name_or_book_capitalisation", "review", match.index!, false));
    }
  }

  for (const canonical of unambiguousBiblicalProperNames) {
    const lower = canonical.toLocaleLowerCase("en-AU");
    const pattern = new RegExp(`\\b${escapePattern(lower)}\\b`, "gu");
    for (const match of findAll(target.text, pattern)) {
      findings.push(issue(target, "biblical_name_or_book_capitalisation", "review", match.index!, false));
    }
  }

  for (const canonical of [...bibleBooks, ...unambiguousBiblicalProperNames]) {
    const exact = new RegExp(`\\b${escapePattern(canonical)}\\b`, "gu");
    if (!exact.test(target.text)) continue;
    const first = canonical.slice(0, -1);
    if (first.length < 4) continue;
    const inconsistent = new RegExp(`\\b${escapePattern(first)}[a-z]\\b`, "gu");
    for (const match of findAll(target.text, inconsistent)) {
      if (match[0] !== canonical) {
        findings.push(issue(target, "inconsistent_name_or_place_spelling", "review", match.index!, false));
      }
    }
  }

  return findings.sort((left, right) => left.characterIndex - right.characterIndex || left.code.localeCompare(right.code));
}

export function inspectGeneratedText(
  description: string,
  questionAnswers: readonly GeneratedQuestionAnswerText[]
): GeneratedTextMechanicalQaReport {
  const targets: TextInspectionTarget[] = [
    { text: description, contentArea: "description", itemIndex: null },
    ...questionAnswers.flatMap((item, index): TextInspectionTarget[] => [
      { text: item.question, contentArea: "question", itemIndex: index },
      { text: item.answer, contentArea: "answer", itemIndex: index }
    ])
  ];
  const issues = targets.flatMap(inspectTarget);
  const blockingIssueCount = issues.filter((item) => item.severity === "blocking").length;
  const reviewIssueCount = issues.length - blockingIssueCount;
  return {
    version: generatedTextMechanicalQaVersion,
    completed: true,
    outcome: blockingIssueCount > 0 ? "failed" : reviewIssueCount > 0 ? "passed_with_review_flags" : "passed",
    blockingIssueCount,
    reviewIssueCount,
    issues
  };
}

export interface MechanicalCorrectionResult {
  text: string;
  corrections: Partial<Record<GeneratedTextMechanicalIssueCode, number>>;
  correctionCount: number;
}

function replaceCounted(
  value: string,
  pattern: RegExp,
  replacement: string,
  code: GeneratedTextMechanicalIssueCode,
  corrections: Partial<Record<GeneratedTextMechanicalIssueCode, number>>
): string {
  return value.replace(pattern, (match) => {
    if (match === replacement) return match;
    corrections[code] = (corrections[code] ?? 0) + 1;
    return replacement;
  });
}

export function applyIndisputableMechanicalCorrections(value: string): MechanicalCorrectionResult {
  const corrections: Partial<Record<GeneratedTextMechanicalIssueCode, number>> = {};
  let text = value;
  text = replaceCounted(text, /\bjesus\b/giu, "Jesus", "jesus_incorrect_capitalisation", corrections);
  text = replaceCounted(text, /\bchrist\b/giu, "Christ", "christ_incorrect_capitalisation", corrections);
  text = text.replace(/[ \t]{2,}/gu, () => {
    corrections.repeated_spacing = (corrections.repeated_spacing ?? 0) + 1;
    return " ";
  });
  text = text.replace(/[ \t]+([,.!?;:])/gu, (_match, punctuation: string) => {
    corrections.space_before_punctuation = (corrections.space_before_punctuation ?? 0) + 1;
    return punctuation;
  });
  return {
    text,
    corrections,
    correctionCount: Object.values(corrections).reduce((sum, count) => sum + (count ?? 0), 0)
  };
}
