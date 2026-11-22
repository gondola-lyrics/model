#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/document/word.gen.hpp>

namespace gondola::lyrics::model::document {

	/**
 * Preserves the supplied ruby identifiers and source fragment order.
 */
	[[nodiscard]] WordAnnotationRuby makeWordAnnotationRuby(std::optional<common::TimeRange> time     = std::nullopt,
		std::optional<std::string>                                                       language = std::nullopt,
		std::optional<std::string>                                                       scheme   = std::nullopt,
		std::vector<common::TextToken>                                                   tokens   = {});

	/**
 * Preserves the supplied romanization identifiers and source fragment order.
 */
	[[nodiscard]] WordAnnotationRoman makeWordAnnotationRoman(std::optional<common::TimeRange> time     = std::nullopt,
		std::optional<std::string>                                                         language = std::nullopt,
		std::optional<std::string>                                                         scheme   = std::nullopt,
		std::vector<common::TextToken>                                                     tokens   = {});

	/**
 * Attaches translation text to the whole word without normalizing its language.
 */
	[[nodiscard]] WordAnnotationTranslation makeWordAnnotationTranslation(std::optional<std::string> language = std::nullopt, std::string text = {});

	/**
 * Preserves annotation lists without merging variants or removing empty entries.
 */
	[[nodiscard]] WordAnnotation makeWordAnnotation(std::vector<WordAnnotationRuby> rubies       = {},
		std::vector<WordAnnotationRoman>                                        romans       = {},
		std::vector<WordAnnotationTranslation>                                  translations = {});

	/**
 * Fixes the normal word discriminator and preserves an explicit false emphasis decision.
 */
	[[nodiscard]] Word makeWordNormal(std::optional<common::TimeRange> time       = std::nullopt,
		std::optional<std::string>                                 language   = std::nullopt,
		std::string                                                text       = {},
		std::optional<WordAnnotation>                              annotation = std::nullopt,
		std::optional<bool>                                        emphasis   = std::nullopt);

	/**
 * Fixes the separator discriminator and leaves fields forbidden on separator words unset.
 */
	[[nodiscard]] Word makeWordSpace(std::string text = {});

	/**
 * Checks variant uniqueness, language tags, and containment within the supplied word range.
 *
 * Diagnostic paths are relative to the annotation unless a prefix is supplied.
 */
	[[nodiscard]] std::vector<common::Diagnostic> validateWordAnnotation(const WordAnnotation& annotation,
		std::string_view                                                                   path = {},
		const std::optional<common::TimeRange>&                                            time = std::nullopt);

	/**
 * Checks word kind, text, permitted fields, annotations, and timing.
 *
 * NONE forbids original timing; NONE and LINE suppress required word timing and parent-word annotation containment.
 * Unresolved timing retains standalone word timing constraints.
 */
	[[nodiscard]] std::vector<common::Diagnostic> validateWord(const Word& word, std::string_view path = {}, common::TimingLevel timing = common::TimingLevel::kUnspecified);

	/**
 * Checks each word and compares explicit timing with the supplied enclosing range.
 *
 * Diagnostic paths append the word index to the supplied array path.
 */
	[[nodiscard]] std::vector<common::Diagnostic> validateWords(const std::vector<Word>& words,
		const std::optional<common::TimeRange>&                                      time   = std::nullopt,
		std::string_view                                                             path   = {},
		common::TimingLevel                                                          timing = common::TimingLevel::kUnspecified);

	/**
 * Normalizes ruby identifiers and removes default tokens without inferring timing.
 */
	[[nodiscard]] WordAnnotationRuby canonicalizeWordAnnotationRuby(WordAnnotationRuby ruby);

	/**
 * Normalizes romanization identifiers and removes default tokens without inferring timing.
 */
	[[nodiscard]] WordAnnotationRoman canonicalizeWordAnnotationRoman(WordAnnotationRoman roman);

	/**
 * Normalizes the language identifier while preserving translation text.
 */
	[[nodiscard]] WordAnnotationTranslation canonicalizeWordAnnotationTranslation(WordAnnotationTranslation translation);

	/**
 * Normalizes annotations and removes default entries while preserving variant order.
 */
	[[nodiscard]] WordAnnotation canonicalizeWordAnnotation(WordAnnotation annotation);

	/**
 * Normalizes language and annotations while preserving source text, timing, and explicit emphasis values.
 */
	[[nodiscard]] Word canonicalizeWord(Word word);

	/**
 * Preserves source separators and adds no separators between word texts.
 */
	[[nodiscard]] std::string getWordsText(const std::vector<Word>& words);

	/**
 * Joins ruby fragments without adding separators or changing source text.
 */
	[[nodiscard]] std::string getWordAnnotationItemText(const WordAnnotationRuby& item);

	/**
 * Joins romanization fragments without adding separators or changing source text.
 */
	[[nodiscard]] std::string getWordAnnotationItemText(const WordAnnotationRoman& item);

	/**
 * Returns distinct lowercase language tags from normal words in first appearance order.
 */
	[[nodiscard]] std::vector<std::string> collectWordLanguages(const std::vector<Word>& words);

	/**
 * Uses the whole ruby range, falling back to the word only when the range is unset.
 */
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationItemTime(const WordAnnotationRuby& item, const Word& word) noexcept;

	/**
 * Uses the whole romanization range, falling back to the word only when the range is unset.
 */
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationItemTime(const WordAnnotationRoman& item, const Word& word) noexcept;

	/**
 * Uses the whole token range, then the ruby range, then the word range.
 */
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationTokenTime(const common::TextToken& token, const WordAnnotationRuby& item, const Word& word) noexcept;

	/**
 * Uses the whole token range, then the romanization range, then the word range.
 */
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationTokenTime(const common::TextToken& token, const WordAnnotationRoman& item, const Word& word) noexcept;

} // namespace gondola::lyrics::model::document
