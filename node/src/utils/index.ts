import type { DescMessage, MessageInitShape, MessageShape } from '@bufbuild/protobuf'

import { create, equals } from '@bufbuild/protobuf'

/**
 * The user-settable init fields `create` accepts, narrowed from MessageInitShape's plain-object variant.
 * Its `$`-prefixed fields (`$typeName`, `$unknown`) are stripped.
 */
export type MakeInit<Desc extends DescMessage> = Omit<Extract<MessageInitShape<Desc>, { $typeName?: undefined }>, `$${string}`>

/**
 * Matches a full semantic version, per semver.org.
 */
export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

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
 */
export const byTime = <T>(bounds: (item: T) => { start: number; end: number } | undefined) => {
  return (a: T, b: T): number => {
    const x = bounds(a)
    const y = bounds(b)
    return (x?.start ?? 0) - (y?.start ?? 0) || (x?.end ?? 0) - (y?.end ?? 0)
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
