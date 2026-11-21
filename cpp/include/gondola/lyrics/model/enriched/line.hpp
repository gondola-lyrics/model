#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/common/roman.hpp>
#include <gondola/lyrics/model/generated/common/agent.gen.hpp>
#include <gondola/lyrics/model/generated/enriched/line.gen.hpp>

namespace gondola::lyrics::model::enriched {

	[[nodiscard]] LineAnnotationRomanContent makeLineAnnotationRomanContentTokens(std::vector<common::TextToken> tokens);
	[[nodiscard]] LineAnnotationRomanContent makeLineAnnotationRomanContentText(std::string text);
	[[nodiscard]] LineAnnotationRoman        makeLineAnnotationRoman(std::optional<std::string> language = std::nullopt,
		std::optional<std::string>                                                   scheme          = std::nullopt,
		std::optional<common::TimeRange>                                             time            = std::nullopt,
		std::optional<LineAnnotationRomanContent>                                    content         = std::nullopt);
	[[nodiscard]] LineAnnotationTranslation  makeLineAnnotationTranslation(std::optional<std::string> language = std::nullopt, std::string text = {});
	[[nodiscard]] LineAnnotation             makeLineAnnotation(std::vector<LineAnnotationRoman> romans = {}, std::vector<LineAnnotationTranslation> translations = {});
	[[nodiscard]] LineContent                makeLineContentWords(std::vector<Word> words);
	[[nodiscard]] LineContent                makeLineContentText(std::string text);

	[[nodiscard]] Line makeLineNormal(std::string id          = {},
		std::optional<common::TimeRange>      time        = std::nullopt,
		std::optional<common::Part>           part        = std::nullopt,
		std::vector<std::string>              agentIds    = {},
		std::vector<std::string>              languages   = {},
		std::vector<LineBackground>           backgrounds = {},
		std::optional<LineContent>            content     = std::nullopt,
		std::optional<LineAnnotation>         annotation  = std::nullopt);
	[[nodiscard]] Line makeLineInstrumental(std::string id = {}, std::optional<common::TimeRange> time = std::nullopt, std::optional<common::Part> part = std::nullopt);
	[[nodiscard]] LineBackground makeLineBackground(std::string id         = {},
		std::optional<common::TimeRange>                    time       = std::nullopt,
		std::vector<std::string>                            agentIds   = {},
		std::vector<std::string>                            languages  = {},
		std::optional<LineContent>                          content    = std::nullopt,
		std::optional<LineAnnotation>                       annotation = std::nullopt);

	// Explicit text wins even when empty; words are joined only when text is unset.
	[[nodiscard]] std::string getLineContentText(const LineContent& content);
	[[nodiscard]] std::string getLineContentText(const std::optional<LineContent>& content);
	[[nodiscard]] bool        hasLineWords(const Line& line) noexcept;
	[[nodiscard]] bool        hasLineWords(const LineBackground& line) noexcept;

	// Uses normal word languages only when the line declares no languages of its own.
	[[nodiscard]] std::vector<std::string> resolveLineLanguages(const Line& line);
	[[nodiscard]] std::vector<std::string> resolveLineLanguages(const LineBackground& line);

	// Returned agent pointers refer to elements of the supplied vector.
	[[nodiscard]] std::vector<const common::Agent*> resolveLineAgents(const Line& line, const std::vector<common::Agent>& agents);
	[[nodiscard]] std::vector<const common::Agent*> resolveLineAgents(const LineBackground& line, const std::vector<common::Agent>& agents);
	std::vector<const common::Agent*>               resolveLineAgents(const Line&, const std::vector<common::Agent>&&)           = delete;
	std::vector<const common::Agent*>               resolveLineAgents(const LineBackground&, const std::vector<common::Agent>&&) = delete;

	[[nodiscard]] std::string                      getLineAnnotationRomanText(const LineAnnotationRoman& roman);
	[[nodiscard]] std::optional<common::TimeRange> resolveLineAnnotationRomanTime(const LineAnnotationRoman& roman, const Line& line) noexcept;
	[[nodiscard]] std::optional<common::TimeRange> resolveLineAnnotationRomanTime(const LineAnnotationRoman& roman, const LineBackground& line) noexcept;
	[[nodiscard]] std::optional<common::TimeRange> resolveLineAnnotationRomanTokenTime(const common::TextToken& token,
		const LineAnnotationRoman&                                                                          roman,
		const Line&                                                                                         line) noexcept;
	[[nodiscard]] std::optional<common::TimeRange> resolveLineAnnotationRomanTokenTime(const common::TextToken& token,
		const LineAnnotationRoman&                                                                          roman,
		const LineBackground&                                                                               line) noexcept;

	// Aggregates display text by language and scheme in first appearance order; separator words collapse to a single space between contributions.
	[[nodiscard]] std::vector<common::LineRomanView> deriveLineRomanViews(const LineContent& content);
	[[nodiscard]] std::vector<common::LineRomanView> deriveLineRomanViews(const std::optional<LineContent>& content);

	// Validates annotation tokens against their own declared range, independently of the original line's timing.
	[[nodiscard]] std::vector<common::Diagnostic> validateLineAnnotationRomanContent(const std::optional<LineAnnotationRomanContent>& content,
		std::string_view                                                                                                          path = {},
		const std::optional<common::TimeRange>&                                                                                   time = std::nullopt);
	[[nodiscard]] std::vector<common::Diagnostic> validateLineAnnotationRoman(const LineAnnotationRoman& roman, std::string_view path = {});
	[[nodiscard]] std::vector<common::Diagnostic> validateLineAnnotation(const LineAnnotation& annotation, std::string_view path = {});
	[[nodiscard]] std::vector<common::Diagnostic> validateLineContent(const std::optional<LineContent>& content,
		const std::optional<common::TimeRange>&                                                     time     = std::nullopt,
		std::string_view                                                                            path     = {},
		common::TimingLevel                                                                         timing   = common::TimingLevel::kUnspecified,
		bool                                                                                        required = true);
	[[nodiscard]] std::vector<common::Diagnostic> validateLineBackground(const LineBackground& background,
		std::string_view                                                                   path   = {},
		common::TimingLevel                                                                timing = common::TimingLevel::kUnspecified);
	[[nodiscard]] std::vector<common::Diagnostic> validateLine(const Line& line, std::string_view path = {}, common::TimingLevel timing = common::TimingLevel::kUnspecified);

	[[nodiscard]] LineAnnotationRomanContent canonicalizeLineAnnotationRomanContent(LineAnnotationRomanContent content);
	[[nodiscard]] LineAnnotationRoman        canonicalizeLineAnnotationRoman(LineAnnotationRoman roman);
	[[nodiscard]] LineAnnotationTranslation  canonicalizeLineAnnotationTranslation(LineAnnotationTranslation translation);
	[[nodiscard]] LineAnnotation             canonicalizeLineAnnotation(LineAnnotation annotation);
	[[nodiscard]] LineContent                canonicalizeLineContent(LineContent content);
	[[nodiscard]] LineBackground             canonicalizeLineBackground(LineBackground background);
	[[nodiscard]] Line                       canonicalizeLine(Line line);

	// Orders usable start times stably, leaving unset and invalid ranges at the end.
	[[nodiscard]] Line orderLineBackgrounds(Line line);

} // namespace gondola::lyrics::model::enriched
