#pragma once

#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/enriched/lyric.gen.hpp>

namespace gondola::lyrics::model::enriched {

	// Uses the current schema version and throws std::invalid_argument for a status other than valid or invalid.
	[[nodiscard]] Lyric makeLyric(LyricStatus  status,
		std::string                        format         = {},
		std::string                        profile        = {},
		common::TimingLevel                timing         = common::TimingLevel::kUnspecified,
		std::optional<common::Meta>        meta           = std::nullopt,
		std::vector<common::Agent>         agents         = {},
		std::vector<Line>                  lines          = {},
		std::vector<LanguageUsage>         languageUsages = {},
		std::map<std::string, std::string> extra          = {});

	// Checks cross references, timing rules, section boundaries, and nested model data.
	[[nodiscard]] std::vector<common::Diagnostic> validateLyric(const Lyric& lyric);

	// Orders lines and backgrounds by start time and language usages by count and tag.
	[[nodiscard]] Lyric orderLyric(Lyric lyric);

	// Returns an owned copy with normalized fields and ordered collections.
	[[nodiscard]] Lyric canonicalizeLyric(Lyric lyric);

	// Returns no value for invalid UTF-8 or a message larger than the Protobuf size limit.
	[[nodiscard]] std::optional<std::string> encode(const Lyric& lyric);

	// Returns no value for malformed wire data; semantic validation is separate.
	[[nodiscard]] std::optional<Lyric> decode(std::string_view bytes);

} // namespace gondola::lyrics::model::enriched
