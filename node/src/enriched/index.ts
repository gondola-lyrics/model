export type {
  Lyric as EnrichedLyric,
  LanguageUsage as EnrichedLanguageUsage,
  Line as EnrichedLine,
  LineAnnotation as EnrichedLineAnnotation,
  LineAnnotationRoman as EnrichedLineAnnotationRoman,
  LineAnnotationRomanContent as EnrichedLineAnnotationRomanContent,
  LineAnnotationRomanToken as EnrichedLineAnnotationRomanToken,
  LineAnnotationTranslation as EnrichedLineAnnotationTranslation,
  LineBackground as EnrichedLineBackground,
  LineContent as EnrichedLineContent,
  Word as EnrichedWord,
  WordAnnotation as EnrichedWordAnnotation,
  WordAnnotationRoman as EnrichedWordAnnotationRoman,
  WordAnnotationRuby as EnrichedWordAnnotationRuby,
  WordAnnotationToken as EnrichedWordAnnotationToken,
  WordAnnotationTranslation as EnrichedWordAnnotationTranslation,
  WordEmphasis as EnrichedWordEmphasis,
} from '@root/generated/enriched/index.gen'

export { LineType as EnrichedLineType, LyricStatus as EnrichedLyricStatus, WordType as EnrichedWordType } from '@root/generated/enriched/index.gen'

export * from './lyric'
export * from './line'
export * from './word'
export * from './language'
