import type { FieldInfo, MessageFields } from '@root/generated/detail.gen'

import { fieldsCommonTimeRange } from '@root/generated/detail.gen'

/**
 * The fields a `make*` takes, each of which may be left out or undefined to keep its default.
 * Nothing in it is copied, so editing a structure or array it carries afterwards can reach the structure built from it.
 * Every `make*` stores what it is given: canonical form is `canonicalize*`'s to produce and `validate*` reports nothing about it, so a lyric built by hand is as the producer wrote it until it is canonicalized.
 */
export type MakeInit<T> = { [K in keyof T]?: T[K] | undefined }

/**
 * Assigns the fields init sets to a freshly created structure, skipping undefined and null so an unset field keeps its default and an optional one stays absent.
 */
export const withInit = <T extends object>(message: T, init: MakeInit<T> | undefined): T => {
  if (init !== undefined) {
    for (const key of Object.keys(init) as (keyof T)[]) {
      const value = init[key]
      if (value !== undefined && value !== null) {
        message[key] = value as T[keyof T]
      }
    }
  }
  return message
}

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
export const isUnresolved = (enumeration: Record<number, string>, value: number): boolean => {
  return value === 0 || enumeration[value] === undefined
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
export type TimeRangeBounds = { start: number; end?: number | undefined }

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
 * Stands in for an end left unknown, which is open above and so ranks past every bound.
 * It lies outside the domain the schema allows, so no end a range may actually hold can equal it.
 */
const OPEN_END = Number.MAX_SAFE_INTEGER

/**
 * Returns a time range's end as a number two ranges can be compared on, where an unknown end is open above and so ranks past every value a bound may hold.
 */
export const getTimeRangeEnd = (range: TimeRangeBounds | undefined): number => {
  return range?.end ?? OPEN_END
}

/**
 * Reports whether a range reaches past either bound of the one containing it.
 * Relating two ranges needs both to run the right way, so a range already reported for its own numbers joins no comparison on either side, and an unset one has nothing to fall outside of.
 */
export const isTimeRangeUncovered = (range: TimeRangeBounds | undefined, parent: TimeRangeBounds | undefined): boolean => {
  if (!isTimeRangeOrdered(range) || !isTimeRangeOrdered(parent)) {
    return false
  }
  return range.start < parent.start || getTimeRangeEnd(range) > getTimeRangeEnd(parent)
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
 * Compares two language tags the way the schema reads them, which is without case, so an order by tag never turns on how one was spelled.
 */
export const compareTags = (a: string, b: string): number => {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  return x < y ? -1 : x > y ? 1 : 0
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
 * An item whose range cannot be related to another's claims no place among those that can, so it keeps its own order after all of them; `findUnordered` passes over exactly those items, so ordering and validating never contradict each other.
 */
export const byTime = <T>(bounds: (item: T) => TimeRangeBounds | undefined) => {
  return (a: T, b: T): number => {
    const x = bounds(a)
    const y = bounds(b)
    if (!isTimeRangeOrdered(x)) {
      return isTimeRangeOrdered(y) ? 1 : 0
    }
    if (!isTimeRangeOrdered(y)) {
      return -1
    }
    return x.start - y.start || getTimeRangeEnd(x) - getTimeRangeEnd(y)
  }
}

/**
 * Reports whether a field holds its default, where an optional field set to a zero value still counts as set, since its presence is data.
 */
const isFieldDefault = (field: FieldInfo, value: unknown): boolean => {
  switch (field.shape) {
    case 'scalar':
    case 'enum':
      return value === '' || value === 0 || value === false
    case 'optional':
    case 'message':
      return value === undefined
    case 'list-scalar':
    case 'list-message':
      return (value as readonly unknown[]).length === 0
    case 'map':
      return Object.keys(value as object).length === 0
  }
}

/**
 * Reports whether every field of a structure holds its default, so an all-default submessage can be treated as unset.
 */
const isDefault = <T>(schema: MessageFields<T>, message: T): boolean => {
  const entries = message as Record<string, unknown>
  return schema.fields.every((field) => isFieldDefault(field, entries[field.name]))
}

/**
 * Drops an all-default submessage to undefined so empty and unset encode alike, keeping a meaningful one as is.
 */
export const dropDefault = <T>(schema: MessageFields<T>, message: T | undefined): T | undefined => {
  return message && !isDefault(schema, message) ? message : undefined
}

/**
 * Copies an optional submessage a canonicalizing helper carries over unchanged, since handing back the one it was given would share it with the caller's input.
 * Every submessage canonicalization leaves as it is holds scalars alone, so copying its own fields copies all of it.
 */
export const copyMessage = <T extends object>(message: T | undefined): T | undefined => {
  return message === undefined ? undefined : { ...message }
}

/**
 * Canonicalizes an optional submessage through a callback, then drops it when the result is all-default.
 */
export const canonicalizeField = <T>(schema: MessageFields<T>, message: T | undefined, canon: (message: T) => T): T | undefined => {
  return message ? dropDefault(schema, canon(message)) : undefined
}

/**
 * Canonicalizes each entry of a repeated submessage field through a callback, then drops every all-default entry.
 */
export const canonicalizeList = <T>(schema: MessageFields<T>, messages: T[], canon: (message: T) => T): T[] => {
  return messages.map(canon).filter((message) => !isDefault(schema, message))
}

/**
 * The structures whose all-default instance is meaningful anyway, so a field of one may hold the default.
 * A time range says when something happens even when it says nothing about its bounds, while every other message reads the same empty as unset.
 */
const DEFAULT_IS_MEANINGFUL: readonly MessageFields<any>[] = [fieldsCommonTimeRange]

/**
 * Reports whether a path locates `path` or something below it, so an entry another rule already spoke about is recognized.
 */
const coversPath = (other: string, path: string): boolean => {
  return other === path || other.startsWith(`${path}.`) || other.startsWith(`${path}[`)
}

/**
 * Walks a structure by its field table, collecting the path of every entry in a repeated field that is all default.
 */
const collectDefaultEntries = (schema: MessageFields<any>, message: unknown, path: string): string[] => {
  if (DEFAULT_IS_MEANINGFUL.includes(schema)) {
    return []
  }
  const found: string[] = []
  const entries = message as Record<string, unknown>
  for (const field of schema.fields) {
    const child = path === '' ? field.name : `${path}.${field.name}`
    if (field.shape === 'list-message') {
      const values = entries[field.name] as readonly unknown[]
      values.forEach((value, i) => {
        const entryPath = `${child}[${i}]`
        if (isDefault(field.message, value)) {
          found.push(entryPath)
        }
        found.push(...collectDefaultEntries(field.message, value, entryPath))
      })
    } else if (field.shape === 'list-scalar') {
      // An empty string is the scalar default, and a repeated string field never holds one for the same reason as a message entry.
      const values = entries[field.name] as readonly unknown[]
      values.forEach((value, i) => {
        if (value === '') {
          found.push(`${child}[${i}]`)
        }
      })
    } else if (field.shape === 'message' && entries[field.name] !== undefined) {
      found.push(...collectDefaultEntries(field.message, entries[field.name], child))
    }
  }
  return found
}

/**
 * Collects the path of every entry in a repeated field that is all default, reading the whole tree by its field tables.
 * A repeated field never holds one, since a list the source never mentioned at that index shifts the ones after it and counts as a declaration of its own.
 * `covered` holds the paths an existing diagnostic locates, which silence an entry at or above them, so a rule that already spoke about a field is not restated by this sweep.
 */
export const findDefaultEntries = <T>(schema: MessageFields<T>, message: T, covered: readonly string[] = []): string[] => {
  return collectDefaultEntries(schema, message, '').filter((path) => !covered.some((other) => coversPath(other, path)))
}
