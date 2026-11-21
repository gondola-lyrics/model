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
 * Creates metadata with the supplied source values.
 *
 * Offsets outside sint32 and durations outside uint32 throw std::out_of_range.
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
 * Requires the platform and at least one non-empty identifier.
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
 * Adds the offset to the playback clock before comparing against stored times.
 *
 * An unrepresentable signed result throws std::overflow_error.
 */
	[[nodiscard]] std::int64_t applyTimeOffset(std::int64_t clock, std::int32_t offset);

	/**
 * Recovers the playback clock for a stored time, which may be before playback starts.
 *
 * An unrepresentable signed result throws std::overflow_error.
 */
	[[nodiscard]] std::int64_t removeTimeOffset(std::int64_t time, std::int32_t offset);

} // namespace gondola::lyrics::model::common
