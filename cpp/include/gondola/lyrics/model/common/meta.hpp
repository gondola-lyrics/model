#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/common/meta.gen.hpp>

namespace gondola::lyrics::model::common {
	/**
	 * Creates metadata with the supplied source values; offset and duration are in milliseconds.
	 *
	 * Offsets outside sint32 and durations outside uint32 throw std::out_of_range.
	 * The schema duration limit of 2^31-1 is checked separately by validateMeta().
	 */
	[[nodiscard]] Meta makeMeta(std::vector<UnknownEntry> unknowns   = {},
		std::int64_t                                  offset     = 0,
		std::optional<std::int64_t>                   duration   = std::nullopt,
		std::optional<std::string>                    language   = std::nullopt,
		std::vector<Text>                             titles     = {},
		std::vector<Text>                             artists    = {},
		std::vector<Text>                             albums     = {},
		std::vector<Text>                             authors    = {},
		std::vector<std::string>                      isrcs      = {},
		std::vector<MetaCredit>                       credits    = {},
		std::vector<MetaReference>                    references = {});

	/**
	 * Creates a credit for the supplied names and role.
	 */
	[[nodiscard]] MetaCredit makeMetaCredit(CreditRole role = CreditRole::kUnspecified, std::optional<std::string> raw = std::nullopt, std::vector<Text> names = {});

	/**
	 * Creates an external reference with its platform and identifiers as supplied.
	 */
	[[nodiscard]] MetaReference makeMetaReference(std::string platform = {}, std::vector<std::string> ids = {});

	/**
	 * Checks metadata values, per-language uniqueness, and child entries.
	 */
	[[nodiscard]] std::vector<Diagnostic> validateMeta(const Meta& meta, std::string_view path = {});

	/**
	 * Checks the credit's role, source label and names.
	 */
	[[nodiscard]] std::vector<Diagnostic> validateMetaCredit(const MetaCredit& credit, std::string_view path = {});

	/**
	 * Requires a non-empty platform, a non-empty identifier list, and every identifier to be non-empty.
	 */
	[[nodiscard]] std::vector<Diagnostic> validateMetaReference(const MetaReference& reference, std::string_view path = {});

	/**
	 * Canonicalizes language tags, nested entries, and recording codes.
	 */
	[[nodiscard]] Meta canonicalizeMeta(Meta meta);

	/**
	 * Canonicalizes the names and drops all-default entries.
	 */
	[[nodiscard]] MetaCredit canonicalizeMetaCredit(MetaCredit credit);

	/**
	 * Lowercases ASCII platform characters and drops empty identifiers.
	 */
	[[nodiscard]] MetaReference canonicalizeMetaReference(MetaReference reference);

	/**
	 * Returns clock + offset in milliseconds for comparison against stored times.
	 *
	 * Uses signed int64 arithmetic without clamping; an unrepresentable result throws std::overflow_error.
	 */
	[[nodiscard]] std::int64_t applyTimeOffset(std::int64_t clock, std::int32_t offset);

	/**
	 * Returns time - offset in milliseconds, recovering a playback clock that may be negative.
	 *
	 * Uses signed int64 arithmetic without clamping; an unrepresentable result throws std::overflow_error.
	 */
	[[nodiscard]] std::int64_t removeTimeOffset(std::int64_t time, std::int32_t offset);
} // namespace gondola::lyrics::model::common
