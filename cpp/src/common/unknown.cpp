#include <utility>

#include <gondola/lyrics/model/common/unknown.hpp>

namespace gondola::lyrics::model::common {
	UnknownEntry makeUnknownEntry(std::string key, std::string value) {
		return {std::move(key), std::move(value)};
	}

	std::vector<std::string> getUnknownEntryValues(const std::vector<UnknownEntry>& unknowns, std::string_view key) {
		std::vector<std::string> found;
		for (const auto& entry : unknowns) {
			if (entry.key == key) {
				found.push_back(entry.value);
			}
		}
		return found;
	}
} // namespace gondola::lyrics::model::common
