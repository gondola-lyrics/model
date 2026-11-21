#include <utility>

#include <gondola/lyrics/model/common/text.hpp>
#include <gondola/lyrics/model/common/time.hpp>

#include "utils/common.hpp"

namespace gondola::lyrics::model::common {

	Text makeText(std::optional<std::string> language, std::string text) {
		return {std::move(language), std::move(text)};
	}

	std::vector<Diagnostic> validateText(const Text& text, std::string_view path) {
		std::vector<Diagnostic> diagnostics;
		if (text.text.empty()) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kTextTextEmpty});
		}
		utils::validate_language(text.language, path, diagnostics);
		return diagnostics;
	}

	Text canonicalizeText(Text text) {
		utils::normalize_language(text.language);
		return text;
	}

	TextToken makeTextToken(std::optional<TimeRange> time, std::string text, std::map<std::string, std::string> extra) {
		return {std::move(time), std::move(text), std::move(extra)};
	}

	std::vector<Diagnostic> validateTextToken(const TextToken& token, std::string_view path) {
		std::vector<Diagnostic> diagnostics;
		if (token.time) {
			diagnostics = validateTimeRange(*token.time, utils::child_path(path, "time"));
		}
		if (token.extra.find("") != token.extra.end()) {
			diagnostics.push_back({utils::child_path(path, "extra"), DiagnosticCode::kTextTokenExtraKeyEmpty});
		}
		return diagnostics;
	}

	TextToken canonicalizeTextToken(TextToken token) {
		return token;
	}

} // namespace gondola::lyrics::model::common
