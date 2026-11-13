/**
 * An error code `validate*` can report.
 */
export enum DiagnosticCode {
  TextTextEmpty = 'text.text.empty',
  TextTokenExtraKeyEmpty = 'text.token.extra.key.empty',
  TimeRangeEndBeforeStart = 'time.range.end.before_start',
  TimeRangeStartInvalid = 'time.range.start.invalid',
  TimeRangeEndInvalid = 'time.range.end.invalid',
  TimeRangeStartOverflow = 'time.range.start.overflow',
  TimeRangeEndOverflow = 'time.range.end.overflow',
  WordTypeUnspecified = 'word.type.unspecified',
  WordTextEmpty = 'word.text.empty',
  WordTextSeparator = 'word.text.separator',
  WordTextNotSeparator = 'word.text.not_separator',
  AgentIdEmpty = 'agent.id.empty',
  AgentRawMissing = 'agent.raw.missing',
  AgentTypeUnspecified = 'agent.type.unspecified',
  AgentNamesLanguageDuplicate = 'agent.names.language.duplicate',
  PartRawMissing = 'part.raw.missing',
  PartTypeUnspecified = 'part.type.unspecified',
  MetaCreditRawMissing = 'meta.credit.raw.missing',
  MetaCreditRoleUnspecified = 'meta.credit.role.unspecified',
  MetaOffsetInvalid = 'meta.offset.invalid',
  MetaOffsetOverflow = 'meta.offset.overflow',
  MetaDurationInvalid = 'meta.duration.invalid',
  MetaDurationOverflow = 'meta.duration.overflow',
  MetaIsrcsMalformed = 'meta.isrcs.malformed',
  MetaTitlesLanguageDuplicate = 'meta.titles.language.duplicate',
  MetaAlbumsLanguageDuplicate = 'meta.albums.language.duplicate',
  MetaReferencesPlatformDuplicate = 'meta.references.platform.duplicate',
  MetaReferencePlatformEmpty = 'meta.reference.platform.empty',
  MetaReferenceIdsEmpty = 'meta.reference.ids.empty',
  LanguageUsageTagEmpty = 'language.usage.tag.empty',
  LanguageTagMalformed = 'language.tag.malformed',
  LanguageUsageLineCountInvalid = 'language.usage.line_count.invalid',
  LanguageUsageLineCountOverflow = 'language.usage.line_count.overflow',
  LineTypeUnspecified = 'line.type.unspecified',
  LinePartInterludeNotInstrumental = 'line.part.interlude.not_instrumental',
  LineTimeMissing = 'line.time.missing',
  LineTimeEndMissing = 'line.time.end.missing',
  LineTimeEmpty = 'line.time.empty',
  LineBackgroundsUnordered = 'line.backgrounds.unordered',
  LineAgentIdsUnexpected = 'line.agent_ids.unexpected',
  LineLanguagesUnexpected = 'line.languages.unexpected',
  LineLanguagesDuplicate = 'line.languages.duplicate',
  LineAnnotationUnexpected = 'line.annotation.unexpected',
  LineAnnotationRomansDuplicate = 'line.annotation.romans.duplicate',
  LineAnnotationRomansConflict = 'line.annotation.romans.conflict',
  LineAnnotationRomanContentMissing = 'line.annotation.roman.content.missing',
  LineAnnotationRomanContentAmbiguous = 'line.annotation.roman.content.ambiguous',
  LineAnnotationRomanContentTextEmpty = 'line.annotation.roman.content.text.empty',
  LineAnnotationRomanContentTokensTimeMissing = 'line.annotation.roman.content.tokens.time.missing',
  LineAnnotationRomanTokenTextEmpty = 'line.annotation.roman.token.text.empty',
  LineAnnotationRomanTimeUncovered = 'line.annotation.roman.time.uncovered',
  LineAnnotationTranslationsLanguageDuplicate = 'line.annotation.translations.language.duplicate',
  LineBackgroundsUnexpected = 'line.backgrounds.unexpected',
  LineBackgroundsTimeUncovered = 'line.backgrounds.time.uncovered',
  LineContentMissing = 'line.content.missing',
  LineContentAmbiguous = 'line.content.ambiguous',
  LineContentUnexpected = 'line.content.unexpected',
  LineContentTextEmpty = 'line.content.text.empty',
  LineWordTimeMissing = 'line.word.time.missing',
  LineWordTimeUncovered = 'line.word.time.uncovered',
  LineWordTimeUnexpected = 'line.word.time.unexpected',
  LineWordLanguageUnexpected = 'line.word.language.unexpected',
  LineWordAnnotationUnexpected = 'line.word.annotation.unexpected',
  LineWordAnnotationTimeUncovered = 'line.word.annotation.time.uncovered',
  LineWordAnnotationRubiesDuplicate = 'line.word.annotation.rubies.duplicate',
  LineWordAnnotationRomansDuplicate = 'line.word.annotation.romans.duplicate',
  LineWordAnnotationTranslationsLanguageDuplicate = 'line.word.annotation.translations.language.duplicate',
  LineWordEmphasisUnexpected = 'line.word.emphasis.unexpected',
  LineWordEmphasisValueMissing = 'line.word.emphasis.value.missing',
  LyricVersionMalformed = 'lyric.version.malformed',
  LyricStatusUnspecified = 'lyric.status.unspecified',
  LyricTimingUnspecified = 'lyric.timing.unspecified',
  LyricAgentIdDuplicate = 'lyric.agent.id.duplicate',
  LyricLineAgentDangling = 'lyric.line.agent.dangling',
  LyricLineIdDuplicate = 'lyric.line.id.duplicate',
  LyricPartMismatch = 'lyric.part.mismatch',
  LyricPartIdReused = 'lyric.part.id.reused',
  LyricPartInterludeTrailing = 'lyric.part.interlude.trailing',
  LyricLineTimeEndMissing = 'lyric.line.time.end.missing',
  LyricLinesUnordered = 'lyric.lines.unordered',
  LyricLanguageUsagesTagDuplicate = 'lyric.language_usages.tag.duplicate',
  LyricLanguageUsagesMismatch = 'lyric.language_usages.mismatch',
  LyricListEntryEmpty = 'lyric.list.entry.empty',
  LyricTimingNonePresent = 'lyric.timing.none.present',
  LyricTimingNoneWords = 'lyric.timing.none.words',
  LyricTimingNoneInstrumental = 'lyric.timing.none.instrumental',
  LyricTimingLineWords = 'lyric.timing.line.words',
  LyricTimingLineTimeMissing = 'lyric.timing.line.time_missing',
  LyricTimingWordMissing = 'lyric.timing.word.missing',
}

/**
 * A model violation located relative to the validated input or its supplied path prefix.
 */
export interface Diagnostic {
  path: string
  code: DiagnosticCode
}

/**
 * Resolves a diagnostic path against the node it was reported from, returning the value located there.
 * Field segments use `field` or `field[n]`; a root array may start with `[n]`.
 * It returns undefined when a segment names an unset field or runs past a list, so a diagnostic about an absent field yields undefined there.
 */
export const resolveDiagnosticPath = (root: unknown, path: string): unknown => {
  if (path === '') {
    return root
  }
  let node: unknown = root
  const segments = path.split('.')
  for (const [i, segment] of segments.entries()) {
    const rootIndex = i === 0 ? /^\[(\d+)\]$/.exec(segment) : null
    if (rootIndex !== null && rootIndex[0] === segment) {
      node = Array.isArray(node) ? node[Number(rootIndex[1])] : undefined
      continue
    }
    const match = /^([$A-Za-z_][$\w]*)(?:\[(\d+)\])?$/.exec(segment)
    if (match === null || match[0] !== segment || node === null || typeof node !== 'object') {
      return undefined
    }
    node = (node as Record<string, unknown>)[match[1]!]
    if (match[2] !== undefined) {
      node = Array.isArray(node) ? node[Number(match[2])] : undefined
    }
  }
  return node
}
