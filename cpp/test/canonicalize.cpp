#include <limits>

#include "test.hpp"

namespace gondola::lyrics::model::test {
	namespace {
		template <typename Lyric>
		void lyricNormalizationFor() {
			using Line     = typename decltype(Lyric{}.lines)::value_type;
			auto lyric     = lyricWithTiming<Lyric>(common::TimingLevel::kWord);
			lyric.format   = "TTML";
			lyric.profile  = "AMLL";
			auto line      = textLine<Line>("Lead", common::makeTimeRange(0, 2000));
			line.part      = common::makePart(common::PartType::kVerse, "Verse-A", "Verse 1");
			line.languages = {"EN", "", "en", "JA-JP"};
			line.agent_ids = {"", "lead"};
			line.content->text.reset();
			line.content->words.emplace_back();
			auto& word    = line.content->words[0];
			word.type     = decltype(word.type)::kNormal;
			word.text     = "shi";
			word.language = "JA-Latn";
			word.time     = common::makeTimeRange(0, 0);
			if constexpr (std::is_same_v<Lyric, enriched::Lyric>) {
				word.emphasis = enriched::makeWordEmphasis(false, false);
			} else {
				word.emphasis = false;
			}
			word.annotation.emplace();
			word.annotation->romans.emplace_back();
			auto& roman      = word.annotation->romans[0];
			roman.language   = "JA-Latn";
			roman.scheme     = "HEPBURN";
			const auto token = common::makeTextToken(common::makeTimeRange(0, 0), " shi ", {{"Case", ""}, {"case", "lower"}});
			roman.tokens     = {common::TextToken{}, token};
			word.annotation->romans.emplace_back();
			lyric.lines  = {line, Line{}};
			lyric.agents = {common::Agent{}, common::makeAgent("lead", common::AgentType::kPerson)};
			lyric.meta   = common::makeMeta({}, 0, 0, "");
			lyric.extra  = {{"Case", "upper"}, {"case", "lower"}};
			if constexpr (std::is_same_v<Lyric, enriched::Lyric>) {
				lyric.language_usages = enriched::deriveLanguageUsages(lyric.lines);
			}
			const auto canonical = canonicalizeLyric(lyric);
			expectEqual(canonical.format, std::string("ttml"), "Format identifiers normalize to ASCII lowercase");
			expectEqual(canonical.profile, std::string("amll"), "Profile identifiers normalize to ASCII lowercase");
			expectEqual(canonical.lines.size(), std::size_t{1}, "All-default lines are removed");
			expectEqual(canonical.agents.size(), std::size_t{1}, "All-default agents are removed");
			const auto& normalizedLine = canonical.lines[0];
			expectEqual(normalizedLine.id, std::string("Lead"), "Source identity remains case-sensitive");
			expectEqual(normalizedLine.part->id, std::optional<std::string>{"Verse-A"}, "Part identifiers are not normalized");
			expectEqual(normalizedLine.languages, std::vector<std::string>{"en", "ja-jp"}, "Languages normalize and remove empty duplicates");
			expectEqual(normalizedLine.agent_ids, std::vector<std::string>{"lead"}, "Empty agent references are removed");
			const auto& normalizedWord = normalizedLine.content->words[0];
			expectEqual(normalizedWord.time, std::optional{common::makeTimeRange(0, 0)}, "Zero time ranges are not removed");
			expectEqual(normalizedWord.language, std::optional<std::string>{"ja-latn"}, "Word language normalizes");
			expect(normalizedWord.annotation && normalizedWord.annotation->romans.size() == 1, "Default annotation items are removed");
			const auto& normalizedRoman = normalizedWord.annotation->romans[0];
			expectEqual(normalizedRoman.language, std::optional<std::string>{"ja-latn"}, "Annotation language normalizes");
			expectEqual(normalizedRoman.scheme, std::optional<std::string>{"hepburn"}, "Annotation scheme normalizes");
			expectEqual(normalizedRoman.tokens, std::vector<common::TextToken>{token}, "Token text, explicit timing and extensions are preserved");
			expect(canonical.meta && canonical.meta->duration == 0U && !canonical.meta->language,
				"Explicit zero duration is preserved while empty language is removed");
			expectEqual(canonical.extra, lyric.extra, "Extension keys remain case-sensitive");
			if constexpr (std::is_same_v<Lyric, enriched::Lyric>) {
				expectEqual(normalizedWord.emphasis, std::optional{enriched::makeWordEmphasis(false, false)}, "Explicit enriched decisions remain present");
			} else {
				expectEqual(normalizedWord.emphasis, std::optional{false}, "Explicit document false remains present");
			}
			expectEqual(canonicalizeLyric(canonical), canonical, "Normalization is idempotent");
			expectDiagnostics(validateLyric(canonical), {});
		}

		void lyricNormalization() {
			lyricNormalizationFor<document::Lyric>();
			lyricNormalizationFor<enriched::Lyric>();
		}

		void nonAsciiIdentifierNormalization() {
			auto document                = lyricWithTiming<document::Lyric>(common::TimingLevel::kNone);
			document.format              = u8"\u00c4-FORMAT";
			document.profile             = u8"\u0130-PROFILE";
			auto enriched                = lyricWithTiming<enriched::Lyric>(common::TimingLevel::kNone);
			enriched.format              = document.format;
			enriched.profile             = document.profile;
			const auto canonicalDocument = document::canonicalizeLyric(document);
			const auto canonicalEnriched = enriched::canonicalizeLyric(enriched);
			expectEqual(canonicalDocument.format, std::string(u8"\u00c4-format"), "Only ASCII letters normalize in format identifiers");
			expectEqual(canonicalDocument.profile, std::string(u8"\u0130-profile"), "Only ASCII letters normalize in profile identifiers");
			expectEqual(canonicalEnriched.format, canonicalDocument.format, "Both layers use the same identifier rules");
			expectEqual(canonicalEnriched.profile, canonicalDocument.profile, "Both layers preserve non-ASCII profile spelling");
			const auto reference          = common::makeMetaReference(u8"\u00c4-CATALOG", {u8"\u00c4-ID"});
			const auto canonicalReference = common::canonicalizeMetaReference(reference);
			expectEqual(canonicalReference.platform, std::string(u8"\u00c4-catalog"), "Platform normalization preserves non-ASCII characters");
			expectEqual(canonicalReference.ids, reference.ids, "External identifiers retain their spelling");
		}

		void emphasisPresence() {
			const std::vector<enriched::WordEmphasis> values = {
				{},
				{false, std::nullopt},
				{true, std::nullopt},
				{false, false},
				{false, true},
				{true, false},
				{true, true},
			};
			for (std::size_t index = 0; index < values.size(); ++index) {
				const auto canonical = enriched::canonicalizeWord(enriched::makeWordNormal(std::nullopt, std::nullopt, "ah", std::nullopt, values[index]));
				const std::optional<enriched::WordEmphasis> expected = index == 0 ? std::nullopt : std::optional{values[index]};
				expectEqual(canonical.emphasis, expected, "Only an all-default emphasis is removed");
			}
		}

		void languageCountsSaturate() {
			const std::vector<enriched::LanguageUsage> usages = {
				{"EN", 3000000000U},
				{"en", 2000000000U},
				{"ZH", 2},
				{"JA", 1},
				{"ja", 1},
				{"UND", 0},
				{"", 4},
			};
			const std::vector<enriched::LanguageUsage> expected = {
				{"en", std::numeric_limits<std::uint32_t>::max()},
				{"ja", 2},
				{"zh", 2},
				{"und", 0},
			};
			expectEqual(enriched::canonicalizeLanguageUsages(usages), expected, "Merged language counts saturate at uint32 and sort by count and tag");
		}
	} // namespace

	int canonicalizeTests() {
		return runCases({
			{"normalization retains source data and explicit presence", lyricNormalization},
			{"normalization preserves non-ASCII identifiers", nonAsciiIdentifierNormalization},
			{"normalization preserves emphasis decisions and origin", emphasisPresence},
			{"normalization merges language counts without wrapping", languageCountsSaturate},
		});
	}
} // namespace gondola::lyrics::model::test
