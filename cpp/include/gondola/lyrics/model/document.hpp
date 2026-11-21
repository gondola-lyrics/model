#pragma once

#include <optional>
#include <string>
#include <string_view>

#include <gondola/lyrics/model/common.hpp>
#include <gondola/lyrics/model/generated/document/line.gen.hpp>
#include <gondola/lyrics/model/generated/document/lyric.gen.hpp>
#include <gondola/lyrics/model/generated/document/word.gen.hpp>

namespace gondola::lyrics::model::document {

	/**
 * Encodes a lyric as Protobuf bytes.
 *
 * Returns no value for invalid UTF-8 or a message larger than the Protobuf size limit.
 */
	[[nodiscard]] std::optional<std::string> encode(const Lyric& lyric);

	/**
 * Decodes Protobuf bytes into an owned lyric model.
 *
 * Returns no value for malformed wire data. Semantic validation is separate.
 */
	[[nodiscard]] std::optional<Lyric> decode(std::string_view bytes);

} // namespace gondola::lyrics::model::document
