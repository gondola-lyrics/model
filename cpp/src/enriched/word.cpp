#include <cstddef>
#include <unordered_set>
#include <utility>

#include <gondola/lyrics/model/common/text.hpp>
#include <gondola/lyrics/model/common/time.hpp>
#include <gondola/lyrics/model/enriched/word.hpp>

#include "utils/lyric.hpp"
#include "utils/text.hpp"

namespace gondola::lyrics::model::enriched {
	namespace {

		using common::Diagnostic;
		using common::DiagnosticCode;
		using common::TimeRange;
		using common::TimingLevel;

		bool uses_word_timing(TimingLevel timing) noexcept {
			return timing != TimingLevel::kNone && timing != TimingLevel::kLine;
		}

		template <typename T>
		void validate_annotation_items(const std::vector<T>& items,
			std::string_view                             path,
			std::string_view                             field,
			const std::optional<TimeRange>&              time,
			std::vector<Diagnostic>&                     diagnostics) {
			for (std::size_t index = 0; index < items.size(); ++index) {
				const auto& item     = items[index];
				const auto  itemPath = utils::indexed_path(path, field, index);
				utils::validate_language(item.language, itemPath, diagnostics);
				if (item.time) {
					utils::append_diagnostics(diagnostics, common::validateTimeRange(*item.time, utils::child_path(itemPath, "time")));
				}
				if (utils::is_time_uncovered(item.time, time)) {
					diagnostics.push_back({utils::child_path(itemPath, "time"), DiagnosticCode::kLineWordAnnotationTimeUncovered});
				}
				const auto& inherited = item.time ? item.time : time;
				for (std::size_t tokenIndex = 0; tokenIndex < item.tokens.size(); ++tokenIndex) {
					const auto& token     = item.tokens[tokenIndex];
					const auto  tokenPath = utils::indexed_path(itemPath, "tokens", tokenIndex);
					utils::append_diagnostics(diagnostics, common::validateTextToken(token, tokenPath));
					if (utils::is_time_uncovered(token.time, inherited)) {
						diagnostics.push_back({utils::child_path(tokenPath, "time"), DiagnosticCode::kLineWordAnnotationTimeUncovered});
					}
				}
			}
		}

		template <typename T>
		void report_empty_annotation_items(const std::vector<T>& items, std::string_view path, std::string_view field, std::vector<Diagnostic>& diagnostics) {
			for (std::size_t index = 0; index < items.size(); ++index) {
				const auto& item     = items[index];
				const auto  itemPath = utils::indexed_path(path, field, index);
				utils::report_default_entry(item, itemPath, diagnostics);
				for (std::size_t tokenIndex = 0; tokenIndex < item.tokens.size(); ++tokenIndex) {
					if (item.tokens[tokenIndex] == common::TextToken{}) {
						diagnostics.push_back({utils::indexed_path(itemPath, "tokens", tokenIndex), DiagnosticCode::kLyricListEntryEmpty});
					}
				}
			}
		}

		template <typename T>
		T canonicalize_timed_annotation(T item) {
			utils::normalize_language(item.language);
			utils::normalize_language(item.scheme);
			utils::canonicalize_entries(item.tokens, common::canonicalizeTextToken);
			return item;
		}

	} // namespace

	WordAnnotationRuby makeWordAnnotationRuby(std::optional<TimeRange> time,
		std::optional<std::string>                                 language,
		std::optional<std::string>                                 scheme,
		std::vector<common::TextToken>                             tokens) {
		return {time, std::move(language), std::move(scheme), std::move(tokens)};
	}

	WordAnnotationRoman makeWordAnnotationRoman(std::optional<TimeRange> time,
		std::optional<std::string>                                   language,
		std::optional<std::string>                                   scheme,
		std::vector<common::TextToken>                               tokens) {
		return {time, std::move(language), std::move(scheme), std::move(tokens)};
	}

	WordAnnotationTranslation makeWordAnnotationTranslation(std::optional<std::string> language, std::string text) {
		return {std::move(language), std::move(text)};
	}

	WordAnnotation makeWordAnnotation(std::vector<WordAnnotationRuby> rubies, std::vector<WordAnnotationRoman> romans, std::vector<WordAnnotationTranslation> translations) {
		return {std::move(rubies), std::move(romans), std::move(translations)};
	}

	WordEmphasis makeWordEmphasis(std::optional<bool> value, std::optional<bool> derived) {
		return {value, derived};
	}

	Word makeWordNormal(std::optional<TimeRange> time,
		std::optional<std::string>           language,
		std::string                          text,
		std::optional<WordAnnotation>        annotation,
		std::optional<WordEmphasis>          emphasis) {
		return {WordType::kNormal, time, std::move(language), std::move(text), std::move(annotation), emphasis};
	}

	Word makeWordSpace(std::string text) {
		return {WordType::kSpace, std::nullopt, std::nullopt, std::move(text), std::nullopt, std::nullopt};
	}

	std::vector<Diagnostic> validateWordAnnotation(const WordAnnotation& annotation, std::string_view path, const std::optional<TimeRange>& time) {
		std::vector<Diagnostic> diagnostics;
		utils::report_duplicates(annotation.rubies,
			utils::annotation_variant_key<WordAnnotationRuby>,
			path,
			"rubies",
			DiagnosticCode::kLineWordAnnotationRubiesDuplicate,
			diagnostics);
		utils::report_duplicates(annotation.romans,
			utils::annotation_variant_key<WordAnnotationRoman>,
			path,
			"romans",
			DiagnosticCode::kLineWordAnnotationRomansDuplicate,
			diagnostics);
		utils::report_duplicates(
			annotation.translations,
			[](const WordAnnotationTranslation& item) { return utils::language_key(item.language); },
			path,
			"translations",
			DiagnosticCode::kLineWordAnnotationTranslationsLanguageDuplicate,
			diagnostics);
		validate_annotation_items(annotation.rubies, path, "rubies", time, diagnostics);
		validate_annotation_items(annotation.romans, path, "romans", time, diagnostics);
		for (std::size_t index = 0; index < annotation.translations.size(); ++index) {
			utils::validate_language(annotation.translations[index].language, utils::indexed_path(path, "translations", index), diagnostics);
		}
		report_empty_annotation_items(annotation.rubies, path, "rubies", diagnostics);
		report_empty_annotation_items(annotation.romans, path, "romans", diagnostics);
		for (std::size_t index = 0; index < annotation.translations.size(); ++index) {
			utils::report_default_entry(annotation.translations[index], utils::indexed_path(path, "translations", index), diagnostics);
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateWord(const Word& word, std::string_view path, TimingLevel timing) {
		std::vector<Diagnostic> diagnostics;
		if (word.type != WordType::kNormal && word.type != WordType::kSpace) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kWordTypeUnspecified});
		}
		if (word.type == WordType::kNormal) {
			if (word.text.empty()) {
				diagnostics.push_back({std::string(path), DiagnosticCode::kWordTextEmpty});
			} else if (utils::has_separator(word.text)) {
				diagnostics.push_back({utils::child_path(path, "text"), DiagnosticCode::kWordTextSeparator});
			}
		}
		if (word.type == WordType::kSpace) {
			if (!utils::is_separator_text(word.text)) {
				diagnostics.push_back({utils::child_path(path, "text"), DiagnosticCode::kWordTextNotSeparator});
			}
			if (word.time) {
				diagnostics.push_back({utils::child_path(path, "time"), DiagnosticCode::kLineWordTimeUnexpected});
			}
			if (word.language) {
				diagnostics.push_back({utils::child_path(path, "language"), DiagnosticCode::kLineWordLanguageUnexpected});
			}
			if (word.annotation) {
				diagnostics.push_back({utils::child_path(path, "annotation"), DiagnosticCode::kLineWordAnnotationUnexpected});
			}
			if (word.emphasis) {
				diagnostics.push_back({utils::child_path(path, "emphasis"), DiagnosticCode::kLineWordEmphasisUnexpected});
			}
			return diagnostics;
		}
		utils::validate_language(word.language, path, diagnostics);
		if (uses_word_timing(timing) && word.type == WordType::kNormal && !word.time) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kLineWordTimeMissing});
		}
		if (word.time) {
			const auto timePath = utils::child_path(path, "time");
			if (timing == TimingLevel::kNone) {
				diagnostics.push_back({timePath, DiagnosticCode::kLyricTimingNonePresent});
			}
			utils::append_diagnostics(diagnostics, common::validateTimeRange(*word.time, timePath));
		}
		if (word.annotation) {
			utils::append_diagnostics(diagnostics,
				validateWordAnnotation(*word.annotation, utils::child_path(path, "annotation"), uses_word_timing(timing) ? word.time : std::nullopt));
		}
		if (word.emphasis && word.emphasis->derived && !word.emphasis->value) {
			diagnostics.push_back({utils::child_path(path, "emphasis.value"), DiagnosticCode::kLineWordEmphasisValueMissing});
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateWords(const std::vector<Word>& words, const std::optional<TimeRange>& time, std::string_view path, TimingLevel timing) {
		std::vector<Diagnostic> diagnostics;
		for (std::size_t index = 0; index < words.size(); ++index) {
			const auto& word     = words[index];
			const auto  wordPath = utils::indexed_path({}, path, index);
			utils::append_diagnostics(diagnostics, validateWord(word, wordPath, timing));
			if (uses_word_timing(timing) && word.type != WordType::kSpace && utils::is_time_uncovered(word.time, time)) {
				diagnostics.push_back({utils::child_path(wordPath, "time"), DiagnosticCode::kLineWordTimeUncovered});
			}
		}
		return diagnostics;
	}

	WordAnnotationRuby canonicalizeWordAnnotationRuby(WordAnnotationRuby ruby) {
		return canonicalize_timed_annotation(std::move(ruby));
	}

	WordAnnotationRoman canonicalizeWordAnnotationRoman(WordAnnotationRoman roman) {
		return canonicalize_timed_annotation(std::move(roman));
	}

	WordAnnotationTranslation canonicalizeWordAnnotationTranslation(WordAnnotationTranslation translation) {
		utils::normalize_language(translation.language);
		return translation;
	}

	WordAnnotation canonicalizeWordAnnotation(WordAnnotation annotation) {
		utils::canonicalize_entries(annotation.rubies, canonicalizeWordAnnotationRuby);
		utils::canonicalize_entries(annotation.romans, canonicalizeWordAnnotationRoman);
		utils::canonicalize_entries(annotation.translations, canonicalizeWordAnnotationTranslation);
		return annotation;
	}

	Word canonicalizeWord(Word word) {
		utils::normalize_language(word.language);
		utils::canonicalize_field(word.annotation, canonicalizeWordAnnotation);
		utils::unset_if_default(word.emphasis);
		return word;
	}

	std::string getWordsText(const std::vector<Word>& words) {
		return utils::join_text(words);
	}

	std::string getWordAnnotationItemText(const WordAnnotationRuby& item) {
		return utils::join_text(item.tokens);
	}

	std::string getWordAnnotationItemText(const WordAnnotationRoman& item) {
		return utils::join_text(item.tokens);
	}

	std::vector<std::string> collectWordLanguages(const std::vector<Word>& words) {
		std::vector<std::string>        languages;
		std::unordered_set<std::string> seen;
		for (const auto& word : words) {
			if (word.type == WordType::kNormal && word.language) {
				utils::append_language(*word.language, seen, languages);
			}
		}
		return languages;
	}

	std::optional<TimeRange> resolveWordAnnotationItemTime(const WordAnnotationRuby& item, const Word& word) noexcept {
		return item.time ? item.time : word.time;
	}

	std::optional<TimeRange> resolveWordAnnotationItemTime(const WordAnnotationRoman& item, const Word& word) noexcept {
		return item.time ? item.time : word.time;
	}

	std::optional<TimeRange> resolveWordAnnotationTokenTime(const common::TextToken& token, const WordAnnotationRuby& item, const Word& word) noexcept {
		return token.time ? token.time : resolveWordAnnotationItemTime(item, word);
	}

	std::optional<TimeRange> resolveWordAnnotationTokenTime(const common::TextToken& token, const WordAnnotationRoman& item, const Word& word) noexcept {
		return token.time ? token.time : resolveWordAnnotationItemTime(item, word);
	}

} // namespace gondola::lyrics::model::enriched
