#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/enriched/word.gen.hpp>

namespace gondola::lyrics::model::enriched {

	// Creates a timed annotation without normalizing its identifiers.
	[[nodiscard]] WordAnnotationRuby        makeWordAnnotationRuby(std::optional<common::TimeRange> time = std::nullopt,
		std::optional<std::string>                                                       language    = std::nullopt,
		std::optional<std::string>                                                       scheme      = std::nullopt,
		std::vector<common::TextToken>                                                   tokens      = {});
	[[nodiscard]] WordAnnotationRoman       makeWordAnnotationRoman(std::optional<common::TimeRange> time = std::nullopt,
		std::optional<std::string>                                                         language   = std::nullopt,
		std::optional<std::string>                                                         scheme     = std::nullopt,
		std::vector<common::TextToken>                                                     tokens     = {});
	[[nodiscard]] WordAnnotationTranslation makeWordAnnotationTranslation(std::optional<std::string> language = std::nullopt, std::string text = {});
	[[nodiscard]] WordAnnotation            makeWordAnnotation(std::vector<WordAnnotationRuby> rubies = {},
		std::vector<WordAnnotationRoman>                                        romans            = {},
		std::vector<WordAnnotationTranslation>                                  translations      = {});

	// An explicit false is a decision, while an unset value leaves the decision open.
	[[nodiscard]] WordEmphasis makeWordEmphasis(std::optional<bool> value = std::nullopt, std::optional<bool> derived = std::nullopt);
	[[nodiscard]] Word         makeWordNormal(std::optional<common::TimeRange> time = std::nullopt,
		std::optional<std::string>                                 language     = std::nullopt,
		std::string                                                text         = {},
		std::optional<WordAnnotation>                              annotation   = std::nullopt,
		std::optional<WordEmphasis>                                emphasis     = std::nullopt);
	[[nodiscard]] Word         makeWordSpace(std::string text = {});

	// Checks annotation variants and that explicit timing stays within the supplied word range.
	[[nodiscard]] std::vector<common::Diagnostic> validateWordAnnotation(const WordAnnotation& annotation,
		std::string_view                                                                   path = {},
		const std::optional<common::TimeRange>&                                            time = std::nullopt);
	[[nodiscard]] std::vector<common::Diagnostic> validateWord(const Word& word, std::string_view path = {}, common::TimingLevel timing = common::TimingLevel::kUnspecified);
	[[nodiscard]] std::vector<common::Diagnostic> validateWords(const std::vector<Word>& words,
		const std::optional<common::TimeRange>&                                      time   = std::nullopt,
		std::string_view                                                             path   = {},
		common::TimingLevel                                                          timing = common::TimingLevel::kUnspecified);

	[[nodiscard]] WordAnnotationRuby        canonicalizeWordAnnotationRuby(WordAnnotationRuby ruby);
	[[nodiscard]] WordAnnotationRoman       canonicalizeWordAnnotationRoman(WordAnnotationRoman roman);
	[[nodiscard]] WordAnnotationTranslation canonicalizeWordAnnotationTranslation(WordAnnotationTranslation translation);
	[[nodiscard]] WordAnnotation            canonicalizeWordAnnotation(WordAnnotation annotation);
	[[nodiscard]] Word                      canonicalizeWord(Word word);

	// Joins the source text in order, retaining separator words and adding no new separators.
	[[nodiscard]] std::string getWordsText(const std::vector<Word>& words);
	[[nodiscard]] std::string getWordAnnotationItemText(const WordAnnotationRuby& item);
	[[nodiscard]] std::string getWordAnnotationItemText(const WordAnnotationRoman& item);

	// Returns distinct normal word languages in first appearance order.
	[[nodiscard]] std::vector<std::string> collectWordLanguages(const std::vector<Word>& words);

	// Each fallback uses a whole range, preserving an explicitly open end.
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationItemTime(const WordAnnotationRuby& item, const Word& word) noexcept;
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationItemTime(const WordAnnotationRoman& item, const Word& word) noexcept;
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationTokenTime(const common::TextToken& token, const WordAnnotationRuby& item, const Word& word) noexcept;
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationTokenTime(const common::TextToken& token, const WordAnnotationRoman& item, const Word& word) noexcept;

} // namespace gondola::lyrics::model::enriched
