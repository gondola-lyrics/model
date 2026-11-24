#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/enriched/word.gen.hpp>

namespace gondola::lyrics::model::enriched {
	/**
	 * Preserves ruby identifiers, timing, and source fragment order without normalization.
	 */
	[[nodiscard]] WordAnnotationRuby makeWordAnnotationRuby(std::optional<common::TimeRange> time     = std::nullopt,
		std::optional<std::string>                                                       language = std::nullopt,
		std::optional<std::string>                                                       scheme   = std::nullopt,
		std::vector<common::TextToken>                                                   tokens   = {});

	/**
	 * Preserves romanization identifiers, timing, and source fragment order without normalization.
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
	 * Preserves emphasis and provenance decisions, including explicit false values.
	 *
	 * An unset value leaves the decision open; validateWord() requires value whenever derived is present, including false.
	 */
	[[nodiscard]] WordEmphasis makeWordEmphasis(std::optional<bool> value = std::nullopt, std::optional<bool> derived = std::nullopt);

	/**
	 * Fixes the normal word discriminator while preserving supplied fields and explicit emphasis decisions.
	 */
	[[nodiscard]] Word makeWordNormal(std::optional<common::TimeRange> time       = std::nullopt,
		std::optional<std::string>                                 language   = std::nullopt,
		std::string                                                text       = {},
		std::optional<WordAnnotation>                              annotation = std::nullopt,
		std::optional<WordEmphasis>                                emphasis   = std::nullopt);

	/**
	 * Fixes the separator discriminator and leaves fields forbidden on separator words unset.
	 */
	[[nodiscard]] Word makeWordSpace(std::string text = {});

	/**
	 * Checks variant uniqueness, language tags, token attributes, and containment within the supplied word range.
	 *
	 * Tokens use the annotation's declared range for containment, or the supplied word range when the annotation range is unset.
	 * Diagnostic paths are relative to the annotation unless a prefix is supplied.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateWordAnnotation(const WordAnnotation& annotation,
		std::string_view                                                                   path = {},
		const std::optional<common::TimeRange>&                                            time = std::nullopt);

	/**
	 * Checks word kind, text, permitted fields, annotations, emphasis provenance, and timing.
	 *
	 * NONE forbids original timing; NONE and LINE suppress required word timing and parent-word annotation containment.
	 * Unresolved timing retains standalone word timing constraints.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateWord(const Word& word, std::string_view path = {}, common::TimingLevel timing = common::TimingLevel::kUnspecified);

	/**
	 * Checks each word and, outside NONE and LINE timing, compares explicit word timing with the supplied enclosing range.
	 *
	 * Diagnostic paths append the zero-based word index to the supplied array path.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateWords(const std::vector<Word>& words,
		const std::optional<common::TimeRange>&                                      time   = std::nullopt,
		std::string_view                                                             path   = {},
		common::TimingLevel                                                          timing = common::TimingLevel::kUnspecified);

	/**
	 * Lowercases ASCII ruby identifiers and removes default tokens while preserving text, timing, and fragment order.
	 */
	[[nodiscard]] WordAnnotationRuby canonicalizeWordAnnotationRuby(WordAnnotationRuby ruby);

	/**
	 * Lowercases ASCII romanization identifiers and removes default tokens while preserving text, timing, and fragment order.
	 */
	[[nodiscard]] WordAnnotationRoman canonicalizeWordAnnotationRoman(WordAnnotationRoman roman);

	/**
	 * Lowercases ASCII letters in the language identifier and unsets an empty one, preserving translation text.
	 */
	[[nodiscard]] WordAnnotationTranslation canonicalizeWordAnnotationTranslation(WordAnnotationTranslation translation);

	/**
	 * Normalizes annotations and removes default entries while preserving variant order and keeping duplicate variants separate.
	 */
	[[nodiscard]] WordAnnotation canonicalizeWordAnnotation(WordAnnotation annotation);

	/**
	 * Normalizes language and annotations and removes default emphasis while preserving source text, timing, and explicit decisions.
	 */
	[[nodiscard]] Word canonicalizeWord(Word word);

	/**
	 * Joins source text in order, retaining separator words and adding no new separators.
	 */
	[[nodiscard]] std::string getWordsText(const std::vector<Word>& words);

	/**
	 * Joins ruby fragments in source order without adding separators or changing their text.
	 */
	[[nodiscard]] std::string getWordAnnotationItemText(const WordAnnotationRuby& item);

	/**
	 * Joins romanization fragments in source order without adding separators or changing their text.
	 */
	[[nodiscard]] std::string getWordAnnotationItemText(const WordAnnotationRoman& item);

	/**
	 * Returns distinct non-empty, ASCII-lowercased language tags from normal words in first appearance order.
	 */
	[[nodiscard]] std::vector<std::string> collectWordLanguages(const std::vector<Word>& words);

	/**
	 * Uses the whole ruby range, falling back to the word only when the range is unset.
	 *
	 * Preserves an unknown end and returns nullopt when both ranges are unset; the selected range is not validated.
	 */
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationItemTime(const WordAnnotationRuby& item, const Word& word) noexcept;

	/**
	 * Uses the whole romanization range, falling back to the word only when the range is unset.
	 *
	 * Preserves an unknown end and returns nullopt when both ranges are unset; the selected range is not validated.
	 */
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationItemTime(const WordAnnotationRoman& item, const Word& word) noexcept;

	/**
	 * Uses the first present whole range in token, ruby, then word order.
	 *
	 * Preserves an unknown end and returns nullopt when all ranges are unset; the selected range is not validated.
	 */
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationTokenTime(const common::TextToken& token, const WordAnnotationRuby& item, const Word& word) noexcept;

	/**
	 * Uses the first present whole range in token, romanization, then word order.
	 *
	 * Preserves an unknown end and returns nullopt when all ranges are unset; the selected range is not validated.
	 */
	[[nodiscard]] std::optional<common::TimeRange> resolveWordAnnotationTokenTime(const common::TextToken& token, const WordAnnotationRoman& item, const Word& word) noexcept;
} // namespace gondola::lyrics::model::enriched
