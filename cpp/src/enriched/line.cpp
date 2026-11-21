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

		bool has_words(const std::optional<LineContent>& content) noexcept {
			return content && !content->words.empty();
		}

		template <typename T>
		std::vector<std::string> resolve_languages(const T& line) {
			if (!line.languages.empty()) {
				return utils::normalized_languages(line.languages);
			}
			return line.content ? collectWordLanguages(line.content->words) : std::vector<std::string>{};
		}

		void validate_roman_placement(const LineAnnotation& annotation,
			const std::optional<LineContent>&           content,
			std::string_view                            path,
			std::vector<Diagnostic>&                    diagnostics) {
			if (!content || annotation.romans.empty()) {
				return;
			}
			std::unordered_set<std::string> wordVariants;
			for (const auto& word : content->words) {
				if (word.type != WordType::kSpace && word.annotation) {
					for (const auto& roman : word.annotation->romans) {
						wordVariants.insert(utils::annotation_variant_key(roman));
					}
				}
			}
			for (std::size_t index = 0; index < annotation.romans.size(); ++index) {
				if (wordVariants.count(utils::annotation_variant_key(annotation.romans[index])) != 0) {
					diagnostics.push_back({utils::indexed_path(path, "romans", index), DiagnosticCode::kLineAnnotationRomansConflict});
				}
			}
		}

		void validate_line_time(const std::optional<TimeRange>& time,
			std::string_view                                path,
			TimingLevel                                     timing,
			bool                                            instrumental,
			bool                                            sung,
			std::vector<Diagnostic>&                        diagnostics) {
			const bool needsRange = instrumental && timing != TimingLevel::kNone;
			if (time) {
				const auto timePath = utils::child_path(path, "time");
				if (timing == TimingLevel::kNone) {
					diagnostics.push_back({timePath, DiagnosticCode::kLyricTimingNonePresent});
				}
				utils::append_diagnostics(diagnostics, common::validateTimeRange(*time, timePath));
				if (needsRange && !time->end) {
					diagnostics.push_back({utils::child_path(timePath, "end"), DiagnosticCode::kLineTimeEndMissing});
				} else if (needsRange && utils::is_time_ordered(time) && time->end == time->start) {
					diagnostics.push_back({timePath, DiagnosticCode::kLineTimeEmpty});
				}
			} else if (needsRange) {
				diagnostics.push_back({utils::child_path(path, "time"), DiagnosticCode::kLineTimeMissing});
			} else if (sung && utils::is_timed_content(timing)) {
				diagnostics.push_back({utils::child_path(path, "time"), DiagnosticCode::kLyricTimingLineTimeMissing});
			}
		}

		template <typename T>
		void validate_sung_fields(const T& line, std::string_view path, TimingLevel timing, bool required, std::vector<Diagnostic>& diagnostics) {
			for (std::size_t index = 0; index < line.agent_ids.size(); ++index) {
				if (line.agent_ids[index].empty()) {
					diagnostics.push_back({utils::indexed_path(path, "agentIds", index), DiagnosticCode::kLyricListEntryEmpty});
				}
			}
			for (std::size_t index = 0; index < line.languages.size(); ++index) {
				const auto& language = line.languages[index];
				if (language.empty()) {
					diagnostics.push_back({utils::indexed_path(path, "languages", index), DiagnosticCode::kLyricListEntryEmpty});
				} else if (!common::isWellFormedLanguageTag(language)) {
					diagnostics.push_back({utils::indexed_path(path, "languages", index), DiagnosticCode::kLanguageTagMalformed});
				}
			}
			utils::report_duplicates(line.languages, utils::lowercase_ascii, path, "languages", DiagnosticCode::kLineLanguagesDuplicate, diagnostics);
			utils::append_diagnostics(diagnostics, validateLineContent(line.content, line.time, utils::child_path(path, "content"), timing, required));
			if (line.annotation) {
				const auto annotationPath = utils::child_path(path, "annotation");
				utils::append_diagnostics(diagnostics, validateLineAnnotation(*line.annotation, annotationPath));
				validate_roman_placement(*line.annotation, line.content, annotationPath, diagnostics);
			}
		}

		template <typename T>
		void canonicalize_sung_fields(T& line) {
			utils::erase_defaults(line.agent_ids);
			line.languages = utils::normalized_languages(line.languages);
			utils::canonicalize_field(line.content, canonicalizeLineContent);
			utils::canonicalize_field(line.annotation, canonicalizeLineAnnotation);
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
		return has_words(line.content);
	}

	bool hasLineWords(const LineBackground& line) noexcept {
		return has_words(line.content);
	}

	std::vector<std::string> resolveLineLanguages(const Line& line) {
		return resolve_languages(line);
	}

	std::vector<std::string> resolveLineLanguages(const LineBackground& line) {
		return resolve_languages(line);
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
		return roman.content->text ? *roman.content->text : utils::join_text(roman.content->tokens);
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
				const auto [position, inserted] = positions.try_emplace(utils::annotation_variant_key(roman), variants.size());
				if (inserted) {
					LineRomanView view{roman.language, roman.scheme, {}};
					utils::normalize_language(view.language);
					utils::normalize_language(view.scheme);
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
			diagnostics.push_back({utils::child_path(path, "text"), DiagnosticCode::kLineAnnotationRomanContentTextEmpty});
		}
		if (hasTokens) {
			if (std::none_of(content->tokens.begin(), content->tokens.end(), [](const common::TextToken& token) { return token.time.has_value(); })) {
				diagnostics.push_back({utils::child_path(path, "tokens"), DiagnosticCode::kLineAnnotationRomanContentTokensTimeMissing});
			}
			for (std::size_t index = 0; index < content->tokens.size(); ++index) {
				const auto& token     = content->tokens[index];
				const auto  tokenPath = utils::indexed_path(path, "tokens", index);
				if (token.text.empty()) {
					diagnostics.push_back({utils::child_path(tokenPath, "text"), DiagnosticCode::kLineAnnotationRomanTokenTextEmpty});
				}
				utils::append_diagnostics(diagnostics, common::validateTextToken(token, tokenPath));
				if (utils::is_time_uncovered(token.time, time)) {
					diagnostics.push_back({utils::child_path(tokenPath, "time"), DiagnosticCode::kLineAnnotationRomanTimeUncovered});
				}
			}
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateLineAnnotationRoman(const LineAnnotationRoman& roman, std::string_view path) {
		auto diagnostics = validateLineAnnotationRomanContent(roman.content, utils::child_path(path, "content"), roman.time);
		utils::validate_language(roman.language, path, diagnostics);
		if (roman.time) {
			utils::append_diagnostics(diagnostics, common::validateTimeRange(*roman.time, utils::child_path(path, "time")));
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateLineAnnotation(const LineAnnotation& annotation, std::string_view path) {
		std::vector<Diagnostic> diagnostics;
		utils::report_duplicates(annotation.romans,
			utils::annotation_variant_key<LineAnnotationRoman>,
			path,
			"romans",
			DiagnosticCode::kLineAnnotationRomansDuplicate,
			diagnostics);
		utils::report_duplicates(
			annotation.translations,
			[](const LineAnnotationTranslation& item) { return utils::language_key(item.language); },
			path,
			"translations",
			DiagnosticCode::kLineAnnotationTranslationsLanguageDuplicate,
			diagnostics);
		utils::validate_entries(annotation.romans, validateLineAnnotationRoman, path, "romans", diagnostics);
		for (std::size_t index = 0; index < annotation.translations.size(); ++index) {
			utils::validate_language(annotation.translations[index].language, utils::indexed_path(path, "translations", index), diagnostics);
		}
		for (std::size_t index = 0; index < annotation.translations.size(); ++index) {
			utils::report_default_entry(annotation.translations[index], utils::indexed_path(path, "translations", index), diagnostics);
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateLineContent(const std::optional<LineContent>& content,
		const std::optional<TimeRange>&                                       time,
		std::string_view                                                      path,
		TimingLevel                                                           timing,
		bool                                                                  required) {
		std::vector<Diagnostic> diagnostics;
		const bool              hasWords = has_words(content);
		const bool              hasText  = content && content->text.has_value();
		if (required && !hasWords && !hasText) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kLineContentMissing});
		} else if (hasWords && hasText) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kLineContentAmbiguous});
		}
		if (hasText && content->text->empty()) {
			diagnostics.push_back({utils::child_path(path, "text"), DiagnosticCode::kLineContentTextEmpty});
		}
		if (hasWords) {
			const auto wordsPath = utils::child_path(path, "words");
			if (timing == TimingLevel::kNone) {
				diagnostics.push_back({wordsPath, DiagnosticCode::kLyricTimingNoneWords});
			} else if (timing == TimingLevel::kLine) {
				diagnostics.push_back({wordsPath, DiagnosticCode::kLyricTimingLineWords});
			}
			utils::append_diagnostics(diagnostics, validateWords(content->words, time, wordsPath, timing));
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateLineBackground(const LineBackground& background, std::string_view path, TimingLevel timing) {
		std::vector<Diagnostic> diagnostics;
		validate_line_time(background.time, path, timing, false, true, diagnostics);
		validate_sung_fields(background, path, timing, true, diagnostics);
		return diagnostics;
	}

	std::vector<Diagnostic> validateLine(const Line& line, std::string_view path, TimingLevel timing) {
		std::vector<Diagnostic> diagnostics;
		const bool              instrumental = line.type == LineType::kInstrumental;
		const bool              sung         = line.type == LineType::kNormal;
		if (!instrumental && !sung) {
			diagnostics.push_back({utils::child_path(path, "type"), DiagnosticCode::kLineTypeUnspecified});
		}
		if (instrumental && timing == TimingLevel::kNone) {
			diagnostics.push_back({utils::child_path(path, "type"), DiagnosticCode::kLyricTimingNoneInstrumental});
		}
		validate_line_time(line.time, path, timing, instrumental, sung, diagnostics);
		if (line.part) {
			utils::append_diagnostics(diagnostics, common::validatePart(*line.part, utils::child_path(path, "part")));
			if (sung && line.part->type == common::PartType::kInterlude) {
				diagnostics.push_back({utils::child_path(path, "part.type"), DiagnosticCode::kLinePartInterludeNotInstrumental});
			}
		}
		if (instrumental) {
			if (!line.agent_ids.empty()) {
				diagnostics.push_back({utils::child_path(path, "agentIds"), DiagnosticCode::kLineAgentIdsUnexpected});
			}
			if (!line.languages.empty()) {
				diagnostics.push_back({utils::child_path(path, "languages"), DiagnosticCode::kLineLanguagesUnexpected});
			}
			if (line.content) {
				diagnostics.push_back({utils::child_path(path, "content"), DiagnosticCode::kLineContentUnexpected});
			}
			if (line.annotation) {
				diagnostics.push_back({utils::child_path(path, "annotation"), DiagnosticCode::kLineAnnotationUnexpected});
			}
			if (!line.backgrounds.empty()) {
				diagnostics.push_back({utils::child_path(path, "backgrounds"), DiagnosticCode::kLineBackgroundsUnexpected});
			}
			return diagnostics;
		}
		validate_sung_fields(line, path, timing, sung, diagnostics);
		utils::report_unordered(line.backgrounds, path, "backgrounds", DiagnosticCode::kLineBackgroundsUnordered, diagnostics);
		for (std::size_t index = 0; index < line.backgrounds.size(); ++index) {
			const auto& background     = line.backgrounds[index];
			const auto  backgroundPath = utils::indexed_path(path, "backgrounds", index);
			// A background may begin before the owning line, so only the ends constrain each other.
			if (utils::is_time_ordered(line.time) && utils::is_time_ordered(background.time) &&
				utils::comparable_end(*background.time) > utils::comparable_end(*line.time)) {
				diagnostics.push_back({utils::child_path(backgroundPath, "time"), DiagnosticCode::kLineBackgroundsTimeUncovered});
			}
			utils::append_diagnostics(diagnostics, validateLineBackground(background, backgroundPath, timing));
		}
		return diagnostics;
	}

	LineAnnotationRomanContent canonicalizeLineAnnotationRomanContent(LineAnnotationRomanContent content) {
		utils::canonicalize_entries(content.tokens, common::canonicalizeTextToken);
		return content;
	}

	LineAnnotationRoman canonicalizeLineAnnotationRoman(LineAnnotationRoman roman) {
		utils::normalize_language(roman.language);
		utils::normalize_language(roman.scheme);
		utils::canonicalize_field(roman.content, canonicalizeLineAnnotationRomanContent);
		return roman;
	}

	LineAnnotationTranslation canonicalizeLineAnnotationTranslation(LineAnnotationTranslation translation) {
		utils::normalize_language(translation.language);
		return translation;
	}

	LineAnnotation canonicalizeLineAnnotation(LineAnnotation annotation) {
		utils::canonicalize_entries(annotation.romans, canonicalizeLineAnnotationRoman);
		utils::canonicalize_entries(annotation.translations, canonicalizeLineAnnotationTranslation);
		return annotation;
	}

	LineContent canonicalizeLineContent(LineContent content) {
		utils::canonicalize_entries(content.words, canonicalizeWord);
		return content;
	}

	LineBackground canonicalizeLineBackground(LineBackground background) {
		canonicalize_sung_fields(background);
		return background;
	}

	Line canonicalizeLine(Line line) {
		utils::unset_if_default(line.part);
		canonicalize_sung_fields(line);
		utils::canonicalize_entries(line.backgrounds, canonicalizeLineBackground);
		return orderLineBackgrounds(std::move(line));
	}

	Line orderLineBackgrounds(Line line) {
		utils::sort_by_start(line.backgrounds);
		return line;
	}

} // namespace gondola::lyrics::model::enriched
