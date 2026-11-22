#pragma once

#include <cstddef>
#include <string_view>

namespace gondola::lyrics::model::utils {

	// Match Unicode White_Space on UTF-8 bytes independently of the process locale.
	inline std::size_t separatorWidth(std::string_view text) noexcept {
		if (text.empty()) {
			return 0;
		}
		const auto first = static_cast<unsigned char>(text[0]);
		if (first == ' ' || (first >= 0x09 && first <= 0x0d)) {
			return 1;
		}
		if (text.size() >= 2 && first == 0xc2) {
			const auto second = static_cast<unsigned char>(text[1]);
			return second == 0x85 || second == 0xa0 ? 2 : 0;
		}
		if (text.size() >= 3) {
			const auto second = static_cast<unsigned char>(text[1]);
			const auto third  = static_cast<unsigned char>(text[2]);
			if ((first == 0xe1 && second == 0x9a && third == 0x80) ||
				(first == 0xe2 && second == 0x80 && ((third >= 0x80 && third <= 0x8a) || third == 0xa8 || third == 0xa9 || third == 0xaf)) ||
				(first == 0xe2 && second == 0x81 && third == 0x9f) || (first == 0xe3 && second == 0x80 && third == 0x80)) {
				return 3;
			}
		}
		return 0;
	}

	inline bool hasSeparator(std::string_view text) noexcept {
		while (!text.empty()) {
			if (separatorWidth(text) != 0) {
				return true;
			}
			text.remove_prefix(1);
		}
		return false;
	}

	inline bool isSeparatorText(std::string_view text) noexcept {
		if (text.empty()) {
			return false;
		}
		while (!text.empty()) {
			const auto width = separatorWidth(text);
			if (width == 0) {
				return false;
			}
			text.remove_prefix(width);
		}
		return true;
	}

} // namespace gondola::lyrics::model::utils
