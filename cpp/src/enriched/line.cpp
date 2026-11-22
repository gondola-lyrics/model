#include <algorithm>
#include <cstddef>
#include <unordered_map>
#include <unordered_set>
#include <utility>

#include <gondola/lyrics/model/common/agent.hpp>
#include <gondola/lyrics/model/common/part.hpp>
#include <gondola/lyrics/model/common/text.hpp>
#include <gondola/lyrics/model/common/time.hpp>
#include <gondola/lyrics/model/enriched/line.hpp>
#include <gondola/lyrics/model/enriched/word.hpp>

#include "utils/lyric.hpp"

namespace gondola::lyrics::model::enriched {
	namespace {
		using common::Diagnostic;
		using common::DiagnosticCode;
		using common::LineRomanView;
		using common::TimeRange;
		using common::TimingLevel;

		bool hasContentWords(const std::optional<LineContent>& content) noexcept {
			return content && !content->words.empty();
		}

		template <typename T>
		std::vector<std::string> resolveLanguages(const T& line) {
			if (!line.languages.empty()) {
				return utils::normalizedLanguages(line.languages);
			}
			return line.content ? collectWordLanguages(line.content->words) : std::vector<std::string>{};
		}

		void validateRomanPlacement(const LineAnnotation& annotation,
			const std::optional<LineContent>&         content,
			std::string_view                          path,
			std::vector<Diagnostic>&                  diagnostics) {
			if (!content || annotation.romans.empty()) {
				return;
			}
			std::unordered_set<std::string> wordVariants;
			for (const auto& word : content->words) {
				if (word.type != WordType::kSpace && word.annotation) {
					for (const auto& roman : word.annotation->romans) {
						wordVariants.insert(utils::annotationVariantKey(roman));
					}
				}
			}
			for (std::size_t index = 0; index < annotation.romans.size(); ++index) {
				if (wordVariants.count(utils::annotationVariantKey(annotation.romans[index])) != 0) {
					diagnostics.push_back({utils::indexedPath(path, "romans", index), DiagnosticCode::kLineAnnotationRomansConflict});
				}
			}
		}

		void validateLineTime(const std::optional<TimeRange>& time,
			std::string_view                              path,
			TimingLevel                                   timing,
			bool                                          instrumental,
			bool                                          sung,
			std::vector<Diagnostic>&                      diagnostics) {
			const bool needsRange = instrumental && timing != TimingLevel::kNone;
			if (time) {
				const auto timePath = utils::childPath(path, "time");
				if (timing == TimingLevel::kNone) {
					diagnostics.push_back({timePath, DiagnosticCode::kLyricTimingNonePresent});
				}
				utils::appendDiagnostics(diagnostics, common::validateTimeRange(*time, timePath));
				if (needsRange && !time->end) {
					diagnostics.push_back({utils::childPath(timePath, "end"), DiagnosticCode::kLineTimeEndMissing});
				} else if (needsRange && utils::isTimeOrdered(time) && time->end == time->start) {
					diagnostics.push_back({timePath, DiagnosticCode::kLineTimeEmpty});
				}
			} else if (needsRange) {
				diagnostics.push_back({utils::childPath(path, "time"), DiagnosticCode::kLineTimeMissing});
			} else if (sung && utils::isTimedContent(timing)) {
				diagnostics.push_back({utils::childPath(path, "time"), DiagnosticCode::kLyricTimingLineTimeMissing});
			}
		}

		template <typename T>
		void validateSungFields(const T& line, std::string_view path, TimingLevel timing, bool required, std::vector<Diagnostic>& diagnostics) {
			for (std::size_t index = 0; index < line.agent_ids.size(); ++index) {
				if (line.agent_ids[index].empty()) {
					diagnostics.push_back({utils::indexedPath(path, "agentIds", index), DiagnosticCode::kLyricListEntryEmpty});
				}
			}
			for (std::size_t index = 0; index < line.languages.size(); ++index) {
				const auto& language = line.languages[index];
				if (language.empty()) {
					diagnostics.push_back({utils::indexedPath(path, "languages", index), DiagnosticCode::kLyricListEntryEmpty});
				} else if (!common::isWellFormedLanguageTag(language)) {
					diagnostics.push_back({utils::indexedPath(path, "languages", index), DiagnosticCode::kLanguageTagMalformed});
				}
			}
			utils::reportDuplicates(line.languages, utils::lowercaseAscii, path, "languages", DiagnosticCode::kLineLanguagesDuplicate, diagnostics);
			utils::appendDiagnostics(diagnostics, validateLineContent(line.content, line.time, utils::childPath(path, "content"), timing, required));
			if (line.annotation) {
				const auto annotationPath = utils::childPath(path, "annotation");
				utils::appendDiagnostics(diagnostics, validateLineAnnotation(*line.annotation, annotationPath));
				validateRomanPlacement(*line.annotation, line.content, annotationPath, diagnostics);
			}
		}

		template <typename T>
		void canonicalizeSungFields(T& line) {
			utils::eraseDefaults(line.agent_ids);
			line.languages = utils::normalizedLanguages(line.languages);
			utils::canonicalizeField(line.content, canonicalizeLineContent);
			utils::canonicalizeField(line.annotation, canonicalizeLineAnnotation);
		}
	} // namespace

	LineAnnotationRomanContent makeLineAnnotationRomanContentTokens(std::vector<common::TextToken> tokens) {
		return {std::move(tokens), std::nullopt};
	}

	LineAnnotationRomanContent makeLineAnnotationRomanContentText(std::string text) {
		return {{}, std::move(text)};
	}

	LineAnnotationRoman makeLineAnnotationRoman(std::optional<std::string> language,
		std::optional<std::string>                                     scheme,
		std::optional<TimeRange>                                       time,
		std::optional<LineAnnotationRomanContent>                      content) {
		return {std::move(language), std::move(scheme), time, std::move(content)};
	}

	LineAnnotationTranslation makeLineAnnotationTranslation(std::optional<std::string> language, std::string text) {
		return {std::move(language), std::move(text)};
	}

	LineAnnotation makeLineAnnotation(std::vector<LineAnnotationRoman> romans, std::vector<LineAnnotationTranslation> translations) {
		return {std::move(romans), std::move(translations)};
	}

	LineContent makeLineContentWords(std::vector<Word> words) {
		return {std::move(words), std::nullopt};
	}

	LineContent makeLineContentText(std::string text) {
		return {{}, std::move(text)};
	}

	Line makeLineNormal(std::string       id,
		std::optional<TimeRange>      time,
		std::optional<common::Part>   part,
		std::vector<std::string>      agentIds,
		std::vector<std::string>      languages,
		std::vector<LineBackground>   backgrounds,
		std::optional<LineContent>    content,
		std::optional<LineAnnotation> annotation) {
		return {std::move(id),
			LineType::kNormal,
			time,
			std::move(part),
			std::move(agentIds),
			std::move(languages),
			std::move(backgrounds),
			std::move(content),
			std::move(annotation)};
	}

	Line makeLineInstrumental(std::string id, std::optional<TimeRange> time, std::optional<common::Part> part) {
		return {std::move(id), LineType::kInstrumental, time, std::move(part), {}, {}, {}, std::nullopt, std::nullopt};
	}

	LineBackground makeLineBackground(std::string id,
		std::optional<TimeRange>              time,
		std::vector<std::string>              agentIds,
		std::vector<std::string>              languages,
		std::optional<LineContent>            content,
		std::optional<LineAnnotation>         annotation) {
		return {std::move(id), time, std::move(agentIds), std::move(languages), std::move(content), std::move(annotation)};
	}

	std::string getLineContentText(const LineContent& content) {
		return content.text ? *content.text : getWordsText(content.words);
	}

	std::string getLineContentText(const std::optional<LineContent>& content) {
		return content ? getLineContentText(*content) : std::string{};
	}

	bool hasLineWords(const Line& line) noexcept {
		return hasContentWords(line.content);
	}

	bool hasLineWords(const LineBackground& line) noexcept {
		return hasContentWords(line.content);
	}

	std::vector<std::string> resolveLineLanguages(const Line& line) {
		return resolveLanguages(line);
	}

	std::vector<std::string> resolveLineLanguages(const LineBackground& line) {
		return resolveLanguages(line);
	}

	std::vector<const common::Agent*> resolveLineAgents(const Line& line, const std::vector<common::Agent>& agents) {
		return common::resolveLineAgents(line.agent_ids, agents);
	}

	std::vector<const common::Agent*> resolveLineAgents(const LineBackground& line, const std::vector<common::Agent>& agents) {
		return common::resolveLineAgents(line.agent_ids, agents);
	}

	std::string getLineAnnotationRomanText(const LineAnnotationRoman& roman) {
		if (!roman.content) {
			return {};
		}
		return roman.content->text ? *roman.content->text : utils::joinText(roman.content->tokens);
	}

	std::optional<TimeRange> resolveLineAnnotationRomanTime(const LineAnnotationRoman& roman, const Line& line) noexcept {
		return roman.time ? roman.time : line.time;
	}

	std::optional<TimeRange> resolveLineAnnotationRomanTime(const LineAnnotationRoman& roman, const LineBackground& line) noexcept {
		return roman.time ? roman.time : line.time;
	}

	std::optional<TimeRange> resolveLineAnnotationRomanTokenTime(const common::TextToken& token, const LineAnnotationRoman& roman, const Line& line) noexcept {
		return token.time ? token.time : resolveLineAnnotationRomanTime(roman, line);
	}

	std::optional<TimeRange> resolveLineAnnotationRomanTokenTime(const common::TextToken& token, const LineAnnotationRoman& roman, const LineBackground& line) noexcept {
		return token.time ? token.time : resolveLineAnnotationRomanTime(roman, line);
	}

	std::vector<LineRomanView> deriveLineRomanViews(const LineContent& content) {
		struct Variant {
			LineRomanView              view;
			std::optional<std::size_t> lastWord;
			std::size_t                lastSpaceCount = 0;
		};
		std::vector<Variant>                         variants;
		std::unordered_map<std::string, std::size_t> positions;
		std::size_t                                  spaceCount = 0;
		for (std::size_t index = 0; index < content.words.size(); ++index) {
			const auto& word    = content.words[index];
			const bool  isSpace = word.type == WordType::kSpace;
			if (isSpace) {
				++spaceCount;
			}
			if (!word.annotation) {
				continue;
			}
			for (const auto& roman : word.annotation->romans) {
				const auto [position, inserted] = positions.try_emplace(utils::annotationVariantKey(roman), variants.size());
				if (inserted) {
					LineRomanView view{roman.language, roman.scheme, {}};
					utils::normalizeLanguage(view.language);
					utils::normalizeLanguage(view.scheme);
					variants.push_back({std::move(view), std::nullopt, 0});
				}
				auto& variant = variants[position->second];
				if (isSpace || variant.lastWord == index) {
					continue;
				}
				variant.lastWord = index;
				const auto text  = getWordAnnotationItemText(roman);
				if (!text.empty()) {
					if (!variant.view.text.empty() && variant.lastSpaceCount != spaceCount) {
						variant.view.text += ' ';
					}
					variant.view.text += text;
					variant.lastSpaceCount = spaceCount;
				}
			}
		}
		std::vector<LineRomanView> views;
		for (auto& variant : variants) {
			if (!variant.view.text.empty()) {
				views.push_back(std::move(variant.view));
			}
		}
		return views;
	}

	std::vector<LineRomanView> deriveLineRomanViews(const std::optional<LineContent>& content) {
		return content ? deriveLineRomanViews(*content) : std::vector<LineRomanView>{};
	}

	std::vector<Diagnostic> validateLineAnnotationRomanContent(const std::optional<LineAnnotationRomanContent>& content,
		std::string_view                                                                                    path,
		const std::optional<TimeRange>&                                                                     time) {
		std::vector<Diagnostic> diagnostics;
		const bool              hasTokens = content && !content->tokens.empty();
		const bool              hasText   = content && content->text.has_value();
		if (!hasTokens && !hasText) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kLineAnnotationRomanContentMissing});
		} else if (hasTokens && hasText) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kLineAnnotationRomanContentAmbiguous});
		}
		if (hasText && content->text->empty()) {
			diagnostics.push_back({utils::childPath(path, "text"), DiagnosticCode::kLineAnnotationRomanContentTextEmpty});
		}
		if (hasTokens) {
			if (std::none_of(content->tokens.begin(), content->tokens.end(), [](const common::TextToken& token) { return token.time.has_value(); })) {
				diagnostics.push_back({utils::childPath(path, "tokens"), DiagnosticCode::kLineAnnotationRomanContentTokensTimeMissing});
			}
			for (std::size_t index = 0; index < content->tokens.size(); ++index) {
				const auto& token     = content->tokens[index];
				const auto  tokenPath = utils::indexedPath(path, "tokens", index);
				if (token.text.empty()) {
					diagnostics.push_back({utils::childPath(tokenPath, "text"), DiagnosticCode::kLineAnnotationRomanTokenTextEmpty});
				}
				utils::appendDiagnostics(diagnostics, common::validateTextToken(token, tokenPath));
				if (utils::isTimeUncovered(token.time, time)) {
					diagnostics.push_back({utils::childPath(tokenPath, "time"), DiagnosticCode::kLineAnnotationRomanTimeUncovered});
				}
			}
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateLineAnnotationRoman(const LineAnnotationRoman& roman, std::string_view path) {
		auto diagnostics = validateLineAnnotationRomanContent(roman.content, utils::childPath(path, "content"), roman.time);
		utils::validateLanguage(roman.language, path, diagnostics);
		if (roman.time) {
			utils::appendDiagnostics(diagnostics, common::validateTimeRange(*roman.time, utils::childPath(path, "time")));
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateLineAnnotation(const LineAnnotation& annotation, std::string_view path) {
		std::vector<Diagnostic> diagnostics;
		utils::reportDuplicates(annotation.romans,
			utils::annotationVariantKey<LineAnnotationRoman>,
			path,
			"romans",
			DiagnosticCode::kLineAnnotationRomansDuplicate,
			diagnostics);
		utils::reportDuplicates(
			annotation.translations,
			[](const LineAnnotationTranslation& item) { return utils::languageKey(item.language); },
			path,
			"translations",
			DiagnosticCode::kLineAnnotationTranslationsLanguageDuplicate,
			diagnostics);
		utils::validateEntries(annotation.romans, validateLineAnnotationRoman, path, "romans", diagnostics);
		for (std::size_t index = 0; index < annotation.translations.size(); ++index) {
			utils::validateLanguage(annotation.translations[index].language, utils::indexedPath(path, "translations", index), diagnostics);
		}
		for (std::size_t index = 0; index < annotation.translations.size(); ++index) {
			utils::reportDefaultEntry(annotation.translations[index], utils::indexedPath(path, "translations", index), diagnostics);
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateLineContent(const std::optional<LineContent>& content,
		const std::optional<TimeRange>&                                       time,
		std::string_view                                                      path,
		TimingLevel                                                           timing,
		bool                                                                  required) {
		std::vector<Diagnostic> diagnostics;
		const bool              hasWords = hasContentWords(content);
		const bool              hasText  = content && content->text.has_value();
		if (required && !hasWords && !hasText) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kLineContentMissing});
		} else if (hasWords && hasText) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kLineContentAmbiguous});
		}
		if (hasText && content->text->empty()) {
			diagnostics.push_back({utils::childPath(path, "text"), DiagnosticCode::kLineContentTextEmpty});
		}
		if (hasWords) {
			const auto wordsPath = utils::childPath(path, "words");
			if (timing == TimingLevel::kNone) {
				diagnostics.push_back({wordsPath, DiagnosticCode::kLyricTimingNoneWords});
			} else if (timing == TimingLevel::kLine) {
				diagnostics.push_back({wordsPath, DiagnosticCode::kLyricTimingLineWords});
			}
			utils::appendDiagnostics(diagnostics, validateWords(content->words, time, wordsPath, timing));
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateLineBackground(const LineBackground& background, std::string_view path, TimingLevel timing) {
		std::vector<Diagnostic> diagnostics;
		validateLineTime(background.time, path, timing, false, true, diagnostics);
		validateSungFields(background, path, timing, true, diagnostics);
		return diagnostics;
	}

	std::vector<Diagnostic> validateLine(const Line& line, std::string_view path, TimingLevel timing) {
		std::vector<Diagnostic> diagnostics;
		const bool              instrumental = line.type == LineType::kInstrumental;
		const bool              sung         = line.type == LineType::kNormal;
		if (!instrumental && !sung) {
			diagnostics.push_back({utils::childPath(path, "type"), DiagnosticCode::kLineTypeUnspecified});
		}
		if (instrumental && timing == TimingLevel::kNone) {
			diagnostics.push_back({utils::childPath(path, "type"), DiagnosticCode::kLyricTimingNoneInstrumental});
		}
		validateLineTime(line.time, path, timing, instrumental, sung, diagnostics);
		if (line.part) {
			utils::appendDiagnostics(diagnostics, common::validatePart(*line.part, utils::childPath(path, "part")));
			if (sung && line.part->type == common::PartType::kInterlude) {
				diagnostics.push_back({utils::childPath(path, "part.type"), DiagnosticCode::kLinePartInterludeNotInstrumental});
			}
		}
		if (instrumental) {
			if (!line.agent_ids.empty()) {
				diagnostics.push_back({utils::childPath(path, "agentIds"), DiagnosticCode::kLineAgentIdsUnexpected});
			}
			if (!line.languages.empty()) {
				diagnostics.push_back({utils::childPath(path, "languages"), DiagnosticCode::kLineLanguagesUnexpected});
			}
			if (line.content) {
				diagnostics.push_back({utils::childPath(path, "content"), DiagnosticCode::kLineContentUnexpected});
			}
			if (line.annotation) {
				diagnostics.push_back({utils::childPath(path, "annotation"), DiagnosticCode::kLineAnnotationUnexpected});
			}
			if (!line.backgrounds.empty()) {
				diagnostics.push_back({utils::childPath(path, "backgrounds"), DiagnosticCode::kLineBackgroundsUnexpected});
			}
			return diagnostics;
		}
		validateSungFields(line, path, timing, sung, diagnostics);
		utils::reportUnordered(line.backgrounds, path, "backgrounds", DiagnosticCode::kLineBackgroundsUnordered, diagnostics);
		for (std::size_t index = 0; index < line.backgrounds.size(); ++index) {
			const auto& background     = line.backgrounds[index];
			const auto  backgroundPath = utils::indexedPath(path, "backgrounds", index);
			// A background may begin before the owning line, so only the ends constrain each other.
			if (utils::isTimeOrdered(line.time) && utils::isTimeOrdered(background.time) && utils::comparableEnd(*background.time) > utils::comparableEnd(*line.time)) {
				diagnostics.push_back({utils::childPath(backgroundPath, "time"), DiagnosticCode::kLineBackgroundsTimeUncovered});
			}
			utils::appendDiagnostics(diagnostics, validateLineBackground(background, backgroundPath, timing));
		}
		return diagnostics;
	}

	LineAnnotationRomanContent canonicalizeLineAnnotationRomanContent(LineAnnotationRomanContent content) {
		utils::canonicalizeEntries(content.tokens, common::canonicalizeTextToken);
		return content;
	}

	LineAnnotationRoman canonicalizeLineAnnotationRoman(LineAnnotationRoman roman) {
		utils::normalizeLanguage(roman.language);
		utils::normalizeLanguage(roman.scheme);
		utils::canonicalizeField(roman.content, canonicalizeLineAnnotationRomanContent);
		return roman;
	}

	LineAnnotationTranslation canonicalizeLineAnnotationTranslation(LineAnnotationTranslation translation) {
		utils::normalizeLanguage(translation.language);
		return translation;
	}

	LineAnnotation canonicalizeLineAnnotation(LineAnnotation annotation) {
		utils::canonicalizeEntries(annotation.romans, canonicalizeLineAnnotationRoman);
		utils::canonicalizeEntries(annotation.translations, canonicalizeLineAnnotationTranslation);
		return annotation;
	}

	LineContent canonicalizeLineContent(LineContent content) {
		utils::canonicalizeEntries(content.words, canonicalizeWord);
		return content;
	}

	LineBackground canonicalizeLineBackground(LineBackground background) {
		canonicalizeSungFields(background);
		return background;
	}

	Line canonicalizeLine(Line line) {
		utils::unsetIfDefault(line.part);
		canonicalizeSungFields(line);
		utils::canonicalizeEntries(line.backgrounds, canonicalizeLineBackground);
		return orderLineBackgrounds(std::move(line));
	}

	Line orderLineBackgrounds(Line line) {
		utils::sortByStart(line.backgrounds);
		return line;
	}
} // namespace gondola::lyrics::model::enriched
