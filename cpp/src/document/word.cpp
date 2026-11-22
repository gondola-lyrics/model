#include <cstddef>
#include <unordered_set>
#include <utility>

#include <gondola/lyrics/model/common/text.hpp>
#include <gondola/lyrics/model/common/time.hpp>
#include <gondola/lyrics/model/document/word.hpp>

#include "utils/lyric.hpp"
#include "utils/text.hpp"

namespace gondola::lyrics::model::document {
	namespace {
		using common::Diagnostic;
		using common::DiagnosticCode;
		using common::TimeRange;
		using common::TimingLevel;

		bool usesWordTiming(TimingLevel timing) noexcept {
			return timing != TimingLevel::kNone && timing != TimingLevel::kLine;
		}

		template <typename T>
		void validateAnnotationItems(const std::vector<T>& items,
			std::string_view                           path,
			std::string_view                           field,
			const std::optional<TimeRange>&            time,
			std::vector<Diagnostic>&                   diagnostics) {
			for (std::size_t index = 0; index < items.size(); ++index) {
				const auto& item     = items[index];
				const auto  itemPath = utils::indexedPath(path, field, index);
				utils::validateLanguage(item.language, itemPath, diagnostics);
				if (item.time) {
					utils::appendDiagnostics(diagnostics, common::validateTimeRange(*item.time, utils::childPath(itemPath, "time")));
				}
				if (utils::isTimeUncovered(item.time, time)) {
					diagnostics.push_back({utils::childPath(itemPath, "time"), DiagnosticCode::kLineWordAnnotationTimeUncovered});
				}
				const auto& inherited = item.time ? item.time : time;
				for (std::size_t tokenIndex = 0; tokenIndex < item.tokens.size(); ++tokenIndex) {
					const auto& token     = item.tokens[tokenIndex];
					const auto  tokenPath = utils::indexedPath(itemPath, "tokens", tokenIndex);
					utils::appendDiagnostics(diagnostics, common::validateTextToken(token, tokenPath));
					if (utils::isTimeUncovered(token.time, inherited)) {
						diagnostics.push_back({utils::childPath(tokenPath, "time"), DiagnosticCode::kLineWordAnnotationTimeUncovered});
					}
				}
			}
		}

		template <typename T>
		void reportEmptyAnnotationItems(const std::vector<T>& items, std::string_view path, std::string_view field, std::vector<Diagnostic>& diagnostics) {
			for (std::size_t index = 0; index < items.size(); ++index) {
				const auto& item     = items[index];
				const auto  itemPath = utils::indexedPath(path, field, index);
				utils::reportDefaultEntry(item, itemPath, diagnostics);
				for (std::size_t tokenIndex = 0; tokenIndex < item.tokens.size(); ++tokenIndex) {
					if (item.tokens[tokenIndex] == common::TextToken{}) {
						diagnostics.push_back({utils::indexedPath(itemPath, "tokens", tokenIndex), DiagnosticCode::kLyricListEntryEmpty});
					}
				}
			}
		}

		template <typename T>
		T canonicalizeTimedAnnotation(T item) {
			utils::normalizeLanguage(item.language);
			utils::normalizeLanguage(item.scheme);
			utils::canonicalizeEntries(item.tokens, common::canonicalizeTextToken);
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

	Word makeWordNormal(std::optional<TimeRange> time,
		std::optional<std::string>           language,
		std::string                          text,
		std::optional<WordAnnotation>        annotation,
		std::optional<bool>                  emphasis) {
		return {WordType::kNormal, time, std::move(language), std::move(text), std::move(annotation), emphasis};
	}

	Word makeWordSpace(std::string text) {
		return {WordType::kSpace, std::nullopt, std::nullopt, std::move(text), std::nullopt, std::nullopt};
	}

	std::vector<Diagnostic> validateWordAnnotation(const WordAnnotation& annotation, std::string_view path, const std::optional<TimeRange>& time) {
		std::vector<Diagnostic> diagnostics;
		utils::reportDuplicates(annotation.rubies,
			utils::annotationVariantKey<WordAnnotationRuby>,
			path,
			"rubies",
			DiagnosticCode::kLineWordAnnotationRubiesDuplicate,
			diagnostics);
		utils::reportDuplicates(annotation.romans,
			utils::annotationVariantKey<WordAnnotationRoman>,
			path,
			"romans",
			DiagnosticCode::kLineWordAnnotationRomansDuplicate,
			diagnostics);
		utils::reportDuplicates(
			annotation.translations,
			[](const WordAnnotationTranslation& item) { return utils::languageKey(item.language); },
			path,
			"translations",
			DiagnosticCode::kLineWordAnnotationTranslationsLanguageDuplicate,
			diagnostics);
		validateAnnotationItems(annotation.rubies, path, "rubies", time, diagnostics);
		validateAnnotationItems(annotation.romans, path, "romans", time, diagnostics);
		for (std::size_t index = 0; index < annotation.translations.size(); ++index) {
			utils::validateLanguage(annotation.translations[index].language, utils::indexedPath(path, "translations", index), diagnostics);
		}
		reportEmptyAnnotationItems(annotation.rubies, path, "rubies", diagnostics);
		reportEmptyAnnotationItems(annotation.romans, path, "romans", diagnostics);
		for (std::size_t index = 0; index < annotation.translations.size(); ++index) {
			utils::reportDefaultEntry(annotation.translations[index], utils::indexedPath(path, "translations", index), diagnostics);
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
			} else if (utils::hasSeparator(word.text)) {
				diagnostics.push_back({utils::childPath(path, "text"), DiagnosticCode::kWordTextSeparator});
			}
		}
		if (word.type == WordType::kSpace) {
			if (!utils::isSeparatorText(word.text)) {
				diagnostics.push_back({utils::childPath(path, "text"), DiagnosticCode::kWordTextNotSeparator});
			}
			if (word.time) {
				diagnostics.push_back({utils::childPath(path, "time"), DiagnosticCode::kLineWordTimeUnexpected});
			}
			if (word.language) {
				diagnostics.push_back({utils::childPath(path, "language"), DiagnosticCode::kLineWordLanguageUnexpected});
			}
			if (word.annotation) {
				diagnostics.push_back({utils::childPath(path, "annotation"), DiagnosticCode::kLineWordAnnotationUnexpected});
			}
			if (word.emphasis) {
				diagnostics.push_back({utils::childPath(path, "emphasis"), DiagnosticCode::kLineWordEmphasisUnexpected});
			}
			return diagnostics;
		}
		utils::validateLanguage(word.language, path, diagnostics);
		if (usesWordTiming(timing) && word.type == WordType::kNormal && !word.time) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kLineWordTimeMissing});
		}
		if (word.time) {
			const auto timePath = utils::childPath(path, "time");
			if (timing == TimingLevel::kNone) {
				diagnostics.push_back({timePath, DiagnosticCode::kLyricTimingNonePresent});
			}
			utils::appendDiagnostics(diagnostics, common::validateTimeRange(*word.time, timePath));
		}
		if (word.annotation) {
			utils::appendDiagnostics(diagnostics,
				validateWordAnnotation(*word.annotation, utils::childPath(path, "annotation"), usesWordTiming(timing) ? word.time : std::nullopt));
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateWords(const std::vector<Word>& words, const std::optional<TimeRange>& time, std::string_view path, TimingLevel timing) {
		std::vector<Diagnostic> diagnostics;
		for (std::size_t index = 0; index < words.size(); ++index) {
			const auto& word     = words[index];
			const auto  wordPath = utils::indexedPath({}, path, index);
			utils::appendDiagnostics(diagnostics, validateWord(word, wordPath, timing));
			if (usesWordTiming(timing) && word.type != WordType::kSpace && utils::isTimeUncovered(word.time, time)) {
				diagnostics.push_back({utils::childPath(wordPath, "time"), DiagnosticCode::kLineWordTimeUncovered});
			}
		}
		return diagnostics;
	}

	WordAnnotationRuby canonicalizeWordAnnotationRuby(WordAnnotationRuby ruby) {
		return canonicalizeTimedAnnotation(std::move(ruby));
	}

	WordAnnotationRoman canonicalizeWordAnnotationRoman(WordAnnotationRoman roman) {
		return canonicalizeTimedAnnotation(std::move(roman));
	}

	WordAnnotationTranslation canonicalizeWordAnnotationTranslation(WordAnnotationTranslation translation) {
		utils::normalizeLanguage(translation.language);
		return translation;
	}

	WordAnnotation canonicalizeWordAnnotation(WordAnnotation annotation) {
		utils::canonicalizeEntries(annotation.rubies, canonicalizeWordAnnotationRuby);
		utils::canonicalizeEntries(annotation.romans, canonicalizeWordAnnotationRoman);
		utils::canonicalizeEntries(annotation.translations, canonicalizeWordAnnotationTranslation);
		return annotation;
	}

	Word canonicalizeWord(Word word) {
		utils::normalizeLanguage(word.language);
		utils::canonicalizeField(word.annotation, canonicalizeWordAnnotation);
		return word;
	}

	std::string getWordsText(const std::vector<Word>& words) {
		return utils::joinText(words);
	}

	std::string getWordAnnotationItemText(const WordAnnotationRuby& item) {
		return utils::joinText(item.tokens);
	}

	std::string getWordAnnotationItemText(const WordAnnotationRoman& item) {
		return utils::joinText(item.tokens);
	}

	std::vector<std::string> collectWordLanguages(const std::vector<Word>& words) {
		std::vector<std::string>        languages;
		std::unordered_set<std::string> seen;
		for (const auto& word : words) {
			if (word.type == WordType::kNormal && word.language) {
				utils::appendLanguage(*word.language, seen, languages);
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
} // namespace gondola::lyrics::model::document
