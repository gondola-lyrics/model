/**
 * An error code `validate*` can report.
 */
export enum DiagnosticCode {
  TimeRangeEndBeforeStart = 'time.range.end.before_start',
  TimeRangeStartOverflow = 'time.range.start.overflow',
  TimeRangeEndOverflow = 'time.range.end.overflow',
  WordContentEmpty = 'word.content.empty',
  AgentIdEmpty = 'agent.id.empty',
  AgentRawMissing = 'agent.raw.missing',
  PartRawMissing = 'part.raw.missing',
  MetaCreditRawMissing = 'meta.credit.raw.missing',
  LineWordsEmpty = 'line.words.empty',
  LineWordTimeUncovered = 'line.word.time.uncovered',
  LyricVersionMalformed = 'lyric.version.malformed',
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
