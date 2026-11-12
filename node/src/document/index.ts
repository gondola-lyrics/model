export type {
  Lyric as DocumentLyric,
  Line as DocumentLine,
  LineAnnotation as DocumentLineAnnotation,
  LineAnnotationRoman as DocumentLineAnnotationRoman,
  LineAnnotationRomanContent as DocumentLineAnnotationRomanContent,
  LineAnnotationRomanToken as DocumentLineAnnotationRomanToken,
  LineAnnotationTranslation as DocumentLineAnnotationTranslation,
  LineBackground as DocumentLineBackground,
  LineContent as DocumentLineContent,
  Word as DocumentWord,
  WordAnnotation as DocumentWordAnnotation,
  WordAnnotationRoman as DocumentWordAnnotationRoman,
  WordAnnotationRuby as DocumentWordAnnotationRuby,
  WordAnnotationToken as DocumentWordAnnotationToken,
  WordAnnotationTranslation as DocumentWordAnnotationTranslation,
} from '@root/generated/document/index.gen'

export { LineType as DocumentLineType, WordType as DocumentWordType } from '@root/generated/document/index.gen'

export * from './lyric'
export * from './line'
export * from './word'
