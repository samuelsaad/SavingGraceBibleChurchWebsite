export type ScriptureSourceKind = "postmeta" | "taxonomy";

export interface ScriptureSource {
  kind: ScriptureSourceKind;
  originalValue: string;
  sourceTermId?: number;
  sourceTermTaxonomyId?: number;
}

export interface TransformedScriptureReference {
  displayText: string;
  parseStatus: "unparsed" | "exact" | "unresolved";
  sources: ScriptureSource[];
}

export interface ScriptureTransformResult {
  references: TransformedScriptureReference[];
  warningCodes: Array<"scripture_source_conflict" | "scripture_single_source">;
}

function present(value: string | null | undefined): string | null {
  return value && value.trim() ? value : null;
}

export function transformScripture(
  postmetaValue: string | null | undefined,
  taxonomySources: ScriptureSource[]
): ScriptureTransformResult {
  const meta = present(postmetaValue);
  const taxonomy = taxonomySources.filter((source) => present(source.originalValue));

  if (!meta && taxonomy.length === 0) return { references: [], warningCodes: [] };

  const metaSource: ScriptureSource | null = meta
    ? { kind: "postmeta", originalValue: meta }
    : null;

  if (metaSource && taxonomy.length === 1 && meta === taxonomy[0]?.originalValue) {
    return {
      references: [
        {
          displayText: meta,
          parseStatus: "exact",
          sources: [metaSource, taxonomy[0]]
        }
      ],
      warningCodes: []
    };
  }

  const references: TransformedScriptureReference[] = [];
  if (metaSource) {
    references.push({
      displayText: metaSource.originalValue,
      parseStatus: taxonomy.length > 0 ? "unresolved" : "unparsed",
      sources: [metaSource]
    });
  }
  for (const source of taxonomy) {
    references.push({
      displayText: source.originalValue,
      parseStatus: metaSource ? "unresolved" : "unparsed",
      sources: [source]
    });
  }

  return {
    references,
    warningCodes:
      metaSource && taxonomy.length > 0
        ? ["scripture_source_conflict"]
        : ["scripture_single_source"]
  };
}
