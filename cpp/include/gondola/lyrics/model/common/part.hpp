#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/common/part.gen.hpp>

namespace gondola::lyrics::model::common {

	/**
 * Creates a structural part with its optional identifier and source label.
 */
	[[nodiscard]] Part makePart(PartType type = PartType::kUnspecified, std::optional<std::string> id = std::nullopt, std::optional<std::string> raw = std::nullopt);

	/**
 * Checks that the part type is resolved and that an other type has its source label.
 */
	[[nodiscard]] std::vector<Diagnostic> validatePart(const Part& part, std::string_view path = {});

} // namespace gondola::lyrics::model::common
