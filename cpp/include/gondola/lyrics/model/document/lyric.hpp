#pragma once

#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/document/lyric.gen.hpp>

namespace gondola::lyrics::model::document {
	/**
	 * Uses the current schema version while preserving source declarations without inferring a timing level.
	 */
	[[nodiscard]] Lyric makeLyric(std::string  format  = {},
		std::string                        profile = {},
		common::TimingLevel                timing  = common::TimingLevel::kUnspecified,
		std::optional<common::Meta>        meta    = std::nullopt,
		std::vector<common::Agent>         agents  = {},
		std::vector<Line>                  lines   = {},
		std::map<std::string, std::string> extra   = {});

	/**
	 * Checks version, references, timing declarations, section boundaries, and nested model data.
	 *
	 * Diagnostic paths and order match the other bindings.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLyric(const Lyric& lyric);

	/**
	 * Orders lines and backgrounds by usable start times, preserving source order for equal starts.
	 */
	[[nodiscard]] Lyric orderLyric(Lyric lyric);

	/**
	 * Returns an owned copy with normalized fields, default entries removed, and ordered collections.
	 */
	[[nodiscard]] Lyric canonicalizeLyric(Lyric lyric);

	/**
	 * Encodes a lyric as Protobuf bytes.
	 *
	 * Returns no value for invalid UTF-8 or a message larger than the Protobuf size limit.
	 */
	[[nodiscard]] std::optional<std::string> encode(const Lyric& lyric);

	/**
	 * Decodes Protobuf bytes into an owned lyric model.
	 *
	 * Returns no value for malformed wire data; semantic validation is separate.
	 */
	[[nodiscard]] std::optional<Lyric> decode(std::string_view bytes);
} // namespace gondola::lyrics::model::document
