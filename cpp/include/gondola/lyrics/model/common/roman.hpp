#pragma once

#include <optional>
#include <string>

namespace gondola::lyrics::model::common {
	/**
	 * Owns display text aggregated from word romanizations and its normalized language and scheme.
	 *
	 * Timing and token boundaries remain on the source annotations; the view does not borrow their storage.
	 */
	struct LineRomanView {
		std::optional<std::string> language;
		std::optional<std::string> scheme;
		std::string                text;
	};
} // namespace gondola::lyrics::model::common
