import { createHash } from "node:crypto";
import {
  lexicalWordOffsets,
  type GroundingSupport,
} from "../../src/enrichment/sermon-enrichment-contracts";
import {
  seventhFixedBatchDecisionId,
  seventhFixedBatchManifestSha256,
  seventhFixedBatchAudioWarning,
  seventhFixedBatchDraftArtifactSchema,
  seventhFixedBatchDraftArtifactSha256,
  seventhFixedBatchOutputSha256,
  type SeventhFixedBatchAuthorization,
} from "../../src/enrichment/seventh-fixed-batch";

// Entirely invented workshop material. No church/source content is used.
export const fixtureHash = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export function seventhBatchFixture(redacted = false) {
  const paragraphs = [
    "Our invented workshop considers patient listening during disagreements. Neighbours should make room for one another instead of answering before an explanation is finished. Listening requires attention to the actual concern, not merely preparing a reply. A rushed judgment can miss important details and make a small disagreement worse. Asking a sincere question gives someone an opportunity to explain the difficulty. Patience does not require accepting every claim as true. It requires understanding the claim before answering it. A pause can help a listener separate what was said from an anxious assumption.",
    "Practical care begins with small, reliable actions rather than impressive promises. A neighbour who offers help should ask what assistance would actually be useful. Keeping a modest commitment builds trust, while agreeing to an unrealistic task can leave another person disappointed. Honest limits matter because dependable care cannot rest on concealed resentment. Shared responsibility allows several neighbours to contribute without expecting one person to solve every difficulty. Correcting a misunderstanding politely protects both truth and the relationship. When plans change, a clear explanation helps others adjust without unnecessary confusion.",
    "The workshop invites participants to practise these habits during an ordinary week. They can listen without interruption, ask a clarifying question and choose one manageable act of care. Later reflection should consider whether the action met the neighbour's stated need. A mistake need not end the relationship when it is acknowledged honestly and followed by a suitable correction. Trust grows through consistency over time, not through a single dramatic gesture. Unresolved disagreements may need another conversation rather than an immediate forced conclusion. These examples are fictional and make no claim about any real person or event.",
  ];
  if (redacted)
    paragraphs[2] += " One retained [ __ ] marker remains unresolved.";
  const transcript = paragraphs.join("\n\n");
  const words = lexicalWordOffsets(transcript);
  function support(
    part: GroundingSupport["outputPart"],
    index: number,
    paragraph: number,
    purpose: GroundingSupport["purpose"],
  ): GroundingSupport {
    const start = paragraphs
      .slice(0, paragraph - 1)
      .reduce((sum, p) => sum + p.length + 2, 0);
    const end = start + paragraphs[paragraph - 1]!.length;
    const selected = words
      .map((w, i) => ({ ...w, i: i + 1 }))
      .filter((w) => w.start >= start && w.end <= end);
    return {
      outputPart: part,
      outputIndex: index,
      paragraphNumber: paragraph,
      characterStart: start,
      characterEnd: end,
      wordStart: selected[0]!.i,
      wordEnd: selected.at(-1)!.i,
      supportSha256: fixtureHash(transcript.slice(start, end)),
      purpose,
    };
  }
  const description = [
    "Patient listening and dependable practical care are the focus of this fictional workshop. Disagreements become harder when people rush to judge before understanding another person's concern. Attentive listening creates space for explanation, while sincere questions help distinguish the actual problem from assumptions. Patience is presented as a way to understand a claim carefully, not a demand to agree with everything that is said. Pausing before answering can prevent anxiety from directing the conversation and turning a manageable difference into deeper conflict.",
    "The practical response is deliberately modest: offer useful help, keep realistic commitments and communicate limits honestly. Trust develops when neighbours follow through consistently rather than making impressive promises they cannot keep. Shared responsibility also prevents care from becoming an unreasonable burden on one person. Participants are encouraged to try an uninterrupted conversation, a clarifying question and one manageable action during the week. Reflection then asks whether that action addressed the need the neighbour actually expressed. Mistakes call for honest acknowledgement and an appropriate correction, while unresolved disagreements may require further conversation. The emphasis remains on reliable habits that protect relationships without avoiding truth, uncertainty or personal limits.",
  ].join("\n\n");
  const pairs = [
    [
      "Why can a rushed reply deepen a disagreement?",
      "A rushed judgment may miss the neighbour's actual concern and replace understanding with anxious assumptions, increasing conflict rather than resolving it.",
      1,
    ],
    [
      "Does patient listening require agreement with every claim?",
      "Patience requires careful understanding before answering, but it does not demand that a listener accept every claim as true.",
      1,
    ],
    [
      "How do realistic commitments help neighbours build trust?",
      "A modest promise that is kept provides dependable care, whereas an unrealistic offer can disappoint someone who relied on it.",
      2,
    ],
    [
      "Why should practical help include honest personal limits?",
      "Honest limits keep assistance realistic and reduce concealed resentment, while shared responsibility prevents one neighbour from carrying every difficulty alone.",
      2,
    ],
    [
      "Which small habits can participants practise during the week?",
      "Participants can listen without interruption, ask a clarifying question and choose manageable care that responds to the neighbour's stated need.",
      3,
    ],
    [
      "How should a mistake affect an ongoing relationship?",
      "A mistake calls for honest acknowledgement and a suitable correction rather than automatic abandonment of the relationship or denial of responsibility.",
      3,
    ],
    [
      "When might another conversation be more useful than immediate agreement?",
      "Unresolved disagreements may require further conversation because forcing a conclusion can overlook uncertainty and the need for continued patient understanding.",
      3,
    ],
  ] as const;
  const authorization: SeventhFixedBatchAuthorization = {
    decisionId: seventhFixedBatchDecisionId,
    manifestSha256: seventhFixedBatchManifestSha256,
    governanceCommitHash: "a".repeat(40),
    orderedRecords: Array.from({ length: 36 }, (_, i) => ({
      sequence: i + 1,
      sourceWordPressId: 880000 + i,
      videoId: `F${String(i).padStart(10, "0")}`,
      publicationStatus: "publish",
      serviceDate: "2025-01-05",
      inventoryRowSha256: "a".repeat(64),
      mappingRecordSha256: "b".repeat(64),
      channelOwnershipCorroboratedByExistingEvidence: true,
    })),
  };
  const content = {
    description: {
      bodyText: description,
      centralSubject: "Patient listening and dependable practical care.",
      application:
        "Keep realistic commitments and communicate limits honestly.",
      supports: [
        support("description_paragraph", 1, 1, "subject"),
        support("description_paragraph", 2, 2, "application"),
        support("description_paragraph", 2, 3, "application"),
      ],
    },
    questionAnswers: pairs.map(([question, answer, p], i) => ({
      displayOrder: i + 1,
      question,
      answer,
      supports: [support("question_answer", i + 1, p, "answer_support")],
    })),
  };
  const sourceHash = fixtureHash(transcript),
    at = "2026-09-15T00:00:00.000Z";
  const artifact = seventhFixedBatchDraftArtifactSchema.parse({
    schemaVersion: 1,
    privateContent: true,
    exceptionId: "D-162",
    decisionId: "D-162",
    batchManifestSha256: seventhFixedBatchManifestSha256,
    target: { sequence: 1, sourceWordPressId: 880000, videoId: "F0000000000" },
    transcript: {
      groundingRevisionId: "99999999-9999-4999-8999-999999999159",
      rowVersion: 1,
      sourceTranscriptSha256: sourceHash,
      sourceTranscriptApprovalStateAtGeneration: "unapproved",
    },
    requiresAdministratorReview: true,
    transcriptApprovalRequiredBeforeDependentApproval: true,
    approvalState: "draft",
    publicVisibility: "private",
    searchEligible: false,
    feedEligible: false,
    sitemapEligible: false,
    semanticEligible: false,
    productionBuildEligible: false,
    captionAudioAssociation: {
      decision: "D-162",
      manifestSha256: seventhFixedBatchManifestSha256,
      audioTrackType: "unknown",
      primaryAudioConfirmed: false,
      acceptedUnderBoundedException: true,
      warning: seventhFixedBatchAudioWarning,
    },
    generator: {
      provider: "OpenAI",
      executionSurface: "Codex",
      executionMode: "interactive Codex session",
      selectedModelLabel: "gpt-5.6-sol",
      selectionAuthorityReference: "SAMUEL-CODEX-D162-SOL-SELECTION-2026-09-19",
      model: { value: null, unavailableReason: "not_exposed_by_runtime" },
      validationSelectedModelLabel: "gpt-5.6-sol",
      validationRuntimeModel: {
        value: null,
        unavailableReason: "not_exposed_by_runtime",
      },
      separatelyBilledApiUsed: false,
      workspacePrivacyAndRetention: "not_exposed_by_runtime",
      tokenCount: "not_exposed_by_runtime",
      candidateSha256: fixtureHash(JSON.stringify(content)),
      correction: null,
      immutableRevision: {
        value: null,
        unavailableReason: "not_exposed_by_runtime",
      },
      sessionOrRunIdentifier: {
        value: null,
        unavailableReason: "not_exposed_by_runtime",
      },
      availableGenerationSettings: ["anonymised_fixture"],
      generatedAt: at,
      governanceCommitHash: authorization.governanceCommitHash,
      batchManifestSha256: seventhFixedBatchManifestSha256,
      promptOrProcessingVersionSha256: "c".repeat(64),
      sourceTranscriptSha256: sourceHash,
      outputSha256: seventhFixedBatchOutputSha256(content),
      retryCount: 0,
      externalGenerativeApiCostAud: 0,
    },
    warnings: [
      "MODEL_REVISION_UNAVAILABLE_LIMITED_REPRODUCIBILITY",
      seventhFixedBatchAudioWarning,
    ],
    content,
    integrity: { canonicalSha256: "0".repeat(64) },
  });
  artifact.integrity.canonicalSha256 =
    seventhFixedBatchDraftArtifactSha256(artifact);
  const metadata = {
    title: "Anonymised Listening Workshop",
    serviceDate: "2025-01-05",
    captionId: "invented-caption",
    captionLanguage: "en" as const,
    captionTrackKind: "asr" as const,
    captionSourceSha256: fixtureHash("invented raw source"),
    captionFilename: "fixture.vtt",
    captionCharacterCount: transcript.length,
    transcriptCharacterCount: transcript.length,
    transcriptWordCount: words.length,
    apparentCompleteness: "requires_manual_review" as const,
    importedAt: at,
    processedAt: at,
  };
  return { authorization, artifact, transcript, metadata };
}
