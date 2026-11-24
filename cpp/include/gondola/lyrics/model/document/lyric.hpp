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
	 *
	 * Supplied content is not validated or normalized.
	 */
	[[nodiscard]] Lyric makeLyric(std::string  format  = {},
		std::string                        profile = {},
		common::TimingLevel                timing  = common::TimingLevel::kUnspecified,
		std::optional<common::Meta>        meta    = std::nullopt,
		std::vector<common::Agent>         agents  = {},
		std::vector<Line>                  lines   = {},
		std::map<std::string, std::string> extra   = {});

	/**
	 * Checks schema-version syntax, references, timing declarations, section boundaries, and nested model data without changing the lyric.
	 *
	 * An empty result means these semantic checks passed; schema compatibility and UTF-8 encodability are separate checks.
	 * Diagnostic paths use the shared camelCase convention and zero-based indices.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLyric(const Lyric& lyric);

	/**
	 * Orders lines and backgrounds by usable start times, preserving source order for ties and leaving unset or invalid ranges at the end.
	 */
	[[nodiscard]] Lyric orderLyric(Lyric lyric);

	/**
	 * Normalizes identifiers and nested data, removes default entries, and orders lines and backgrounds in the supplied value.
	 *
	 * Preserves version, timing declarations, and source text; the result still requires semantic validation.
	 */
	[[nodiscard]] Lyric canonicalizeLyric(Lyric lyric);

	/**
	 * Encodes a lyric as owned Protobuf bytes in a binary string that may contain NUL bytes.
	 *
	 * Returns nullopt for invalid UTF-8 in strings or a message larger than 2^31-1 bytes.
	 * Does not validate semantics, normalize the model, or check schema compatibility.
	 * Standard allocation and container exceptions propagate rather than returning nullopt.
	 */
	[[nodiscard]] std::optional<std::string> encode(const Lyric& lyric);

	/**
	 * Decodes Protobuf bytes into an owned lyric model.
	 *
	 * Returns nullopt for malformed wire data, invalid UTF-8 in known string fields, input larger than 2^31-1 bytes, or excessive unknown-group nesting.
	 * Empty input produces a default model; unknown fields are discarded, while unknown enum numbers are retained.
	 * Does not validate semantics, normalize the model, or check schema compatibility.
	 * The result does not borrow bytes; standard allocation and container exceptions propagate rather than returning nullopt.
	 */
	[[nodiscard]] std::optional<Lyric> decode(std::string_view bytes);
} // namespace gondola::lyrics::model::document
