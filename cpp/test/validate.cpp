#include "test.hpp"

namespace gondola::lyrics::model::test {
	namespace {
		template <typename Lyric>
		void metadataDiagnosticsFor() {
			auto         lyric = lyricWithTiming<Lyric>(common::TimingLevel::kNone);
			common::Meta meta;
			meta.titles     = {common::makeText("en_US", "Song")};
			meta.references = {common::makeMetaReference("catalog", {""})};
			expectDiagnostics(common::validateMeta(meta),
				{
					{"titles[0].language", "language.tag.malformed"},
					{"references[0].ids[0]", "lyric.list.entry.empty"},
				});
			lyric.meta = meta;
			expectDiagnostics(validateLyric(lyric),
				{
					{"meta.titles[0].language", "language.tag.malformed"},
					{"meta.references[0].ids[0]", "lyric.list.entry.empty"},
				});
		}

		void metadataDiagnostics() {
			metadataDiagnosticsFor<document::Lyric>();
			metadataDiagnosticsFor<enriched::Lyric>();
		}

		template <typename Lyric>
		void lineTimingFor() {
			using Line  = typename decltype(Lyric{}.lines)::value_type;
			auto lyric  = lyricWithTiming<Lyric>(common::TimingLevel::kLine);
			lyric.lines = {
				textLine<Line>("first", common::makeTimeRange(0, 1000)),
				textLine<Line>("middle", common::makeTimeRange(1000)),
				textLine<Line>("last", common::makeTimeRange(2000, 3000)),
			};
			expectDiagnostics(validateLyric(lyric), {{"lines[1].time.end", "lyric.line.time.end.missing"}});
			lyric.lines[1].time->end = 2000;
			lyric.lines[2].time->end.reset();
			expectDiagnostics(validateLyric(lyric), {});
			lyric.lines[0].time.reset();
			expectDiagnostics(validateLyric(lyric), {{"lines[0].time", "lyric.timing.line.time_missing"}});
			lyric.lines         = {Line{}};
			lyric.lines[0].type = decltype(lyric.lines[0].type)::kInstrumental;
			lyric.timing        = common::TimingLevel::kNone;
			expectDiagnostics(validateLyric(lyric), {{"lines[0].type", "lyric.timing.none.instrumental"}});
		}

		void lineTiming() {
			lineTimingFor<document::Lyric>();
			lineTimingFor<enriched::Lyric>();
		}

		template <typename Lyric>
		void forbiddenFieldsFor() {
			using Line = typename decltype(Lyric{}.lines)::value_type;
			auto lyric = lyricWithTiming<Lyric>(common::TimingLevel::kLine);
			Line line;
			line.id   = "same";
			line.type = decltype(line.type)::kInstrumental;
			line.time = common::makeTimeRange(0, 1000);
			line.backgrounds.emplace_back();
			auto& background     = line.backgrounds[0];
			background.id        = "same";
			background.agent_ids = {"ghost"};
			background.languages = {"en_US"};
			lyric.lines          = {line};
			expectDiagnostics(validateLyric(lyric),
				{
					{"lines[0].backgrounds[0]", "lyric.line.id.duplicate"},
					{"lines[0].backgrounds[0].agentIds[0]", "lyric.line.agent.dangling"},
					{"lines[0].backgrounds", "line.backgrounds.unexpected"},
				});
			using Content = typename decltype(line.content)::value_type;
			using Word    = typename decltype(Content{}.words)::value_type;
			Word word;
			word.type     = decltype(word.type)::kSpace;
			word.text     = " ";
			word.language = "en_US";
			word.annotation.emplace();
			expectDiagnostics(validateWord(word),
				{
					{"language", "line.word.language.unexpected"},
					{"annotation", "line.word.annotation.unexpected"},
				});
		}

		void forbiddenFields() {
			forbiddenFieldsFor<document::Lyric>();
			forbiddenFieldsFor<enriched::Lyric>();
		}

		template <typename Lyric>
		void referencePathsFor() {
			using Line     = typename decltype(Lyric{}.lines)::value_type;
			auto lyric     = lyricWithTiming<Lyric>(common::TimingLevel::kLine);
			lyric.agents   = {common::makeAgent("known", common::AgentType::kPerson)};
			auto line      = textLine<Line>("lead", common::makeTimeRange(1000, 2000));
			line.agent_ids = {"known", "missing"};
			line.backgrounds.emplace_back();
			auto& background     = line.backgrounds[0];
			background.id        = "background";
			background.time      = line.time;
			background.agent_ids = {"background-missing"};
			background.content.emplace();
			background.content->text = "background";
			lyric.lines              = {line};
			expectDiagnostics(validateLyric(lyric),
				{
					{"lines[0].agentIds[1]", "lyric.line.agent.dangling"},
					{"lines[0].backgrounds[0].agentIds[0]", "lyric.line.agent.dangling"},
				});
			lyric.lines[0].backgrounds[0].time->end = 2500;
			expectDiagnostics(validateLine(lyric.lines[0], "line", common::TimingLevel::kLine),
				{
					{"line.backgrounds[0].time", "line.backgrounds.time.uncovered"},
				});
		}

		void referencePaths() {
			referencePathsFor<document::Lyric>();
			referencePathsFor<enriched::Lyric>();
		}

		template <typename Line>
		void annotationVariantsFor() {
			Line line;
			line.content.emplace();
			line.content->words.emplace_back();
			auto& word = line.content->words[0];
			word.annotation.emplace();
			line.annotation.emplace();
			const std::pair<std::string, std::optional<std::string>> variants[] = {
				{"JA-Latn", "HEPBURN"},
				{"ja-latn", "kunrei"},
				{"ja", "hepburn"},
				{"ja-latn", "hepburn"},
				{"ja-latn", std::nullopt},
				{"JA-LATN", ""},
			};
			for (const auto& [language, scheme] : variants) {
				word.annotation->rubies.emplace_back();
				word.annotation->rubies.back().language = language;
				word.annotation->rubies.back().scheme   = scheme;
				word.annotation->romans.emplace_back();
				word.annotation->romans.back().language = language;
				word.annotation->romans.back().scheme   = scheme;
				line.annotation->romans.emplace_back();
				auto& roman    = line.annotation->romans.back();
				roman.language = language;
				roman.scheme   = scheme;
				roman.content.emplace();
				roman.content->text = "roman";
			}
			for (std::string_view language : {"zh-Hans", "ZH-HANS"}) {
				word.annotation->translations.emplace_back();
				word.annotation->translations.back().language = language;
				word.annotation->translations.back().text     = "translation";
				line.annotation->translations.emplace_back();
				line.annotation->translations.back().language = language;
				line.annotation->translations.back().text     = "translation";
			}
			expectDiagnostics(validateWordAnnotation(*word.annotation),
				{
					{"rubies[3]", "line.word.annotation.rubies.duplicate"},
					{"rubies[5]", "line.word.annotation.rubies.duplicate"},
					{"romans[3]", "line.word.annotation.romans.duplicate"},
					{"romans[5]", "line.word.annotation.romans.duplicate"},
					{"translations[1]", "line.word.annotation.translations.language.duplicate"},
				});
			expectDiagnostics(validateLineAnnotation(*line.annotation),
				{
					{"romans[3]", "line.annotation.romans.duplicate"},
					{"romans[5]", "line.annotation.romans.duplicate"},
					{"translations[1]", "line.annotation.translations.language.duplicate"},
				});
		}

		void annotationVariants() {
			annotationVariantsFor<document::Line>();
			annotationVariantsFor<enriched::Line>();
		}

		template <typename Lyric>
		Lyric lyricWithParts(const std::vector<std::optional<common::Part>>& parts, bool interludesAreInstrumental = false) {
			using Line = typename decltype(Lyric{}.lines)::value_type;
			auto lyric = lyricWithTiming<Lyric>(common::TimingLevel::kLine);
			for (std::size_t index = 0; index < parts.size(); ++index) {
				auto line = textLine<Line>(std::to_string(index),
					common::makeTimeRange(static_cast<std::int64_t>(index * 1000), static_cast<std::int64_t>((index + 1) * 1000)));
				line.part = parts[index];
				if (interludesAreInstrumental && line.part && line.part->type == common::PartType::kInterlude) {
					line.type = decltype(line.type)::kInstrumental;
					line.content.reset();
				}
				lyric.lines.push_back(std::move(line));
			}
			return lyric;
		}

		template <typename Lyric>
		void partIdentityFor() {
			const auto chorus        = common::makePart(common::PartType::kChorus, "Chorus", "chorus");
			auto       differentType = chorus;
			differentType.type       = common::PartType::kVerse;
			auto differentRaw        = chorus;
			differentRaw.raw         = "Chorus";
			expectDiagnostics(validateLyric(lyricWithParts<Lyric>({chorus, differentType, differentRaw})),
				{
					{"lines[1].part", "lyric.part.mismatch"},
					{"lines[2].part", "lyric.part.mismatch"},
				});
			expectDiagnostics(validateLyric(lyricWithParts<Lyric>({chorus, std::nullopt, chorus, chorus})),
				{
					{"lines[2].part.id", "lyric.part.id.reused"},
				});
			auto lowerCaseId = chorus;
			lowerCaseId.id   = "chorus";
			expectDiagnostics(validateLyric(lyricWithParts<Lyric>({chorus, chorus, lowerCaseId})), {});
			const auto interlude = common::makePart(common::PartType::kInterlude);
			const auto verse     = common::makePart(common::PartType::kVerse);
			expectDiagnostics(validateLyric(lyricWithParts<Lyric>({interlude, verse, interlude}, true)),
				{
					{"lines[2].part.type", "lyric.part.interlude.trailing"},
				});
			auto lyric = lyricWithParts<Lyric>({interlude, verse});
			expectDiagnostics(validateLine(lyric.lines[0], "line", common::TimingLevel::kLine),
				{
					{"line.part.type", "line.part.interlude.not_instrumental"},
				});
		}

		void partIdentity() {
			partIdentityFor<document::Lyric>();
			partIdentityFor<enriched::Lyric>();
		}

		void languageUsageDiagnostics() {
			auto lyric               = lyricWithTiming<enriched::Lyric>(common::TimingLevel::kNone);
			lyric.lines              = {textLine<enriched::Line>("first"), textLine<enriched::Line>("second")};
			lyric.lines[0].languages = {"EN", "ja"};
			lyric.lines[1].languages = {"en"};
			lyric.language_usages    = enriched::deriveLanguageUsages(lyric.lines);
			expectEqual(lyric.language_usages, std::vector<enriched::LanguageUsage>{{"en", 2}, {"ja", 1}}, "Language usage counts each tag once per normal line");
			expectDiagnostics(enriched::validateLyric(lyric), {});
			lyric.language_usages.pop_back();
			expectDiagnostics(enriched::validateLyric(lyric), {{"languageUsages", "lyric.language_usages.mismatch"}});
			lyric.language_usages = {{"en", 2}, {"ja", 1}, {"EN", 2}};
			expectDiagnostics(enriched::validateLyric(lyric),
				{
					{"languageUsages[2]", "lyric.language_usages.tag.duplicate"},
					{"languageUsages", "lyric.language_usages.mismatch"},
				});
			lyric.language_usages = {{"en_US", 2}, {"ja", 1}};
			expectDiagnostics(enriched::validateLyric(lyric),
				{
					{"languageUsages[0].tag", "language.tag.malformed"},
					{"languageUsages", "lyric.language_usages.mismatch"},
				});
		}

		void emphasisAndStatusDiagnostics() {
			for (bool derived : {false, true}) {
				const auto word = enriched::makeWordNormal(std::nullopt, std::nullopt, "ah", std::nullopt, enriched::makeWordEmphasis(std::nullopt, derived));
				expectDiagnostics(enriched::validateWord(word, "word", common::TimingLevel::kLine),
					{
						{"word.emphasis.value", "line.word.emphasis.value.missing"},
					});
			}
			const auto unresolved = static_cast<enriched::LyricStatus>(99);
			expectThrows<std::invalid_argument>([&] { (void)enriched::makeLyric(unresolved); }, "Constructors must reject unresolved parse status");
			auto lyric   = lyricWithTiming<enriched::Lyric>(common::TimingLevel::kNone);
			lyric.status = unresolved;
			expectDiagnostics(enriched::validateLyric(lyric), {{"status", "lyric.status.unspecified"}});
		}
	} // namespace

	int validateTests() {
		return runCases({
			{"metadata diagnostics preserve nested paths and order", metadataDiagnostics},
			{"timing diagnostics allow only the last line to remain open", lineTiming},
			{"forbidden fields stop local checks but retain global identity checks", forbiddenFields},
			{"agent and background timing diagnostics locate their fields", referencePaths},
			{"annotation variants compare language and scheme together", annotationVariants},
			{"part identity remains exact and contiguous", partIdentity},
			{"language usage errors precede aggregate mismatch", languageUsageDiagnostics},
			{"emphasis origin needs a decision and status must be resolved", emphasisAndStatusDiagnostics},
		});
	}
} // namespace gondola::lyrics::model::test
