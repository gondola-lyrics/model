import type { Diagnostic } from '@root/common'
import type { MakeInit } from '@root/utils'
import type { TimeRange } from '@root/generated/common/index.gen'
import type {
  Line,
  LineAnnotation,
  LineAnnotationRoman,
  LineAnnotationRomanContent,
  LineAnnotationRomanToken,
  LineAnnotationTranslation,
  LineBackground,
  LineContent,
  Word,
  WordAnnotationRoman,
} from '@root/generated/document/index.gen'

import { DiagnosticCode, validatePart, validateTimeRange } from '@root/common'
import { validateLineTags } from '@root/common/tag'
import { TimingLevel } from '@root/generated/common/index.gen'
import {
  createDocumentLine,
  createDocumentLineAnnotation,
  createDocumentLineAnnotationRoman,
  createDocumentLineAnnotationRomanContent,
  createDocumentLineAnnotationRomanToken,
  createDocumentLineAnnotationTranslation,
  createDocumentLineBackground,
  createDocumentLineContent,
  fieldsCommonPart,
  fieldsDocumentLine,
  fieldsDocumentLineAnnotation,
  fieldsDocumentLineAnnotationRoman,
  fieldsDocumentLineAnnotationRomanContent,
  fieldsDocumentLineAnnotationRomanToken,
  fieldsDocumentLineAnnotationTranslation,
  fieldsDocumentLineBackground,
  fieldsDocumentLineContent,
  fieldsDocumentWord,
} from '@root/generated/detail.gen'
import { LineType, WordType } from '@root/generated/document/index.gen'
import {
  byTime,
  canonicalizeField,
  canonicalizeList,
  childPath,
  copyMessage,
  dropDefault,
  findDuplicates,
  findUnordered,
  getAnnotationKey,
  getTimeRangeEnd,
  isTimeRangeOrdered,
  isTimeRangeUncovered,
  isUnresolved,
  lowerTag,
  withInit,
} from '@root/utils'

import {
  canonicalizeDocumentWord,
  getDocumentAnnotationItemText,
  getDocumentWordsLanguages,
  getDocumentWordsText,
  validateDocumentWords,
} from './word'

/**
 * Checks that exactly one non-empty content form is present and validates its words.
 *
 * An unresolved line kind may omit content when required is false.
 */
export const validateDocumentLineContent = (
  content: LineContent | undefined,
  time: TimeRange | undefined,
  path = '',
  timing = TimingLevel.UNSPECIFIED,
  required = true,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const contentPath = childPath(path, 'content')
  const hasWords = content !== undefined && content.words.length > 0
  const hasText = content?.text !== undefined
  if (required && !hasWords && !hasText) {
    diagnostics.push({ path, code: DiagnosticCode.LineContentMissing })
  } else if (hasWords && hasText) {
    diagnostics.push({ path: contentPath, code: DiagnosticCode.LineContentAmbiguous })
  }
  // Empty text still counts as present for exclusivity.
  if (content?.text === '') {
    diagnostics.push({ path: childPath(contentPath, 'text'), code: DiagnosticCode.LineContentTextEmpty })
  }
  diagnostics.push(...validateDocumentWords(content?.words ?? [], time, contentPath, timing))
  return diagnostics
}

/**
 * Returns plain text when present, otherwise joins the content's words.
 */
export const getDocumentLineContentText = (content: LineContent | undefined): string => {
  return content?.text ?? getDocumentWordsText(content?.words ?? [])
}

/**
 * Reports whether the line contains words.
 */
export const isDocumentWordLevelLine = (line: { content?: LineContent | undefined }): boolean => {
  return (line.content?.words.length ?? 0) > 0
}

/**
 * Returns distinct lowercase line languages, using normal-word languages when the line declares none.
 */
export const deriveDocumentLineLanguages = (line: { languages: string[]; content?: LineContent | undefined }): string[] => {
  if (line.languages.length === 0) {
    return getDocumentWordsLanguages(line.content?.words ?? [])
  }
  return [...new Set(line.languages.map((tag) => lowerTag(tag)).filter((tag) => tag !== undefined))]
}

/**
 * Creates annotations explicitly attached to a whole line.
 */
export const makeDocumentLineAnnotation = (init?: MakeInit<LineAnnotation>): LineAnnotation => {
  return withInit(createDocumentLineAnnotation(), init)
}

/**
 * Creates a source fragment, preserving its text and optional timing.
 */
export const makeDocumentLineAnnotationRomanToken = (init?: MakeInit<LineAnnotationRomanToken>): LineAnnotationRomanToken => {
  return withInit(createDocumentLineAnnotationRomanToken(), init)
}

/**
 * Creates roman content from source fragments without adding whole-line text.
 */
export const makeDocumentLineAnnotationRomanContentTokens = (tokens: LineAnnotationRomanToken[]): LineAnnotationRomanContent => {
  return withInit(createDocumentLineAnnotationRomanContent(), { tokens })
}

/**
 * Creates whole-line roman text without fragment timing.
 */
export const makeDocumentLineAnnotationRomanContentText = (text: string): LineAnnotationRomanContent => {
  return withInit(createDocumentLineAnnotationRomanContent(), { text })
}

/**
 * Checks exclusive content, non-empty text, a token timing anchor, and containment in a declared annotation range.
 *
 * Explicit token times are independent of the original line when the annotation has no declared range.
 */
export const validateDocumentLineAnnotationRomanContent = (
  content: LineAnnotationRomanContent | undefined,
  path = '',
  time?: TimeRange,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const tokens = content?.tokens ?? []
  const hasTokens = tokens.length > 0
  const hasText = content?.text !== undefined
  if (!hasTokens && !hasText) {
    diagnostics.push({ path, code: DiagnosticCode.LineAnnotationRomanContentMissing })
  } else if (hasTokens && hasText) {
    diagnostics.push({ path, code: DiagnosticCode.LineAnnotationRomanContentAmbiguous })
  }
  if (content?.text === '') {
    diagnostics.push({ path: childPath(path, 'text'), code: DiagnosticCode.LineAnnotationRomanContentTextEmpty })
  }
  if (hasTokens && !tokens.some((token) => token.time !== undefined)) {
    diagnostics.push({ path: childPath(path, 'tokens'), code: DiagnosticCode.LineAnnotationRomanContentTokensTimeMissing })
  }
  tokens.forEach((token, i) => {
    const tokenPath = childPath(path, `tokens[${i}]`)
    if (token.text === '') {
      diagnostics.push({ path: childPath(tokenPath, 'text'), code: DiagnosticCode.LineAnnotationRomanTokenTextEmpty })
    }
    if (token.time) {
      diagnostics.push(...validateTimeRange(token.time, childPath(tokenPath, 'time')))
    }
    if (isTimeRangeUncovered(token.time, time)) {
      diagnostics.push({ path: childPath(tokenPath, 'time'), code: DiagnosticCode.LineAnnotationRomanTimeUncovered })
    }
  })
  return diagnostics
}

/**
 * Checks the declared range and required roman content without constraining them to the original line.
 */
export const validateDocumentLineAnnotationRoman = (roman: LineAnnotationRoman, path = ''): Diagnostic[] => {
  const diagnostics = validateDocumentLineAnnotationRomanContent(roman.content, childPath(path, 'content'), roman.time)
  if (roman.time) {
    diagnostics.push(...validateTimeRange(roman.time, childPath(path, 'time')))
  }
  return diagnostics
}

/**
 * Checks roman content and timing, uniqueness by language and scheme, and translation uniqueness by language.
 */
export const validateDocumentLineAnnotation = (annotation: LineAnnotation, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  findDuplicates(annotation.romans, getAnnotationKey).forEach((i) => {
    diagnostics.push({ path: childPath(path, `romans[${i}]`), code: DiagnosticCode.LineAnnotationRomansDuplicate })
  })
  findDuplicates(annotation.translations, (item) => lowerTag(item.language) ?? '').forEach((i) => {
    diagnostics.push({ path: childPath(path, `translations[${i}]`), code: DiagnosticCode.LineAnnotationTranslationsLanguageDuplicate })
  })
  annotation.romans.forEach((roman, i) => {
    diagnostics.push(...validateDocumentLineAnnotationRoman(roman, childPath(path, `romans[${i}]`)))
  })
  return diagnostics
}

const validateRomanPlacement = (annotation: LineAnnotation, content: LineContent | undefined, path: string): Diagnostic[] => {
  const wordKeys = new Set<string>()
  for (const word of content?.words ?? []) {
    if (word.type === WordType.SPACE) {
      continue
    }
    for (const roman of word.annotation?.romans ?? []) {
      wordKeys.add(getAnnotationKey(roman))
    }
  }
  const diagnostics: Diagnostic[] = []
  annotation.romans.forEach((roman, i) => {
    if (wordKeys.has(getAnnotationKey(roman))) {
      diagnostics.push({ path: childPath(path, `romans[${i}]`), code: DiagnosticCode.LineAnnotationRomansConflict })
    }
  })
  return diagnostics
}

/**
 * Creates a whole-line romanization without normalizing its language or scheme.
 */
export const makeDocumentLineAnnotationRoman = (init?: MakeInit<LineAnnotationRoman>): LineAnnotationRoman => {
  return withInit(createDocumentLineAnnotationRoman(), init)
}

/**
 * Creates a translation of a whole line.
 */
export const makeDocumentLineAnnotationTranslation = (init?: MakeInit<LineAnnotationTranslation>): LineAnnotationTranslation => {
  return withInit(createDocumentLineAnnotationTranslation(), init)
}

/**
 * Copies the source fragment and its optional time without changing text.
 */
export const canonicalizeDocumentLineAnnotationRomanToken = (token: LineAnnotationRomanToken): LineAnnotationRomanToken => {
  return { ...token, time: copyMessage(token.time) }
}

/**
 * Copies roman content, preserving fragment order, whitespace, and explicit timing.
 */
export const canonicalizeDocumentLineAnnotationRomanContent = (content: LineAnnotationRomanContent): LineAnnotationRomanContent => {
  return {
    ...content,
    tokens: canonicalizeList(fieldsDocumentLineAnnotationRomanToken, content.tokens, canonicalizeDocumentLineAnnotationRomanToken),
  }
}

/**
 * Lowercases language and scheme and copies roman content and timing without inferring missing boundaries.
 */
export const canonicalizeDocumentLineAnnotationRoman = (roman: LineAnnotationRoman): LineAnnotationRoman => {
  return {
    ...roman,
    language: lowerTag(roman.language),
    scheme: lowerTag(roman.scheme),
    time: copyMessage(roman.time),
    content: canonicalizeField(fieldsDocumentLineAnnotationRomanContent, roman.content, canonicalizeDocumentLineAnnotationRomanContent),
  }
}

/**
 * Returns whole-line text or joins source fragments without adding separators.
 */
export const getDocumentLineAnnotationRomanText = (roman: LineAnnotationRoman): string => {
  return roman.content?.text ?? (roman.content?.tokens ?? []).map((token) => token.text).join('')
}

/**
 * Uses the romanization's declared time, falling back to the owning line or background.
 */
export const resolveDocumentLineAnnotationRomanTime = (roman: LineAnnotationRoman, line: { time?: TimeRange | undefined }): TimeRange | undefined => {
  return roman.time ?? line.time
}

/**
 * Uses the entire token time, then the romanization's time, then the owning line's time.
 */
export const resolveDocumentLineAnnotationRomanTokenTime = (
  token: LineAnnotationRomanToken,
  roman: LineAnnotationRoman,
  line: { time?: TimeRange | undefined },
): TimeRange | undefined => {
  return token.time ?? resolveDocumentLineAnnotationRomanTime(roman, line)
}

/**
 * Lowercases the translation's language tag.
 */
export const canonicalizeDocumentLineAnnotationTranslation = (translation: LineAnnotationTranslation): LineAnnotationTranslation => {
  return { ...translation, language: lowerTag(translation.language) }
}

/**
 * Canonicalizes line annotations and drops all-default entries.
 */
export const canonicalizeDocumentLineAnnotation = (annotation: LineAnnotation): LineAnnotation => {
  return {
    ...annotation,
    romans: canonicalizeList(fieldsDocumentLineAnnotationRoman, annotation.romans, canonicalizeDocumentLineAnnotationRoman),
    translations: canonicalizeList(fieldsDocumentLineAnnotationTranslation, annotation.translations, canonicalizeDocumentLineAnnotationTranslation),
  }
}

/**
 * Aggregates romanizations by language and scheme in first-appearance order.
 *
 * Words without a matching romanization are skipped; separators collapse to one U+0020.
 * The returned annotations are for display and must not be stored on the line.
 */
export const deriveDocumentLineRomans = (content: LineContent | undefined): LineAnnotationRoman[] => {
  const words = content?.words ?? []
  const variants = new Map<string, WordAnnotationRoman>()
  for (const word of words) {
    for (const roman of word.annotation?.romans ?? []) {
      variants.set(getAnnotationKey(roman), roman)
    }
  }
  const romans: LineAnnotationRoman[] = []
  for (const [key, variant] of variants) {
    let joined = ''
    let spaced = false
    for (const word of words) {
      if (word.type === WordType.SPACE) {
        spaced = true
        continue
      }
      const roman = word.annotation?.romans.find((item) => getAnnotationKey(item) === key)
      const text = roman ? getDocumentAnnotationItemText(roman) : ''
      if (text !== '') {
        joined += joined !== '' && spaced ? ` ${text}` : text
        spaced = false
      }
    }
    if (joined !== '') {
      romans.push(
        makeDocumentLineAnnotationRoman({
          language: lowerTag(variant.language),
          scheme: lowerTag(variant.scheme),
          content: makeDocumentLineAnnotationRomanContentText(joined),
        }),
      )
    }
  }
  return romans
}

/**
 * Creates content from ordered words.
 */
export const makeDocumentLineContentWords = (words: Word[]): LineContent => {
  return withInit(createDocumentLineContent(), { words })
}

/**
 * Creates content from whole-line text.
 */
export const makeDocumentLineContentText = (text: string): LineContent => {
  return withInit(createDocumentLineContent(), { text })
}

/**
 * Canonicalizes words and preserves plain text.
 */
export const canonicalizeDocumentLineContent = (content: LineContent): LineContent => {
  return { ...content, words: canonicalizeList(fieldsDocumentWord, content.words, canonicalizeDocumentWord) }
}

/**
 * Creates a normal line with a fixed LINE_TYPE_NORMAL discriminator.
 */
export const makeDocumentLineNormal = (init?: Omit<MakeInit<Line>, 'type'>): Line => {
  return withInit(createDocumentLine(), {
    id: init?.id,
    type: LineType.NORMAL,
    time: init?.time,
    part: init?.part,
    agents: init?.agents,
    languages: init?.languages,
    content: init?.content,
    annotation: init?.annotation,
    backgrounds: init?.backgrounds,
  })
}

/**
 * Creates an instrumental line with only id, time, and part.
 *
 * A present part identifies a source declaration; an absent part identifies a derived interval.
 */
export const makeDocumentLineInstrumental = (init?: Pick<MakeInit<Line>, 'id' | 'time' | 'part'>): Line => {
  return withInit(createDocumentLine(), { id: init?.id, time: init?.time, part: init?.part, type: LineType.INSTRUMENTAL })
}

/**
 * Creates background vocals attached to a normal line.
 */
export const makeDocumentLineBackground = (init?: MakeInit<LineBackground>): LineBackground => {
  return withInit(createDocumentLineBackground(), init)
}

/**
 * Checks the line kind, permitted fields, timing, annotations, and backgrounds.
 *
 * Unresolved kinds may omit content; untimed instrumental lines are reported by validateDocumentLyric.
 */
export const validateDocumentLine = (line: Line, path = '', timing = TimingLevel.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  // Tags are read here rather than by the lyric, since only this knows which fields a line's kind forbids, and a forbidden field is never descended into.
  if (line.type !== LineType.INSTRUMENTAL) {
    diagnostics.push(...validateLineTags(fieldsDocumentLine, line, path))
  }
  const instrumental = line.type === LineType.INSTRUMENTAL

  if (isUnresolved(LineType, line.type)) {
    diagnostics.push({ path: childPath(path, 'type'), code: DiagnosticCode.LineTypeUnspecified })
  }
  // An instrumental line is the stretch its range marks out, so it is nothing without a range, and nothing with one that never ends or one that ends where it starts.
  // An untimed lyric marks out no stretches, so there the lyric reports the line itself and asks for no range here.
  const needsRange = instrumental && timing !== TimingLevel.NONE
  if (line.time) {
    diagnostics.push(...validateTimeRange(line.time, childPath(path, 'time')))
    if (needsRange && line.time.end === undefined) {
      diagnostics.push({ path: childPath(path, 'time.end'), code: DiagnosticCode.LineTimeEndMissing })
    }
    // Only a range running the right way makes its bounds worth comparing, so a range already reported for its own numbers is left alone here.
    if (needsRange && isTimeRangeOrdered(line.time) && line.time.end === line.time.start) {
      diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LineTimeEmpty })
    }
  } else if (needsRange) {
    diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LineTimeMissing })
  }
  if (line.part) {
    diagnostics.push(...validatePart(line.part, childPath(path, 'part')))
  }
  // An instrumental line carries no singing, so every field describing one is not allowed, and a forbidden field is never descended into.
  if (instrumental && line.agents.length > 0) {
    diagnostics.push({ path: childPath(path, 'agents'), code: DiagnosticCode.LineAgentsUnexpected })
  }
  if (instrumental && line.languages.length > 0) {
    diagnostics.push({ path: childPath(path, 'languages'), code: DiagnosticCode.LineLanguagesUnexpected })
  } else if (!instrumental) {
    findDuplicates(line.languages, (tag) => lowerTag(tag) ?? '').forEach((i) => {
      diagnostics.push({ path: childPath(path, `languages[${i}]`), code: DiagnosticCode.LineLanguagesDuplicate })
    })
  }
  // Content belongs to a sung line, so an instrumental one may carry none, while an unresolved kind is asked for none and forbidden none.
  if (instrumental) {
    if (line.content) {
      diagnostics.push({ path: childPath(path, 'content'), code: DiagnosticCode.LineContentUnexpected })
    }
  } else {
    diagnostics.push(...validateDocumentLineContent(line.content, line.time, path, timing, line.type === LineType.NORMAL))
  }
  if (instrumental && line.annotation !== undefined) {
    diagnostics.push({ path: childPath(path, 'annotation'), code: DiagnosticCode.LineAnnotationUnexpected })
  } else if (line.annotation) {
    diagnostics.push(...validateDocumentLineAnnotation(line.annotation, childPath(path, 'annotation')))
    diagnostics.push(...validateRomanPlacement(line.annotation, line.content, childPath(path, 'annotation')))
  }
  if (instrumental && line.backgrounds.length > 0) {
    diagnostics.push({ path: childPath(path, 'backgrounds'), code: DiagnosticCode.LineBackgroundsUnexpected })
  } else {
    // The schema declares the list ordered, so an entry starting before the one it follows is out of place.
    findUnordered(line.backgrounds, (background) => background.time).forEach((i) => {
      diagnostics.push({ path: childPath(path, `backgrounds[${i}]`), code: DiagnosticCode.LineBackgroundsUnordered })
    })
    line.backgrounds.forEach((background, i) => {
      const backgroundPath = childPath(path, `backgrounds[${i}]`)
      // The parent's end covers a background line, while its start may precede the parent's; a range reported for its own numbers or order never joins this comparison.
      if (isTimeRangeOrdered(line.time) && isTimeRangeOrdered(background.time) && getTimeRangeEnd(background.time) > getTimeRangeEnd(line.time)) {
        diagnostics.push({ path: childPath(backgroundPath, 'time'), code: DiagnosticCode.LineBackgroundsTimeUncovered })
      }
      diagnostics.push(...validateDocumentLineBackground(background, backgroundPath, timing))
    })
  }
  return diagnostics
}

/**
 * Checks background content, timing, languages, and annotations.
 */
export const validateDocumentLineBackground = (background: LineBackground, path = '', timing = TimingLevel.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (background.time) {
    diagnostics.push(...validateTimeRange(background.time, childPath(path, 'time')))
  }
  findDuplicates(background.languages, (tag) => lowerTag(tag) ?? '').forEach((i) => {
    diagnostics.push({ path: childPath(path, `languages[${i}]`), code: DiagnosticCode.LineLanguagesDuplicate })
  })
  diagnostics.push(...validateDocumentLineContent(background.content, background.time, path, timing))
  if (background.annotation) {
    diagnostics.push(...validateDocumentLineAnnotation(background.annotation, childPath(path, 'annotation')))
    diagnostics.push(...validateRomanPlacement(background.annotation, background.content, childPath(path, 'annotation')))
  }
  return diagnostics
}

/**
 * Returns a copy with backgrounds ordered by start time.
 */
export const orderDocumentLine = (line: Line): Line => {
  return { ...line, backgrounds: [...line.backgrounds].sort(byTime((background) => background.time)) }
}

/**
 * Normalizes languages and annotations, removes empty references, and canonicalizes content.
 */
export const canonicalizeDocumentLineBackground = (background: LineBackground): LineBackground => {
  return {
    ...background,
    time: copyMessage(background.time),
    agents: background.agents.filter((id) => id !== ''),
    languages: [...new Set(background.languages.map((tag) => tag.toLowerCase()).filter((tag) => tag !== ''))],
    content: canonicalizeField(fieldsDocumentLineContent, background.content, canonicalizeDocumentLineContent),
    annotation: canonicalizeField(fieldsDocumentLineAnnotation, background.annotation, canonicalizeDocumentLineAnnotation),
  }
}

/**
 * Canonicalizes line fields and orders backgrounds, dropping all-default submessages.
 */
export const canonicalizeDocumentLine = (line: Line): Line => {
  return {
    ...line,
    time: copyMessage(line.time),
    part: dropDefault(fieldsCommonPart, copyMessage(line.part)),
    agents: line.agents.filter((id) => id !== ''),
    languages: [...new Set(line.languages.map((tag) => tag.toLowerCase()).filter((tag) => tag !== ''))],
    content: canonicalizeField(fieldsDocumentLineContent, line.content, canonicalizeDocumentLineContent),
    annotation: canonicalizeField(fieldsDocumentLineAnnotation, line.annotation, canonicalizeDocumentLineAnnotation),
    backgrounds: canonicalizeList(fieldsDocumentLineBackground, line.backgrounds, canonicalizeDocumentLineBackground).sort(
      byTime((background) => background.time),
    ),
  }
}
