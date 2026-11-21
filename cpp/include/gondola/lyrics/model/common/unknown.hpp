#pragma once

#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/generated/common/unknown.gen.hpp>

namespace gondola::lyrics::model::common {

	/**
 * Creates an unrecognized metadata entry as preserved by the source.
 */
	[[nodiscard]] UnknownEntry makeUnknownEntry(std::string key = {}, std::string value = {});

	/**
 * Collects values for the exact key in their original order.
 */
	[[nodiscard]] std::vector<std::string> getUnknownEntryValues(const std::vector<UnknownEntry>& unknowns, std::string_view key);

} // namespace gondola::lyrics::model::common
