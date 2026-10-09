import type { DescEnum, DescMessage, MessageInitShape, MessageShape } from '@bufbuild/protobuf'

import { create, equals, ScalarType } from '@bufbuild/protobuf'
import { TimeRangeSchema } from '@root/common/proto'

/**
 * The user-settable init fields `create` accepts, narrowed from MessageInitShape's plain-object variant.
 * Its `$`-prefixed fields (`$typeName`, `$unknown`) are stripped.
 * Nothing in it is deep-copied, so editing a message or array it carries afterwards can reach the message built from it.
 * Every `make*` stores what it is given: canonical form is `canonicalize*`'s to produce and `validate*` reports nothing about it, so a lyric built by hand is as the producer wrote it until it is canonicalized.
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
 * Reports whether a value is the zero value of an enum, which the schema reads as "the field was not set" rather than as a resolved value.
 * A value the enum does not declare at all reads the same way, so a producer's future value is treated as unresolved here instead of being reported as an error.
 */
export const isUnresolved = (schema: DescEnum, value: number): boolean => {
  return value === 0 || schema.value[value] === undefined
}

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
 * Collects the indexes of entries whose start time falls before the last start seen, so a list the schema declares ordered can report every entry out of place.
 * Entries carrying no usable range are passed over rather than treated as early, since a range that says nothing about when it starts cannot say it starts too soon.
 */
export const findUnordered = <T>(items: T[], bounds: (item: T) => TimeRangeBounds | undefined): number[] => {
  const unordered: number[] = []
  let last: number | undefined
  items.forEach((item, i) => {
    const range = bounds(item)
    if (!isTimeRangeOrdered(range)) {
      return
    }
    if (last !== undefined && range.start < last) {
      unordered.push(i)
    }
    last = range.start
  })
  return unordered
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
 * Unknown fields count as payload even though `equals` ignores them by default.
 */
const isDefault = <Desc extends DescMessage>(schema: Desc, message: MessageShape<Desc>): boolean => {
  if (message.$unknown?.length) {
    return false
  }
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

/**
 * The schemas whose all-default instance is meaningful anyway, so a field of one may hold the default.
 * A time range says when something happens even when it says nothing about its bounds, while every other message reads the same empty as unset.
 */
const DEFAULT_IS_MEANINGFUL: readonly DescMessage[] = [TimeRangeSchema]

/**
 * Reports whether a path locates `path` or something below it, so an entry another rule already spoke about is recognized.
 */
const coversPath = (other: string, path: string): boolean => {
  return other === path || other.startsWith(`${path}.`) || other.startsWith(`${path}[`)
}

/**
 * Walks a message from its schema, collecting the path of every entry in a repeated field that is all default.
 */
const collectDefaultEntries = (schema: DescMessage, message: MessageShape<DescMessage>, path: string): string[] => {
  if (DEFAULT_IS_MEANINGFUL.includes(schema)) {
    return []
  }
  const found: string[] = []
  const entries = message as unknown as Record<string, unknown>
  for (const field of schema.fields) {
    const child = path === '' ? field.localName : `${path}.${field.localName}`
    if (field.fieldKind === 'list') {
      const values = entries[field.localName] as readonly unknown[]
      if (field.message !== undefined) {
        values.forEach((value, i) => {
          const entryPath = `${child}[${i}]`
          if (isDefault(field.message, value as MessageShape<DescMessage>)) {
            found.push(entryPath)
          }
          found.push(...collectDefaultEntries(field.message, value as MessageShape<DescMessage>, entryPath))
        })
      } else if (field.scalar === ScalarType.STRING) {
        // An empty string is the scalar default, and a repeated string field never holds one for the same reason as a message entry.
        values.forEach((value, i) => {
          if (value === '') {
            found.push(`${child}[${i}]`)
          }
        })
      }
    } else if (field.fieldKind === 'message' && entries[field.localName] !== undefined) {
      found.push(...collectDefaultEntries(field.message, entries[field.localName] as MessageShape<DescMessage>, child))
    }
  }
  return found
}

/**
 * Collects the path of every entry in a repeated field that is all default, reading the whole tree from its schema.
 * A repeated field never holds one, since a list the source never mentioned at that index shifts the ones after it and counts as a declaration of its own.
 * `covered` holds the paths an existing diagnostic locates, which silence an entry at or above them, so a rule that already spoke about a field is not restated by this sweep.
 */
export const findDefaultEntries = (schema: DescMessage, message: MessageShape<DescMessage>, covered: readonly string[] = []): string[] => {
  return collectDefaultEntries(schema, message, '').filter((path) => !covered.some((other) => coversPath(other, path)))
}
