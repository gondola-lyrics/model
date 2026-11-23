#include "test.hpp"

namespace gondola::lyrics::model::test {
	namespace {
		template <typename Line>
		void nestedExtensionErrorsFor() {
			Line line;
			line.annotation.emplace();
			line.annotation->romans.emplace_back();
			auto& roman = line.annotation->romans[0];
			roman.content.emplace();
			const auto token      = common::makeTextToken(common::makeTimeRange(1000, 1800), "ni", {{"", "value"}});
			roman.content->tokens = {token};
			expectDiagnostics(validateLineAnnotationRoman(roman), {{"content.tokens[0].extra", "text.token.extra.key.empty"}});
			line.content.emplace();
			line.content->words.emplace_back();
			auto& word = line.content->words[0];
			word.annotation.emplace();
			word.annotation->romans.emplace_back();
			word.annotation->romans[0].tokens = {token};
			word.annotation->rubies.emplace_back();
			word.annotation->rubies[0].tokens = {token};
			expectDiagnostics(validateWordAnnotation(*word.annotation),
				{
					{"rubies[0].tokens[0].extra", "text.token.extra.key.empty"},
					{"romans[0].tokens[0].extra", "text.token.extra.key.empty"},
				});
		}

		void nestedExtensionErrors() {
			expectDiagnostics(common::validateTextToken(common::makeTextToken(std::nullopt, "ni", {{"", "value"}}), "token"),
				{
					{"token.extra", "text.token.extra.key.empty"},
				});
			nestedExtensionErrorsFor<document::Line>();
			nestedExtensionErrorsFor<enriched::Line>();
		}

		template <typename Line>
		void extensionOnlyTokensFor() {
			Line line;
			line.content.emplace();
			line.content->words.emplace_back();
			auto& word = line.content->words[0];
			word.annotation.emplace();
			word.annotation->romans.emplace_back();
			const auto token                  = common::makeTextToken(std::nullopt, "", {{"source", ""}});
			word.annotation->romans[0].tokens = {common::TextToken{}, token};
			const auto canonicalWord          = canonicalizeWordAnnotation(*word.annotation);
			expectEqual(canonicalWord.romans[0].tokens, std::vector<common::TextToken>{token}, "Extension-only token is retained while all-default token is removed");
			expectDiagnostics(validateWordAnnotation(canonicalWord), {});
			line.annotation.emplace();
			line.annotation->romans.emplace_back();
			auto& roman = line.annotation->romans[0];
			roman.content.emplace();
			roman.content->tokens     = {common::TextToken{}, token};
			const auto canonicalRoman = canonicalizeLineAnnotationRoman(roman);
			expectEqual(canonicalRoman.content->tokens, std::vector<common::TextToken>{token}, "Line content retains extension-only tokens");
			expectDiagnostics(validateLineAnnotationRoman(canonicalRoman),
				{
					{"content.tokens", "line.annotation.roman.content.tokens.time.missing"},
					{"content.tokens[0].text", "line.annotation.roman.token.text.empty"},
				});
		}

		void extensionOnlyTokens() {
			extensionOnlyTokensFor<document::Line>();
			extensionOnlyTokensFor<enriched::Line>();
		}

		void sourceTokensRemainUntouched() {
			const auto token    = common::makeTextToken(common::makeTimeRange(1000),
				" ni ",
				{
					{"ttml:style-ref", "style-1"},
					{"Case", ""},
					{"case", "lower"},
					{"time", "metadata"},
					{"text", "metadata"},
				});
			const auto document = document::canonicalizeLineAnnotationRoman(
				document::makeLineAnnotationRoman(std::nullopt, std::nullopt, std::nullopt, document::makeLineAnnotationRomanContentTokens({token})));
			const auto enriched = enriched::canonicalizeLineAnnotationRoman(
				enriched::makeLineAnnotationRoman(std::nullopt, std::nullopt, std::nullopt, enriched::makeLineAnnotationRomanContentTokens({token})));
			expectEqual(document.content->tokens, std::vector<common::TextToken>{token}, "Document token preserves timing, whitespace and case-sensitive extensions");
			expectEqual(enriched.content->tokens, std::vector<common::TextToken>{token}, "Enriched token preserves timing, whitespace and case-sensitive extensions");
			const auto metadataTime = common::makeTextToken(std::nullopt, "ni", {{"time", "1000"}});
			expectDiagnostics(common::validateTextToken(metadataTime), {});
			const auto line =
				document::makeLineAnnotationRoman(std::nullopt, std::nullopt, std::nullopt, document::makeLineAnnotationRomanContentTokens({metadataTime}));
			expectDiagnostics(document::validateLineAnnotationRoman(line), {{"content.tokens", "line.annotation.roman.content.tokens.time.missing"}});
		}
	} // namespace

	int textTokenTests() {
		return runCases({
			{"token extension errors propagate through every containing helper", nestedExtensionErrors},
			{"extension-only tokens retain each container's content rules", extensionOnlyTokens},
			{"token normalization preserves source timing and extensions", sourceTokensRemainUntouched},
		});
	}
} // namespace gondola::lyrics::model::test
