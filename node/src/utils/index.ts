import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf'

/**
 * The user-settable init fields `create` accepts, narrowed from MessageInitShape's plain-object variant.
 * Its `$`-prefixed fields (`$typeName`, `$unknown`) are stripped.
 */
export type MakeInit<Desc extends DescMessage> = Omit<Extract<MessageInitShape<Desc>, { $typeName?: undefined }>, `$${string}`>
