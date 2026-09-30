/**
 * An error code `validate*` can report.
 */
export enum DiagnosticCode {
  TimeRangeEndBeforeStart = 'time.range.end.before_start',
  TimeRangeStartInvalid = 'time.range.start.invalid',
  TimeRangeEndInvalid = 'time.range.end.invalid',
  TimeRangeStartOverflow = 'time.range.start.overflow',
  TimeRangeEndOverflow = 'time.range.end.overflow',
  WordTypeUnspecified = 'word.type.unspecified',
  WordTextEmpty = 'word.text.empty',
  AgentIdEmpty = 'agent.id.empty',
  AgentRawMissing = 'agent.raw.missing',
  AgentNamesLanguageDuplicate = 'agent.names.language.duplicate',
  PartRawMissing = 'part.raw.missing',
  MetaCreditRawMissing = 'meta.credit.raw.missing',
  MetaOffsetInvalid = 'meta.offset.invalid',
  MetaOffsetOverflow = 'meta.offset.overflow',
  MetaDurationInvalid = 'meta.duration.invalid',
  MetaDurationOverflow = 'meta.duration.overflow',
  MetaTitlesLanguageDuplicate = 'meta.titles.language.duplicate',
  MetaAlbumsLanguageDuplicate = 'meta.albums.language.duplicate',
  MetaReferencesPlatformDuplicate = 'meta.references.platform.duplicate',
  LanguageUsageTagEmpty = 'language.usage.tag.empty',
  LanguageUsageCountInvalid = 'language.usage.count.invalid',
  LanguageUsageCountOverflow = 'language.usage.count.overflow',
  LineTypeUnspecified = 'line.type.unspecified',
  LineTimeMissing = 'line.time.missing',
  LineAgentsUnexpected = 'line.agents.unexpected',
  LineLanguagesUnexpected = 'line.languages.unexpected',
  LineAnnotationUnexpected = 'line.annotation.unexpected',
  LineAnnotationRomansLanguageDuplicate = 'line.annotation.romans.language.duplicate',
  LineAnnotationTranslationsLanguageDuplicate = 'line.annotation.translations.language.duplicate',
  LineBackgroundsUnexpected = 'line.backgrounds.unexpected',
  LineBackgroundsTimeUncovered = 'line.backgrounds.time.uncovered',
  LineContentMissing = 'line.content.missing',
  LineContentAmbiguous = 'line.content.ambiguous',
  LineContentUnexpected = 'line.content.unexpected',
  LineWordTimeMissing = 'line.word.time.missing',
  LineWordTimeUncovered = 'line.word.time.uncovered',
  LineWordTimeUnexpected = 'line.word.time.unexpected',
  LineWordLanguageUnexpected = 'line.word.language.unexpected',
  LineWordAnnotationUnexpected = 'line.word.annotation.unexpected',
  LineWordAnnotationRubiesLanguageDuplicate = 'line.word.annotation.rubies.language.duplicate',
  LineWordAnnotationRomansLanguageDuplicate = 'line.word.annotation.romans.language.duplicate',
  LineWordAnnotationTranslationsLanguageDuplicate = 'line.word.annotation.translations.language.duplicate',
  LineWordEmphasisUnexpected = 'line.word.emphasis.unexpected',
  LyricVersionMalformed = 'lyric.version.malformed',
  LyricStatusUnspecified = 'lyric.status.unspecified',
  LyricAgentIdDuplicate = 'lyric.agent.id.duplicate',
  LyricLineAgentDangling = 'lyric.line.agent.dangling',
  LyricLineIdDuplicate = 'lyric.line.id.duplicate',
  LyricLanguageTagDuplicate = 'lyric.language.tag.duplicate',
  LyricTimingNonePresent = 'lyric.timing.none.present',
}

/**
 * A problem `validate*` reports, with `path` locating the offending message such as `lines[3].words[0]` and `code` naming the broken rule.
 */
export interface Diagnostic {
  path: string
  code: DiagnosticCode
}
