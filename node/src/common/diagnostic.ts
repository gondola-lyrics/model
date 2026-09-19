/**
 * An error code `validate*` can report.
 */
export enum DiagnosticCode {
  TimeEndBeforeStart = 'time.end.before_start',
  TimeStartOverflow = 'time.start.overflow',
  TimeEndOverflow = 'time.end.overflow',
  WordContentEmpty = 'word.content.empty',
  AgentRawMissing = 'agent.raw.missing',
  PartRawMissing = 'part.raw.missing',
  MetaCreditRawMissing = 'meta.credit.raw.missing',
  LineWordsEmpty = 'line.words.empty',
  LyricVersionMalformed = 'lyric.version.malformed',
  LyricAgentIdDuplicate = 'lyric.agent.id.duplicate',
  LyricLineAgentDangling = 'lyric.line.agent.dangling',
  LyricTimingNonePresent = 'lyric.timing.none.present',
}

/**
 * A problem `validate*` reports, with `path` locating the offending message such as `lines[3].words[0]` and `code` naming the broken rule.
 */
export interface Diagnostic {
  path: string
  code: DiagnosticCode
}
