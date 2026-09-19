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
