#include "test.hpp"

namespace gondola::lyrics::model::test {
	namespace {
		template <typename Lines>
		std::vector<std::string> lineIds(const Lines& lines) {
			std::vector<std::string> ids;
			for (const auto& line : lines) {
				ids.push_back(line.id);
			}
			return ids;
		}

		template <typename Lyric>
		void stableTimelineFor() {
			using Line                                                              = typename decltype(Lyric{}.lines)::value_type;
			const std::pair<std::string, std::optional<common::TimeRange>> ranges[] = {
				{"untimed-first", std::nullopt},
				{"later", common::makeTimeRange(2000, 3000)},
				{"reversed", common::makeTimeRange(500, 100)},
				{"open", common::makeTimeRange(1000)},
				{"closed", common::makeTimeRange(1000, 1500)},
				{"overflow", common::makeTimeRange(100, 2147483648LL)},
				{"untimed-second", std::nullopt},
				{"empty", common::makeTimeRange(1000, 1000)},
			};
			auto lyric = lyricWithTiming<Lyric>(common::TimingLevel::kLine);
			for (const auto& [id, time] : ranges) {
				lyric.lines.push_back(textLine<Line>(id, time));
			}
			const auto                     original = lineIds(lyric.lines);
			const std::vector<std::string> expected = {
				"open",
				"closed",
				"empty",
				"later",
				"untimed-first",
				"reversed",
				"overflow",
				"untimed-second",
			};
			expectEqual(lineIds(orderLyric(lyric).lines), expected, "Ordering sorts usable starts stably and retains invalid ranges at the end");
			expectEqual(lineIds(canonicalizeLyric(lyric).lines), expected, "Canonicalization uses the same timeline ordering");
			expectEqual(lineIds(lyric.lines), original, "Ordering leaves the input timeline intact");
		}

		void stableTimeline() {
			stableTimelineFor<document::Lyric>();
			stableTimelineFor<enriched::Lyric>();
		}

		template <typename Lyric>
		void equalStartPartsFor() {
			using Line        = typename decltype(Lyric{}.lines)::value_type;
			const auto verse  = common::makePart(common::PartType::kVerse, "verse");
			const auto chorus = common::makePart(common::PartType::kChorus, "chorus");
			auto       lyric  = lyricWithTiming<Lyric>(common::TimingLevel::kLine);
			lyric.lines       = {
				textLine<Line>("a1", common::makeTimeRange(0, 1000)),
				textLine<Line>("a2", common::makeTimeRange(0, 3000)),
				textLine<Line>("b1", common::makeTimeRange(0, 2000)),
			};
			lyric.lines[0].part                     = verse;
			lyric.lines[1].part                     = verse;
			lyric.lines[2].part                     = chorus;
			const std::vector<std::string> expected = {"a1", "a2", "b1"};
			expectDiagnostics(validateLyric(lyric), {});
			const auto ordered = orderLyric(lyric);
			expectEqual(lineIds(ordered.lines), expected, "Equal starts must not reorder by end and split a part run");
			expectDiagnostics(validateLyric(ordered), {});
		}

		void equalStartParts() {
			equalStartPartsFor<document::Lyric>();
			equalStartPartsFor<enriched::Lyric>();
		}

		template <typename Line>
		void stableBackgroundsFor() {
			auto line = textLine<Line>("lead", common::makeTimeRange(0, 1000));
			for (const auto& [id, end] : std::initializer_list<std::pair<std::string, std::int64_t>>{
				     {"long", 800},
				     {"short", 300},
				     {"empty", 100},
			     }) {
				line.backgrounds.emplace_back();
				auto& background = line.backgrounds.back();
				background.id    = id;
				background.time  = common::makeTimeRange(100, end);
				background.content.emplace();
				background.content->text = id;
			}
			const std::vector<std::string> expected = {"long", "short", "empty"};
			expectEqual(lineIds(orderLineBackgrounds(line).backgrounds), expected, "Equal-start backgrounds retain source order regardless of end");
			expectEqual(lineIds(canonicalizeLine(line).backgrounds), expected, "Canonicalization retains equal-start background order");
			expectDiagnostics(validateLine(line, {}, common::TimingLevel::kLine), {});
		}

		void stableBackgrounds() {
			stableBackgroundsFor<document::Line>();
			stableBackgroundsFor<enriched::Line>();
		}

		void usageOrder() {
			const std::vector<enriched::LanguageUsage> usages   = {{"Zh", 1}, {"en", 3}, {"ja", 1}, {"JA", 1}, {"und", 0}};
			const std::vector<enriched::LanguageUsage> expected = {{"en", 3}, {"ja", 1}, {"JA", 1}, {"Zh", 1}, {"und", 0}};
			expectEqual(enriched::orderLanguageUsages(usages), expected, "Language usage ordering uses descending counts then case-insensitive tags");
		}
	} // namespace

	int orderTests() {
		return runCases({
			{"timeline ordering keeps unusable ranges last", stableTimeline},
			{"equal starts preserve contiguous part identity", equalStartParts},
			{"background ordering preserves equal starts", stableBackgrounds},
			{"language usages sort by count and normalized tag", usageOrder},
		});
	}
} // namespace gondola::lyrics::model::test
