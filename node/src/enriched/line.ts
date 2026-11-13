import type { Diagnostic, LineRomanView } from '@root/common'
import type { MakeInit } from '@root/utils'
import type { TextToken, TimeRange } from '@root/generated/common/index.gen'
import type {
  Line,
  LineAnnotation,
  LineAnnotationRoman,
  LineAnnotationRomanContent,
  LineAnnotationTranslation,
  LineBackground,
  LineContent,
  Word,
  WordAnnotationRoman,
} from '@root/generated/enriched/index.gen'

import { DiagnosticCode, canonicalizeTextToken, validatePart, validateTextToken, validateTimeRange } from '@root/common'
import { validateLanguageTag, validateLanguageTags } from '@root/common/tag'
import { PartType, TimingLevel } from '@root/generated/common/index.gen'
import {
  fieldsCommonPart,
  fieldsCommonTextToken,
  fieldsEnrichedLineAnnotation,
  fieldsEnrichedLineAnnotationRoman,
  fieldsEnrichedLineAnnotationRomanContent,
  fieldsEnrichedLineAnnotationTranslation,
  fieldsEnrichedLineBackground,
  fieldsEnrichedLineContent,
  fieldsEnrichedWord,
  createEnrichedLine,
  createEnrichedLineAnnotation,
  createEnrichedLineAnnotationRoman,
  createEnrichedLineAnnotationRomanContent,
  createEnrichedLineAnnotationTranslation,
  createEnrichedLineBackground,
  createEnrichedLineContent,
} from '@root/generated/detail.gen'
import { LineType, WordType } from '@root/generated/enriched/index.gen'
import {
  byStartTime,
  canonicalizeField,
  canonicalizeList,
  childPath,
  copyScalarMessage,
  unsetIfDefault,
  findDefaultEntries,
  findDuplicateIndices,
  findUnorderedStartTimeIndices,
  getAnnotationVariantKey,
  getComparableTimeRangeEnd,
  isTimeRangeOrdered,
  isTimeRangeUncovered,
  isUnresolved,
  lowerNonEmptyTag,
  assignDefinedFields,
} from '@root/utils'

import {
  canonicalizeEnrichedWord,
  getEnrichedWordAnnotationItemText,
  collectEnrichedWordLanguages,
  getEnrichedWordsText,
  validateEnrichedWords,
} from './word'

/**
 * Checks that exactly one non-empty content form is present and validates its words.
 *
 * NONE and LINE require whole-line text; an unresolved line kind may omit content when required is false.
 * Paths are relative to this content unless its location is supplied.
 */
export const validateEnrichedLineContent = (
  content: LineContent | undefined,
  time: TimeRange | undefined,
  path = '',
  timing = TimingLevel.UNSPECIFIED,
  required = true,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const hasWords = content !== undefined && content.words.length > 0
  const hasText = content?.text !== undefined
  if (required && !hasWords && !hasText) {
    diagnostics.push({ path, code: DiagnosticCode.LineContentMissing })
  } else if (hasWords && hasText) {
    diagnostics.push({ path, code: DiagnosticCode.LineContentAmbiguous })
  }
  // Empty text still counts as present for exclusivity.
  if (content?.text === '') {
    diagnostics.push({ path: childPath(path, 'text'), code: DiagnosticCode.LineContentTextEmpty })
  }
  if (hasWords && timing === TimingLevel.NONE) {
    diagnostics.push({ path: childPath(path, 'words'), code: DiagnosticCode.LyricTimingNoneWords })
  } else if (hasWords && timing === TimingLevel.LINE) {
    diagnostics.push({ path: childPath(path, 'words'), code: DiagnosticCode.LyricTimingLineWords })
  }
  diagnostics.push(...validateEnrichedWords(content?.words ?? [], time, childPath(path, 'words'), timing))
  return diagnostics
}

/**
 * Returns plain text when present, otherwise joins the content's words.
 */
export const getEnrichedLineContentText = (content: LineContent | undefined): string => {
  return content?.text ?? getEnrichedWordsText(content?.words ?? [])
}

/**
 * Checks for a non-empty words list without inferring the lyric's timing level.
 */
export const hasEnrichedLineWords = (line: { content?: LineContent | undefined }): boolean => {
  return (line.content?.words.length ?? 0) > 0
}

/**
 * Returns distinct lowercase line languages, using normal-word languages when the line declares none.
 */
export const resolveEnrichedLineLanguages = (line: { languages: string[]; content?: LineContent | undefined }): string[] => {
  if (line.languages.length === 0) {
    return collectEnrichedWordLanguages(line.content?.words ?? [])
  }
  return [...new Set(line.languages.map((tag) => lowerNonEmptyTag(tag)).filter((tag) => tag !== undefined))]
}

/**
 * Creates annotations explicitly attached to a whole line.
 */
export const makeEnrichedLineAnnotation = (init?: MakeInit<LineAnnotation>): LineAnnotation => {
  return assignDefinedFields(createEnrichedLineAnnotation(), init)
}

/**
 * Creates roman content from source fragments without adding whole-line text.
 */
export const makeEnrichedLineAnnotationRomanContentTokens = (tokens: TextToken[]): LineAnnotationRomanContent => {
  return assignDefinedFields(createEnrichedLineAnnotationRomanContent(), { tokens })
}

/**
 * Creates whole-line roman text without fragment timing.
 */
export const makeEnrichedLineAnnotationRomanContentText = (text: string): LineAnnotationRomanContent => {
  return assignDefinedFields(createEnrichedLineAnnotationRomanContent(), { text })
}

/**
 * Checks exclusive content, non-empty text, a token timing anchor, and containment in a declared annotation range.
 *
 * Explicit token times are independent of the original line when the annotation has no declared range.
 */
export const validateEnrichedLineAnnotationRomanContent = (
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
    diagnostics.push(...validateTextToken(token, tokenPath))
    if (isTimeRangeUncovered(token.time, time)) {
      diagnostics.push({ path: childPath(tokenPath, 'time'), code: DiagnosticCode.LineAnnotationRomanTimeUncovered })
    }
  })
  return diagnostics
}

/**
 * Checks the language, declared range, and required roman content independently of the original line.
 *
 * Paths are relative to this romanization unless its location is supplied.
 */
export const validateEnrichedLineAnnotationRoman = (roman: LineAnnotationRoman, path = ''): Diagnostic[] => {
  const diagnostics = validateEnrichedLineAnnotationRomanContent(roman.content, childPath(path, 'content'), roman.time)
  diagnostics.push(...validateLanguageTag(roman.language, childPath(path, 'language')))
  if (roman.time) {
    diagnostics.push(...validateTimeRange(roman.time, childPath(path, 'time')))
  }
  return diagnostics
}

/**
 * Checks romanizations and translations, including their languages, list entries, and variant uniqueness.
 *
 * Paths are relative to this annotation unless its location is supplied.
 */
export const validateEnrichedLineAnnotation = (annotation: LineAnnotation, path = ''): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  findDuplicateIndices(annotation.romans, getAnnotationVariantKey).forEach((i) => {
    diagnostics.push({ path: childPath(path, `romans[${i}]`), code: DiagnosticCode.LineAnnotationRomansDuplicate })
  })
  findDuplicateIndices(annotation.translations, (item) => lowerNonEmptyTag(item.language) ?? '').forEach((i) => {
    diagnostics.push({ path: childPath(path, `translations[${i}]`), code: DiagnosticCode.LineAnnotationTranslationsLanguageDuplicate })
  })
  annotation.romans.forEach((roman, i) => {
    diagnostics.push(...validateEnrichedLineAnnotationRoman(roman, childPath(path, `romans[${i}]`)))
  })
  annotation.translations.forEach((translation, i) => {
    diagnostics.push(...validateLanguageTag(translation.language, childPath(path, `translations[${i}].language`)))
  })
  findDefaultEntries(
    fieldsEnrichedLineAnnotation,
    annotation,
    diagnostics.map((diagnostic) => diagnostic.path),
    path,
  ).forEach((entryPath) => {
    diagnostics.push({ path: entryPath, code: DiagnosticCode.LyricListEntryEmpty })
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
      wordKeys.add(getAnnotationVariantKey(roman))
    }
  }
  const diagnostics: Diagnostic[] = []
  annotation.romans.forEach((roman, i) => {
    if (wordKeys.has(getAnnotationVariantKey(roman))) {
      diagnostics.push({ path: childPath(path, `romans[${i}]`), code: DiagnosticCode.LineAnnotationRomansConflict })
    }
  })
  return diagnostics
}

/**
 * Creates a whole-line romanization without normalizing its language or scheme.
 */
export const makeEnrichedLineAnnotationRoman = (init?: MakeInit<LineAnnotationRoman>): LineAnnotationRoman => {
  return assignDefinedFields(createEnrichedLineAnnotationRoman(), init)
}

/**
 * Creates a translation of a whole line.
 */
export const makeEnrichedLineAnnotationTranslation = (init?: MakeInit<LineAnnotationTranslation>): LineAnnotationTranslation => {
  return assignDefinedFields(createEnrichedLineAnnotationTranslation(), init)
}

/**
 * Copies roman content, preserving fragment order, whitespace, and explicit timing.
 */
export const canonicalizeEnrichedLineAnnotationRomanContent = (content: LineAnnotationRomanContent): LineAnnotationRomanContent => {
  return {
    ...content,
    tokens: canonicalizeList(fieldsCommonTextToken, content.tokens, canonicalizeTextToken),
  }
}

/**
 * Lowercases language and scheme and copies roman content and timing without inferring missing boundaries.
 */
export const canonicalizeEnrichedLineAnnotationRoman = (roman: LineAnnotationRoman): LineAnnotationRoman => {
  return {
    ...roman,
    language: lowerNonEmptyTag(roman.language),
    scheme: lowerNonEmptyTag(roman.scheme),
    time: copyScalarMessage(roman.time),
    content: canonicalizeField(fieldsEnrichedLineAnnotationRomanContent, roman.content, canonicalizeEnrichedLineAnnotationRomanContent),
  }
}

/**
 * Returns whole-line text or joins source fragments without adding separators.
 */
export const getEnrichedLineAnnotationRomanText = (roman: LineAnnotationRoman): string => {
  return roman.content?.text ?? (roman.content?.tokens ?? []).map((token) => token.text).join('')
}

/**
 * Uses the romanization's declared time, falling back to the owning line or background.
 */
export const resolveEnrichedLineAnnotationRomanTime = (roman: LineAnnotationRoman, line: { time?: TimeRange | undefined }): TimeRange | undefined => {
  return roman.time ?? line.time
}

/**
 * Uses the entire token time, then the romanization's time, then the owning line's time.
 */
export const resolveEnrichedLineAnnotationRomanTokenTime = (
  token: TextToken,
  roman: LineAnnotationRoman,
  line: { time?: TimeRange | undefined },
): TimeRange | undefined => {
  return token.time ?? resolveEnrichedLineAnnotationRomanTime(roman, line)
}

/**
 * Lowercases the translation's language tag.
 */
export const canonicalizeEnrichedLineAnnotationTranslation = (translation: LineAnnotationTranslation): LineAnnotationTranslation => {
  return { ...translation, language: lowerNonEmptyTag(translation.language) }
}

/**
 * Canonicalizes line annotations and drops all-default entries.
 */
export const canonicalizeEnrichedLineAnnotation = (annotation: LineAnnotation): LineAnnotation => {
  return {
    ...annotation,
    romans: canonicalizeList(fieldsEnrichedLineAnnotationRoman, annotation.romans, canonicalizeEnrichedLineAnnotationRoman),
    translations: canonicalizeList(fieldsEnrichedLineAnnotationTranslation, annotation.translations, canonicalizeEnrichedLineAnnotationTranslation),
  }
}

/**
 * Aggregates word romanizations into display views by language and scheme in first-appearance order.
 *
 * Words without a matching romanization are skipped; separators collapse to one U+0020.
 * Source timing and token boundaries remain on the original annotations.
 */
export const deriveEnrichedLineRomanViews = (content: LineContent | undefined): LineRomanView[] => {
  const words = content?.words ?? []
  const variants = new Map<string, WordAnnotationRoman>()
  for (const word of words) {
    for (const roman of word.annotation?.romans ?? []) {
      variants.set(getAnnotationVariantKey(roman), roman)
    }
  }
  const views: LineRomanView[] = []
  for (const [key, variant] of variants) {
    let joined = ''
    let spaced = false
    for (const word of words) {
      if (word.type === WordType.SPACE) {
        spaced = true
        continue
      }
      const roman = word.annotation?.romans.find((item) => getAnnotationVariantKey(item) === key)
      const text = roman ? getEnrichedWordAnnotationItemText(roman) : ''
      if (text !== '') {
        joined += joined !== '' && spaced ? ` ${text}` : text
        spaced = false
      }
    }
    if (joined !== '') {
      views.push({
        language: lowerNonEmptyTag(variant.language),
        scheme: lowerNonEmptyTag(variant.scheme),
        text: joined,
      })
    }
  }
  return views
}

/**
 * Creates content from ordered words.
 */
export const makeEnrichedLineContentWords = (words: Word[]): LineContent => {
  return assignDefinedFields(createEnrichedLineContent(), { words })
}

/**
 * Creates content from whole-line text.
 */
export const makeEnrichedLineContentText = (text: string): LineContent => {
  return assignDefinedFields(createEnrichedLineContent(), { text })
}

/**
 * Canonicalizes words and preserves plain text.
 */
export const canonicalizeEnrichedLineContent = (content: LineContent): LineContent => {
  return { ...content, words: canonicalizeList(fieldsEnrichedWord, content.words, canonicalizeEnrichedWord) }
}

/**
 * Creates a normal line with a fixed LINE_TYPE_NORMAL discriminator.
 */
export const makeEnrichedLineNormal = (init?: Omit<MakeInit<Line>, 'type'>): Line => {
  return assignDefinedFields(createEnrichedLine(), {
    id: init?.id,
    type: LineType.NORMAL,
    time: init?.time,
    part: init?.part,
    agentIds: init?.agentIds,
    languages: init?.languages,
    backgrounds: init?.backgrounds,
    content: init?.content,
    annotation: init?.annotation,
  })
}

/**
 * Creates an instrumental line with only id, time, and part.
 *
 * A present part identifies a source declaration; an absent part identifies a derived interval.
 */
export const makeEnrichedLineInstrumental = (init?: Pick<MakeInit<Line>, 'id' | 'time' | 'part'>): Line => {
  return assignDefinedFields(createEnrichedLine(), { id: init?.id, time: init?.time, part: init?.part, type: LineType.INSTRUMENTAL })
}

/**
 * Creates background vocals attached to a normal line.
 */
export const makeEnrichedLineBackground = (init?: MakeInit<LineBackground>): LineBackground => {
  return assignDefinedFields(createEnrichedLineBackground(), init)
}

/**
 * Checks the line kind, permitted fields, timing, annotations, and backgrounds.
 *
 * Unresolved kinds may omit content; supplied timing determines the line's own requirements.
 * Paths are relative to this line unless its location is supplied.
 */
export const validateEnrichedLine = (line: Line, path = '', timing = TimingLevel.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  const instrumental = line.type === LineType.INSTRUMENTAL

  if (isUnresolved(LineType, line.type)) {
    diagnostics.push({ path: childPath(path, 'type'), code: DiagnosticCode.LineTypeUnspecified })
  }
  if (instrumental && timing === TimingLevel.NONE) {
    diagnostics.push({ path: childPath(path, 'type'), code: DiagnosticCode.LyricTimingNoneInstrumental })
  }
  // An instrumental line is the stretch its range marks out, so it is nothing without a range, and nothing with one that never ends or one that ends where it starts.
  // NONE forbids instrumental lines without requiring a range on top.
  const needsRange = instrumental && timing !== TimingLevel.NONE
  if (line.time) {
    if (timing === TimingLevel.NONE) {
      diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LyricTimingNonePresent })
    }
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
  if (line.type === LineType.NORMAL && (timing === TimingLevel.LINE || timing === TimingLevel.WORD) && line.time === undefined) {
    diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LyricTimingLineTimeMissing })
  }
  if (line.part) {
    diagnostics.push(...validatePart(line.part, childPath(path, 'part')))
    if (line.part.type === PartType.INTERLUDE && line.type === LineType.NORMAL) {
      diagnostics.push({ path: childPath(path, 'part.type'), code: DiagnosticCode.LinePartInterludeNotInstrumental })
    }
  }
  // An instrumental line carries no singing, so every field describing one is not allowed, and a forbidden field is never descended into.
  if (instrumental && line.agentIds.length > 0) {
    diagnostics.push({ path: childPath(path, 'agentIds'), code: DiagnosticCode.LineAgentIdsUnexpected })
  }
  if (!instrumental) {
    line.agentIds.forEach((id, i) => {
      if (id === '') {
        diagnostics.push({ path: childPath(path, `agentIds[${i}]`), code: DiagnosticCode.LyricListEntryEmpty })
      }
    })
  }
  if (instrumental && line.languages.length > 0) {
    diagnostics.push({ path: childPath(path, 'languages'), code: DiagnosticCode.LineLanguagesUnexpected })
  } else if (!instrumental) {
    diagnostics.push(...validateLanguageTags(line.languages, childPath(path, 'languages')))
    findDuplicateIndices(line.languages, (tag) => lowerNonEmptyTag(tag) ?? '').forEach((i) => {
      diagnostics.push({ path: childPath(path, `languages[${i}]`), code: DiagnosticCode.LineLanguagesDuplicate })
    })
  }
  // Content belongs to a sung line, so an instrumental one may carry none, while an unresolved kind is asked for none and forbidden none.
  if (instrumental) {
    if (line.content) {
      diagnostics.push({ path: childPath(path, 'content'), code: DiagnosticCode.LineContentUnexpected })
    }
  } else {
    diagnostics.push(...validateEnrichedLineContent(line.content, line.time, childPath(path, 'content'), timing, line.type === LineType.NORMAL))
  }
  if (instrumental && line.annotation !== undefined) {
    diagnostics.push({ path: childPath(path, 'annotation'), code: DiagnosticCode.LineAnnotationUnexpected })
  } else if (line.annotation) {
    diagnostics.push(...validateEnrichedLineAnnotation(line.annotation, childPath(path, 'annotation')))
    diagnostics.push(...validateRomanPlacement(line.annotation, line.content, childPath(path, 'annotation')))
  }
  if (instrumental && line.backgrounds.length > 0) {
    diagnostics.push({ path: childPath(path, 'backgrounds'), code: DiagnosticCode.LineBackgroundsUnexpected })
  } else {
    // The schema declares the list ordered, so an entry starting before the one it follows is out of place.
    findUnorderedStartTimeIndices(line.backgrounds, (background) => background.time).forEach((i) => {
      diagnostics.push({ path: childPath(path, `backgrounds[${i}]`), code: DiagnosticCode.LineBackgroundsUnordered })
    })
    line.backgrounds.forEach((background, i) => {
      const backgroundPath = childPath(path, `backgrounds[${i}]`)
      // The parent's end covers a background line, while its start may precede the parent's; a range reported for its own numbers or order never joins this comparison.
      if (
        isTimeRangeOrdered(line.time) &&
        isTimeRangeOrdered(background.time) &&
        getComparableTimeRangeEnd(background.time) > getComparableTimeRangeEnd(line.time)
      ) {
        diagnostics.push({ path: childPath(backgroundPath, 'time'), code: DiagnosticCode.LineBackgroundsTimeUncovered })
      }
      diagnostics.push(...validateEnrichedLineBackground(background, backgroundPath, timing))
    })
  }
  return diagnostics
}

/**
 * Checks background content, timing, languages, and annotations.
 *
 * Parent containment and references are checked by the enclosing line and lyric.
 * Paths are relative to this background unless its location is supplied.
 */
export const validateEnrichedLineBackground = (background: LineBackground, path = '', timing = TimingLevel.UNSPECIFIED): Diagnostic[] => {
  const diagnostics: Diagnostic[] = []
  if (background.time) {
    if (timing === TimingLevel.NONE) {
      diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LyricTimingNonePresent })
    }
    diagnostics.push(...validateTimeRange(background.time, childPath(path, 'time')))
  } else if (timing === TimingLevel.LINE || timing === TimingLevel.WORD) {
    diagnostics.push({ path: childPath(path, 'time'), code: DiagnosticCode.LyricTimingLineTimeMissing })
  }
  background.agentIds.forEach((id, i) => {
    if (id === '') {
      diagnostics.push({ path: childPath(path, `agentIds[${i}]`), code: DiagnosticCode.LyricListEntryEmpty })
    }
  })
  diagnostics.push(...validateLanguageTags(background.languages, childPath(path, 'languages')))
  findDuplicateIndices(background.languages, (tag) => lowerNonEmptyTag(tag) ?? '').forEach((i) => {
    diagnostics.push({ path: childPath(path, `languages[${i}]`), code: DiagnosticCode.LineLanguagesDuplicate })
  })
  diagnostics.push(...validateEnrichedLineContent(background.content, background.time, childPath(path, 'content'), timing))
  if (background.annotation) {
    diagnostics.push(...validateEnrichedLineAnnotation(background.annotation, childPath(path, 'annotation')))
    diagnostics.push(...validateRomanPlacement(background.annotation, background.content, childPath(path, 'annotation')))
  }
  return diagnostics
}

/**
 * Returns a copy with backgrounds stably ordered by start time.
 */
export const orderEnrichedLineBackgrounds = (line: Line): Line => {
  return { ...line, backgrounds: [...line.backgrounds].sort(byStartTime((background) => background.time)) }
}

/**
 * Normalizes languages and annotations, removes empty references, and canonicalizes content.
 */
export const canonicalizeEnrichedLineBackground = (background: LineBackground): LineBackground => {
  return {
    ...background,
    time: copyScalarMessage(background.time),
    agentIds: background.agentIds.filter((id) => id !== ''),
    languages: [...new Set(background.languages.map((tag) => tag.toLowerCase()).filter((tag) => tag !== ''))],
    content: canonicalizeField(fieldsEnrichedLineContent, background.content, canonicalizeEnrichedLineContent),
    annotation: canonicalizeField(fieldsEnrichedLineAnnotation, background.annotation, canonicalizeEnrichedLineAnnotation),
  }
}

/**
 * Canonicalizes line fields and orders backgrounds, dropping all-default submessages.
 */
export const canonicalizeEnrichedLine = (line: Line): Line => {
  return {
    ...line,
    time: copyScalarMessage(line.time),
    part: unsetIfDefault(fieldsCommonPart, copyScalarMessage(line.part)),
    agentIds: line.agentIds.filter((id) => id !== ''),
    languages: [...new Set(line.languages.map((tag) => tag.toLowerCase()).filter((tag) => tag !== ''))],
    backgrounds: canonicalizeList(fieldsEnrichedLineBackground, line.backgrounds, canonicalizeEnrichedLineBackground).sort(
      byStartTime((background) => background.time),
    ),
    content: canonicalizeField(fieldsEnrichedLineContent, line.content, canonicalizeEnrichedLineContent),
    annotation: canonicalizeField(fieldsEnrichedLineAnnotation, line.annotation, canonicalizeEnrichedLineAnnotation),
  }
}
