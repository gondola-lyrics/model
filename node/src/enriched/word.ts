import type { Diagnostic } from '@root/common'
import type { MakeInit } from '@root/utils'
import type { TextToken, TimeRange } from '@root/generated/common/index.gen'
import type {
  Word,
  WordAnnotation,
  WordAnnotationRoman,
  WordAnnotationRuby,
  WordAnnotationTranslation,
  WordEmphasis,
} from '@root/generated/enriched/index.gen'

import { DiagnosticCode, canonicalizeTextToken, validateTextToken, validateTimeRange } from '@root/common'
import { validateLanguageTag } from '@root/common/tag'
import { TimingLevel } from '@root/generated/common/index.gen'
import {
  fieldsCommonTextToken,
  fieldsEnrichedWordAnnotation,
  fieldsEnrichedWordAnnotationRoman,
  fieldsEnrichedWordAnnotationRuby,
  fieldsEnrichedWordAnnotationTranslation,
  fieldsEnrichedWordEmphasis,
  createEnrichedWord,
  createEnrichedWordAnnotation,
  createEnrichedWordAnnotationRoman,
  createEnrichedWordAnnotationRuby,
  createEnrichedWordAnnotationTranslation,
  createEnrichedWordEmphasis,
} from '@root/generated/detail.gen'
import { WordType } from '@root/generated/enriched/index.gen'
import {
  canonicalizeField,
  canonicalizeList,
  childPath,
  copyMessage,
  dropDefault,
  findDefaultEntries,
  findDuplicates,
  getAnnotationKey,
  isTimeRangeUncovered,
  isUnresolved,
  lowerTag,
  withInit,
} from '@root/utils'

/**
 * Unicode White_Space excludes format characters such as U+200B.
 */
const ANY_SEPARATOR = /\p{White_Space}/u
const ONLY_SEPARATORS = /^\p{White_Space}+$/u

/**
 * Reports whether word timing constraints apply.
 */
const ownsWordTimes = (timing: TimingLevel): boolean => {
  return timing !== TimingLevel.NONE && timing !== TimingLevel.LINE
}

/**
 * Creates a word romanization without normalizing its language or scheme.
 */
export const makeEnrichedWordAnnotationRoman = (init?: MakeInit<WordAnnotationRoman>): WordAnnotationRoman => {
  return withInit(createEnrichedWordAnnotationRoman(), init)
}

/**
 * Creates a translation of a whole word.
 */
export const makeEnrichedWordAnnotationTranslation = (init?: MakeInit<WordAnnotationTranslation>): WordAnnotationTranslation => {
  return withInit(createEnrichedWordAnnotationTranslation(), init)
}

/**
 * Creates a ruby annotation without normalizing its language or scheme.
 */
export const makeEnrichedWordAnnotationRuby = (init?: MakeInit<WordAnnotationRuby>): WordAnnotationRuby => {
  return withInit(createEnrichedWordAnnotationRuby(), init)
}

/**
 * Creates word annotations from the supplied lists.
 */
export const makeEnrichedWordAnnotation = (init?: MakeInit<WordAnnotation>): WordAnnotation => {
  return withInit(createEnrichedWordAnnotation(), init)
}

/**
 * Checks annotation languages, list entries, uniqueness, and containment within supplied word timing.
 *
 * Paths are relative to this annotation unless its location is supplied.
 */
export const validateEnrichedWordAnnotation = (annotation: WordAnnotation, path = '', time?: TimeRange): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  /**
   * Validates the time of every item in one timed annotation list, and of every token those items hold, against both its own domain and the range containing it.
   */
  const validateItems = (items: (WordAnnotationRuby | WordAnnotationRoman)[], field: string): void => {
    items.forEach((item, i) => {
      const itemPath = childPath(path, `${field}[${i}]`)
      diagnostics.push(...validateLanguageTag(item.language, childPath(itemPath, 'language')))
      if (item.time) {
        diagnostics.push(...validateTimeRange(item.time, childPath(itemPath, 'time')))
      }
      // Annotation timing follows the same vocal event as the word.
      if (isTimeRangeUncovered(item.time, time)) {
        diagnostics.push({ path: childPath(itemPath, 'time'), code: DiagnosticCode.LineWordAnnotationTimeUncovered })
      }

      const inherited = item.time ?? time
      item.tokens.forEach((token, j) => {
        const tokenPath = childPath(itemPath, `tokens[${j}]`)
        diagnostics.push(...validateTextToken(token, tokenPath))
        if (isTimeRangeUncovered(token.time, inherited)) {
          diagnostics.push({ path: childPath(tokenPath, 'time'), code: DiagnosticCode.LineWordAnnotationTimeUncovered })
        }
      })
    })
  }
  findDuplicates(annotation.rubies, getAnnotationKey).forEach((i) => {
    diagnostics.push({ path: childPath(path, `rubies[${i}]`), code: DiagnosticCode.LineWordAnnotationRubiesDuplicate })
  })
  findDuplicates(annotation.romans, getAnnotationKey).forEach((i) => {
    diagnostics.push({ path: childPath(path, `romans[${i}]`), code: DiagnosticCode.LineWordAnnotationRomansDuplicate })
  })
  findDuplicates(annotation.translations, (item) => lowerTag(item.language) ?? '').forEach((i) => {
    diagnostics.push({ path: childPath(path, `translations[${i}]`), code: DiagnosticCode.LineWordAnnotationTranslationsLanguageDuplicate })
  })
  validateItems(annotation.rubies, 'rubies')
  validateItems(annotation.romans, 'romans')
  annotation.translations.forEach((translation, i) => {
    diagnostics.push(...validateLanguageTag(translation.language, childPath(path, `translations[${i}].language`)))
  })
  findDefaultEntries(
    fieldsEnrichedWordAnnotation,
    annotation,
    diagnostics.map((diagnostic) => diagnostic.path),
    path,
  ).forEach((entryPath) => {
    diagnostics.push({ path: entryPath, code: DiagnosticCode.LyricListEntryEmpty })
  })
  return diagnostics
}

/**
 * Checks the word kind, text, permitted fields, annotations, and timing.
 *
 * NONE forbids original timing; NONE and LINE suppress required word timing and parent-word annotation containment.
 * Other levels retain the standalone word-timing checks.
 * Paths are relative to this word unless its location is supplied.
 */
export const validateEnrichedWord = (word: Word, path = '', timing = TimingLevel.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []

  if (isUnresolved(WordType, word.type)) {
    diagnostics.push({ path, code: DiagnosticCode.WordTypeUnspecified })
  }
  if (word.type === WordType.NORMAL && word.text === '') {
    diagnostics.push({ path, code: DiagnosticCode.WordTextEmpty })
  } else if (word.type === WordType.NORMAL && ANY_SEPARATOR.test(word.text)) {
    // Separators belong in adjacent SPACE words.
    diagnostics.push({ path: childPath(path, 'text'), code: DiagnosticCode.WordTextSeparator })
  }
  if (word.type === WordType.SPACE) {
    if (!ONLY_SEPARATORS.test(word.text)) {
      diagnostics.push({ path: childPath(path, 'text'), code: DiagnosticCode.WordTextNotSeparator })
    }
    // Forbidden fields are reported once without validating their contents.
    if (word.time !== undefined) {
      diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LineWordTimeUnexpected })
    }
    if (word.language !== undefined) {
      diagnostics.push({ path: childPath(path, 'language'), code: DiagnosticCode.LineWordLanguageUnexpected })
    }
    if (word.annotation !== undefined) {
      diagnostics.push({ path: childPath(path, 'annotation'), code: DiagnosticCode.LineWordAnnotationUnexpected })
    }
    if (word.emphasis !== undefined) {
      diagnostics.push({ path: childPath(path, 'emphasis'), code: DiagnosticCode.LineWordEmphasisUnexpected })
    }
    return diagnostics
  }
  diagnostics.push(...validateLanguageTag(word.language, childPath(path, 'language')))
  if (ownsWordTimes(timing) && word.type === WordType.NORMAL && word.time === undefined) {
    diagnostics.push({ path, code: DiagnosticCode.LineWordTimeMissing })
  }
  if (word.time) {
    if (timing === TimingLevel.NONE) {
      diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LyricTimingNonePresent })
    }
    diagnostics.push(...validateTimeRange(word.time, childPath(path, 'time')))
  }
  if (word.annotation) {
    diagnostics.push(...validateEnrichedWordAnnotation(word.annotation, childPath(path, 'annotation'), ownsWordTimes(timing) ? word.time : undefined))
  }
  const emphasis = word.emphasis
  if (emphasis?.derived !== undefined && emphasis.value === undefined) {
    diagnostics.push({ path: childPath(path, 'emphasis.value'), code: DiagnosticCode.LineWordEmphasisValueMissing })
  }
  return diagnostics
}

/**
 * Validates each word and compares its timing with the supplied enclosing range.
 *
 * Paths are relative to this array unless its location is supplied.
 */
export const validateEnrichedWords = (words: Word[], time: TimeRange | undefined, path = '', timing = TimingLevel.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const ownTimes = ownsWordTimes(timing)
  words.forEach((word, i) => {
    const wordPath = `${path}[${i}]`
    diagnostics.push(...validateEnrichedWord(word, wordPath, timing))
    // SPACE timing is already reported as forbidden.
    if (ownTimes && word.type !== WordType.SPACE && isTimeRangeUncovered(word.time, time)) {
      diagnostics.push({ path: childPath(wordPath, 'time'), code: DiagnosticCode.LineWordTimeUncovered })
    }
  })
  return diagnostics
}

/**
 * Lowercases language and scheme and canonicalizes roman tokens.
 */
export const canonicalizeEnrichedWordAnnotationRoman = (roman: WordAnnotationRoman): WordAnnotationRoman => {
  return {
    ...roman,
    time: copyMessage(roman.time),
    language: lowerTag(roman.language),
    scheme: lowerTag(roman.scheme),
    tokens: canonicalizeList(fieldsCommonTextToken, roman.tokens, canonicalizeTextToken),
  }
}

/**
 * Lowercases language and scheme and canonicalizes ruby tokens.
 */
export const canonicalizeEnrichedWordAnnotationRuby = (ruby: WordAnnotationRuby): WordAnnotationRuby => {
  return {
    ...ruby,
    time: copyMessage(ruby.time),
    language: lowerTag(ruby.language),
    scheme: lowerTag(ruby.scheme),
    tokens: canonicalizeList(fieldsCommonTextToken, ruby.tokens, canonicalizeTextToken),
  }
}

/**
 * Lowercases the translation's language tag.
 */
export const canonicalizeEnrichedWordAnnotationTranslation = (translation: WordAnnotationTranslation): WordAnnotationTranslation => {
  return { ...translation, language: lowerTag(translation.language) }
}

/**
 * Canonicalizes annotations and drops all-default list entries.
 */
export const canonicalizeEnrichedWordAnnotation = (annotation: WordAnnotation): WordAnnotation => {
  return {
    ...annotation,
    rubies: canonicalizeList(fieldsEnrichedWordAnnotationRuby, annotation.rubies, canonicalizeEnrichedWordAnnotationRuby),
    romans: canonicalizeList(fieldsEnrichedWordAnnotationRoman, annotation.romans, canonicalizeEnrichedWordAnnotationRoman),
    translations: canonicalizeList(fieldsEnrichedWordAnnotationTranslation, annotation.translations, canonicalizeEnrichedWordAnnotationTranslation),
  }
}

/**
 * Uses the annotation's time, falling back to the annotated word.
 */
export const resolveEnrichedAnnotationItemTime = (item: WordAnnotationRoman | WordAnnotationRuby, word: Word): TimeRange | undefined => {
  return item.time ?? word.time
}

/**
 * Uses the token's time, then its annotation's time, then the annotated word.
 */
export const resolveEnrichedAnnotationTokenTime = (
  token: TextToken,
  item: WordAnnotationRoman | WordAnnotationRuby,
  word: Word,
): TimeRange | undefined => {
  return token.time ?? resolveEnrichedAnnotationItemTime(item, word)
}

/**
 * Joins word text in order, including separator words.
 */
export const getEnrichedWordsText = (words: Word[]): string => {
  return words.map((word) => word.text).join('')
}

/**
 * Returns distinct lowercase language tags from normal words in first-appearance order.
 */
export const getEnrichedWordsLanguages = (words: Word[]): string[] => {
  const normal = words.filter((word) => word.type === WordType.NORMAL)
  return [...new Set(normal.map((word) => lowerTag(word.language)).filter((tag) => tag !== undefined))]
}

/**
 * Joins annotation tokens in order without adding separators.
 */
export const getEnrichedAnnotationItemText = (item: WordAnnotationRoman | WordAnnotationRuby): string => {
  return item.tokens.map((token) => token.text).join('')
}

/**
 * Creates a normal word with a fixed WORD_TYPE_NORMAL discriminator.
 */
export const makeEnrichedWordNormal = (init?: Omit<MakeInit<Word>, 'type'>): Word => {
  return withInit(createEnrichedWord(), {
    type: WordType.NORMAL,
    time: init?.time,
    text: init?.text,
    language: init?.language,
    annotation: init?.annotation,
    emphasis: init?.emphasis,
  })
}

/**
 * Creates a WORD_TYPE_SPACE word containing only the supplied separator.
 */
export const makeEnrichedWordSpace = (init?: Pick<MakeInit<Word>, 'text'>): Word => {
  return withInit(createEnrichedWord(), { text: init?.text, type: WordType.SPACE })
}

/**
 * Creates an emphasis decision, preserving absent fields and explicit false values.
 */
export const makeEnrichedWordEmphasis = (init?: MakeInit<WordEmphasis>): WordEmphasis => {
  return withInit(createEnrichedWordEmphasis(), init)
}

/**
 * Returns a canonical copy with normalized language and annotations, preserving explicit emphasis values.
 */
export const canonicalizeEnrichedWord = (word: Word): Word => {
  return {
    ...word,
    time: copyMessage(word.time),
    language: lowerTag(word.language),
    annotation: canonicalizeField(fieldsEnrichedWordAnnotation, word.annotation, canonicalizeEnrichedWordAnnotation),
    emphasis: dropDefault(fieldsEnrichedWordEmphasis, copyMessage(word.emphasis)),
  }
}
