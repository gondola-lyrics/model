#include <algorithm>
#include <iterator>

#include <gondola/lyrics/model/common/language.hpp>

namespace gondola::lyrics::model::common {
	namespace {

		// RFC 5646 fixes these additional tags separately from the ordinary tag grammar.
		constexpr std::string_view kGrandfatheredTags[] = {
			"en-gb-oed",
			"i-ami",
			"i-bnn",
			"i-default",
			"i-enochian",
			"i-hak",
			"i-klingon",
			"i-lux",
			"i-mingo",
			"i-navajo",
			"i-pwn",
			"i-tao",
			"i-tay",
			"i-tsu",
			"sgn-be-fr",
			"sgn-be-nl",
			"sgn-ch-de",
			"art-lojban",
			"cel-gaulish",
			"no-bok",
			"no-nyn",
			"zh-guoyu",
			"zh-hakka",
			"zh-min",
			"zh-min-nan",
			"zh-xiang",
		};

		char asciiLower(char character) {
			return character >= 'A' && character <= 'Z' ? static_cast<char>(character + ('a' - 'A')) : character;
		}

		bool isAlpha(char character) {
			const auto lower = asciiLower(character);
			return lower >= 'a' && lower <= 'z';
		}

		bool isDigit(char character) {
			return character >= '0' && character <= '9';
		}

		bool isAlphanumeric(char character) {
			return isAlpha(character) || isDigit(character);
		}

		bool isPrivateUse(std::string_view subtag) {
			return subtag == "x" || subtag == "X";
		}

		std::string_view takeSubtag(std::string_view& remaining) {
			const auto separator = remaining.find('-');
			const auto subtag    = remaining.substr(0, separator);
			remaining            = separator == std::string_view::npos ? std::string_view{} : remaining.substr(separator + 1);
			return subtag;
		}

		bool hasLetters(std::string_view subtag, std::size_t size) {
			return subtag.size() == size && std::all_of(subtag.begin(), subtag.end(), isAlpha);
		}

		bool isRegion(std::string_view subtag) {
			return hasLetters(subtag, 2) || (subtag.size() == 3 && std::all_of(subtag.begin(), subtag.end(), isDigit));
		}

		bool isVariant(std::string_view subtag) {
			return subtag.size() >= 5 || (subtag.size() == 4 && isDigit(subtag.front()));
		}

	} // namespace

	namespace internal {

		bool equalAsciiCaseInsensitive(std::string_view a, std::string_view b) noexcept {
			return std::equal(a.begin(), a.end(), b.begin(), b.end(), [](char left, char right) { return asciiLower(left) == asciiLower(right); });
		}

		std::size_t scoreLanguageTag(std::string_view tag, std::string_view wanted) noexcept {
			const auto shared = std::min(tag.size(), wanted.size());
			if (shared == 0 || !equalAsciiCaseInsensitive(tag.substr(0, shared), wanted.substr(0, shared))) {
				return 0;
			}
			if (tag.size() == wanted.size()) {
				return shared + 1;
			}
			const auto longer = tag.size() > wanted.size() ? tag : wanted;
			return longer[shared] == '-' ? shared : 0;
		}

	} // namespace internal

	bool isWellFormedLanguageTag(std::string_view tag) noexcept {
		if (tag.empty() || tag.back() == '-') {
			return false;
		}
		for (auto remaining = tag; !remaining.empty();) {
			const auto subtag = takeSubtag(remaining);
			if (subtag.empty() || subtag.size() > 8 || !std::all_of(subtag.begin(), subtag.end(), isAlphanumeric)) {
				return false;
			}
		}

		if (std::any_of(std::begin(kGrandfatheredTags), std::end(kGrandfatheredTags), [&](std::string_view grandfathered) {
			    return internal::equalAsciiCaseInsensitive(tag, grandfathered);
		    })) {
			return true;
		}

		const auto language = takeSubtag(tag);
		if (isPrivateUse(language)) {
			return !tag.empty();
		}
		if (language.size() < 2 || !std::all_of(language.begin(), language.end(), isAlpha)) {
			return false;
		}

		auto subtag = takeSubtag(tag);
		if (language.size() <= 3) {
			for (int extlangs = 0; extlangs < 3 && hasLetters(subtag, 3); ++extlangs) {
				subtag = takeSubtag(tag);
			}
		}
		if (hasLetters(subtag, 4)) {
			subtag = takeSubtag(tag);
		}
		if (isRegion(subtag)) {
			subtag = takeSubtag(tag);
		}
		while (isVariant(subtag)) {
			subtag = takeSubtag(tag);
		}

		while (subtag.size() == 1) {
			if (isPrivateUse(subtag)) {
				return !tag.empty();
			}
			subtag = takeSubtag(tag);
			if (subtag.size() < 2) {
				return false;
			}
			do {
				subtag = takeSubtag(tag);
			} while (subtag.size() >= 2);
		}
		return subtag.empty();
	}

} // namespace gondola::lyrics::model::common
