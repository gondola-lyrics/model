import type { DescMessage, MessageInitShape, MessageShape } from '@bufbuild/protobuf'

import { create, equals } from '@bufbuild/protobuf'

/**
 * The user-settable init fields `create` accepts, narrowed from MessageInitShape's plain-object variant.
 * Its `$`-prefixed fields (`$typeName`, `$unknown`) are stripped.
 * Nothing in it is deep-copied, so editing a message or array it carries afterwards can reach the message built from it.
 */
export type MakeInit<Desc extends DescMessage> = Omit<Extract<MessageInitShape<Desc>, { $typeName?: undefined }>, `$${string}`>

/**
 * Matches a full semantic version, per semver.org.
 */
export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

/**
 * The schema declares a time above this bound invalid.
 */
export const MAX_TIME = 2 ** 31 - 1

/**
 * How a number sits against the integer domain a schema field allows.
 * `invalid` marks a value the field could never hold, `overflow` marks an integer of the right sign lying outside the bounds.
 */
export type NumberDomain = 'ok' | 'invalid' | 'overflow'

/**
 * Classifies a number against the inclusive integer bounds a schema field allows.
 * A fraction, NaN or infinity belongs to no field at all, and neither does a negative value in an unsigned one, so those are invalid rather than out of bounds.
 */
export const checkNumberDomain = (value: number, min: number, max: number): NumberDomain => {
  if (!Number.isInteger(value) || (min >= 0 && value < 0)) {
    return 'invalid'
  }
  return value < min || value > max ? 'overflow' : 'ok'
}

/**
 * The bounds a time range holds, so helpers that only read them work on either layer's message and on a plain object.
 */
export type TimeRangeBounds = { start: number; end?: number }

/**
 * Reports whether a time range is set and both its bounds hold numbers the schema allows, so comparing it against another range is meaningful.
 * An unknown end holds no number, so it has no domain to fall outside of.
 */
export const isTimeRangeInDomain = (range: TimeRangeBounds | undefined): range is TimeRangeBounds => {
  if (range === undefined || checkNumberDomain(range.start, 0, MAX_TIME) !== 'ok') {
    return false
  }
  return range.end === undefined || checkNumberDomain(range.end, 0, MAX_TIME) === 'ok'
}

/**
 * Reports whether a time range is in domain and runs the right way, which is what relating two ranges to each other needs on top of their numbers being usable.
 */
export const isTimeRangeOrdered = (range: TimeRangeBounds | undefined): range is TimeRangeBounds => {
  return isTimeRangeInDomain(range) && (range.end === undefined || range.end >= range.start)
}

/**
 * Returns a time range's end as a number two ranges can be compared on, where an unknown end is open above and so ranks past every value a bound may hold.
 */
export const getTimeRangeEnd = (range: TimeRangeBounds | undefined): number => {
  return range?.end ?? MAX_TIME + 1
}

/**
 * Collects the indexes of entries whose key an earlier entry already took, so a list holding one entry per key can report every repeat without reordering or merging anything.
 */
export const findDuplicates = <T>(items: T[], key: (item: T) => string): number[] => {
  const seen = new Set<string>()
  const duplicates: number[] = []
  items.forEach((item, i) => {
    const value = key(item)
    if (seen.has(value)) {
      duplicates.push(i)
    }
    seen.add(value)
  })
  return duplicates
}

/**
 * Joins a parent diagnostic path with a child segment, so a nested field reads as `lines[0].words[1]`.
 */
export const childPath = (parent: string, child: string): string => {
  return parent === '' ? child : `${parent}.${child}`
}

/**
 * Lowercases a language tag to canonical form, treating an empty or unset tag as unset.
 */
export const lowerTag = (tag: string | undefined): string | undefined => {
  return tag ? tag.toLowerCase() : undefined
}

/**
 * Scores a lowercased tag against a lowercased range as the length they share when either extends the other on a subtag boundary, so `ja` never matches `jav`.
 * An exact match scores one more, outranking a tag that only extends the range, and anything else scores 0.
 */
export const scoreTag = (tag: string, range: string): number => {
  if (tag === range) {
    return range.length + 1
  }
  if (tag.startsWith(`${range}-`)) {
    return range.length
  }
  if (range.startsWith(`${tag}-`)) {
    return tag.length
  }
  return 0
}

/**
 * Builds a comparator ordering items by start ascending then end ascending, reading each item's bounds through a callback.
 * An unknown end is open above, so among equal starts it orders after every known one.
 */
export const byTime = <T>(bounds: (item: T) => TimeRangeBounds | undefined) => {
  return (a: T, b: T): number => {
    const x = bounds(a)
    const y = bounds(b)
    return (x?.start ?? 0) - (y?.start ?? 0) || getTimeRangeEnd(x) - getTimeRangeEnd(y)
  }
}

/**
 * Reports whether a message equals a freshly created default, so an all-default submessage can be treated as unset.
 */
const isDefault = <Desc extends DescMessage>(schema: Desc, message: MessageShape<Desc>): boolean => {
  return equals(schema, message, create(schema))
}

/**
 * Drops an all-default submessage to undefined so empty and unset encode alike, keeping a meaningful one as is.
 */
export const dropDefault = <Desc extends DescMessage>(schema: Desc, message: MessageShape<Desc> | undefined): MessageShape<Desc> | undefined => {
  return message && !isDefault(schema, message) ? message : undefined
}

/**
 * Canonicalizes an optional submessage through a callback, then drops it when the result is all-default.
 */
export const canonicalizeField = <Desc extends DescMessage>(
  schema: Desc,
  message: MessageShape<Desc> | undefined,
  canon: (message: MessageShape<Desc>) => MessageShape<Desc>,
): MessageShape<Desc> | undefined => {
  return message ? dropDefault(schema, canon(message)) : undefined
}

/**
 * Canonicalizes each entry of a repeated submessage field through a callback, then drops every all-default entry.
 */
export const canonicalizeList = <Desc extends DescMessage>(
  schema: Desc,
  messages: MessageShape<Desc>[],
  canon: (message: MessageShape<Desc>) => MessageShape<Desc>,
): MessageShape<Desc>[] => {
  return messages.map(canon).filter((message) => !isDefault(schema, message))
}
