import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf'

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
export const childPath = (parent: string, child: string): string => (parent === '' ? child : `${parent}.${child}`)

/**
 * Builds a comparator ordering items by start ascending then end ascending, reading each item's bounds through a callback.
 */
export const byTime =
  <T>(bounds: (item: T) => { start: number; end: number } | undefined) =>
  (a: T, b: T): number => {
    const x = bounds(a)
    const y = bounds(b)
    return (x?.start ?? 0) - (y?.start ?? 0) || (x?.end ?? 0) - (y?.end ?? 0)
  }
