#pragma once

#include <optional>
#include <string>

namespace gondola::lyrics::model::common {

	// Source annotations retain the times and token boundaries needed for playback.
	struct LineRomanView {
		std::optional<std::string> language;
		std::optional<std::string> scheme;
		std::string                text;
	};

} // namespace gondola::lyrics::model::common
