#include <limits>

#include "test.hpp"

namespace gondola::lyrics::model::test {
	namespace {
		void languageTagSyntax() {
			for (std::string_view tag : {
				     "en",
				     "EN",
				     "und",
				     "qqq",
				     "abcd",
				     "abcde",
				     "abcdefgh",
				     "en-US",
				     "es-419",
				     "zh-Hans-CN",
				     "zh-cmn-Hans-CN",
				     "en-aaa-bbb-ccc-Latn-US",
				     "de-CH-1901",
				     "sl-rozaj-biske-1994",
				     "en-1abc",
				     "en-variant1-variant2",
				     "en-u-ca-gregory",
				     "en-0-ab",
				     "en-a-foo-b-bar",
				     "en-a-Latn-US",
				     "en-1901-1901",
				     "en-a-foo-a-bar",
				     "en-u-ca-gregory-ca-buddhist",
				     "x-acme",
				     "X-Acme",
				     "x-a",
				     "x-1",
				     "x-a-a",
				     "x-12345678",
				     "en-x-acme",
				     "en-x-US-GB",
				     "en-x-a-a",
				     "en-x-x",
				     "en-a-foo-x-a",
				     "zh-Hans-CN-x-demo",
				     "en-x-12345678-12345678-12345678-12345678",
				     "en-GB-oed",
				     "i-ami",
				     "i-bnn",
				     "i-default",
				     "i-enochian",
				     "i-hak",
				     "i-klingon",
				     "i-lux",
				     "i-mingo",
				     "i-navajo",
				     "i-pwn",
				     "i-tao",
				     "i-tay",
				     "i-tsu",
				     "sgn-BE-FR",
				     "sgn-BE-NL",
				     "sgn-CH-DE",
				     "art-lojban",
				     "cel-gaulish",
				     "no-bok",
				     "no-nyn",
				     "zh-guoyu",
				     "zh-hakka",
				     "zh-min",
				     "zh-min-nan",
				     "zh-xiang",
			     }) {
				expect(common::isWellFormedLanguageTag(tag), tag);
			}
			for (std::string_view tag : {
				     "",
				     "a",
				     "abcdefghi",
				     "123",
				     "en_US",
				     " en",
				     "en ",
				     "en\n",
				     "en\t",
				     "en\r",
				     "-en",
				     "en-",
				     "en--US",
				     "en-abcdefghi",
				     "x",
				     "x-",
				     "x--a",
				     "x-123456789",
				     "i",
				     "i-test",
				     "i-klingon-extra",
				     "en-GB-oed-x-extra",
				     "sgn-BE-FR-x-extra",
				     "en-US-GB",
				     "en-Latn-Hans",
				     "en-US-Latn",
				     "en-1901-US",
				     "abcd-efg",
				     "en-aaa-bbb-ccc-ddd",
				     "en-12",
				     "en-1ab",
				     "en-a",
				     "en-a-b-foo",
				     "en-a-x-test",
				     "en-a-1",
				     "en-a-123456789",
				     "en-a-foo-b",
				     "en-x",
				     "en-x-",
				     "\xe2\x84\xaa"
				     "a",
				     "en-\xc4\xb0N",
				     "en-\xef\xbc\xb5\xef\xbc\xb3",
			     }) {
				expect(!common::isWellFormedLanguageTag(tag), tag);
			}
			expect(!common::isWellFormedLanguageTag(std::string_view("en\0", 3)), "Embedded NUL is not part of a language tag");
		}

		void nestedLanguageDiagnostics() {
			for (const auto& [tag, accepted] : std::initializer_list<std::pair<std::string_view, bool>>{
				     {"x-acme", true},
				     {"i-klingon", true},
				     {"en-a", false},
				     {"en-US-GB", false},
			     }) {
				common::Meta meta;
				meta.titles   = {common::makeText(std::string(tag), "Song")};
				auto document = lyricWithTiming<document::Lyric>(common::TimingLevel::kNone);
				auto enriched = lyricWithTiming<enriched::Lyric>(common::TimingLevel::kNone);
				document.meta = meta;
				enriched.meta = meta;
				if (accepted) {
					expectDiagnostics(document::validateLyric(document), {});
					expectDiagnostics(enriched::validateLyric(enriched), {});
				} else {
					expectDiagnostics(document::validateLyric(document), {{"meta.titles[0].language", "language.tag.malformed"}});
					expectDiagnostics(enriched::validateLyric(enriched), {{"meta.titles[0].language", "language.tag.malformed"}});
				}
			}
		}

		void timeRangesAndOffsetOverflow() {
			const auto open   = common::makeTimeRange(1000);
			const auto closed = common::makeTimeRange(1000, 2000);
			const auto zero   = common::makeTimeRange(1000, 1000);
			expect(!common::getTimeRangeDuration(open), "An open range has no duration");
			expectEqual(common::getTimeRangeDuration(closed), std::optional<std::int64_t>{1000}, "Closed range duration must use both boundaries");
			expectEqual(common::getTimeRangeDuration(common::makeTimeRange(2000, 1000)), std::optional<std::int64_t>{-1000}, "Reversed range duration remains signed");
			expect(common::isTimeInTimeRange(open, 100000), "Open range remains active after its start");
			expect(!common::isTimeInTimeRange(open, 999), "Range excludes time before its start");
			expect(common::isTimeInTimeRange(closed, 1000), "Closed range includes its start");
			expect(!common::isTimeInTimeRange(closed, 2000), "Closed range excludes its end");
			expect(!common::isTimeInTimeRange(zero, 1000), "A zero-length range has no active instant");
			expectEqual(common::getTimeRangeProgress(closed, 1500), std::optional{0.5}, "Closed range progress must interpolate");
			expectEqual(common::getTimeRangeProgress(closed, 500), std::optional{0.0}, "Progress clamps below the start");
			expectEqual(common::getTimeRangeProgress(closed, 2500), std::optional{1.0}, "Progress clamps beyond the end");
			expectEqual(common::getTimeRangeProgress(zero, 1000), std::optional{1.0}, "Zero-length progress reaches one at its start");
			expect(!common::getTimeRangeProgress(open, 1500), "Progress is absent for an open range");
			expectEqual(common::applyTimeOffset(1000, 250), std::int64_t{1250}, "Positive offset adds to the playback clock");
			expectEqual(common::removeTimeOffset(100, 250), std::int64_t{-150}, "Removing offset may produce a negative clock");
			expectEqual(common::removeTimeOffset(common::applyTimeOffset(-1000, -250), -250), std::int64_t{-1000}, "Offset operations must be inverse");
			expectThrows<std::overflow_error>([] { (void)common::applyTimeOffset(std::numeric_limits<std::int64_t>::max(), 1); },
				"Offset addition must detect overflow");
			expectThrows<std::overflow_error>([] { (void)common::applyTimeOffset(std::numeric_limits<std::int64_t>::min(), -1); },
				"Offset addition must detect underflow");
			expectThrows<std::overflow_error>([] { (void)common::removeTimeOffset(std::numeric_limits<std::int64_t>::min(), 1); },
				"Offset removal must detect underflow");
			expectThrows<std::out_of_range>([] { (void)common::makeTimeRange(-1); }, "Time constructor must reject a negative start");
			expectThrows<std::out_of_range>([] { (void)common::makeTimeRange(0, 4294967296LL); }, "Time constructor must reject a value beyond uint32");
			expectDiagnostics(common::validateTimeRange(common::makeTimeRange(4294967295LL, 0), "time"), {{"time", "time.range.start.overflow"}});
			expectDiagnostics(common::validateTimeRange(common::makeTimeRange(2000, 1000), "time"), {{"time", "time.range.end.before_start"}});
		}

		void unicodeWordSeparators() {
			for (std::string_view separator : {"\xc2\x85", "\xc2\xa0", "\xe2\x80\x87", "\xe2\x80\xaf", "\xe3\x80\x80"}) {
				expectDiagnostics(document::validateWord(document::makeWordSpace(std::string(separator))), {});
				expectDiagnostics(enriched::validateWord(enriched::makeWordSpace(std::string(separator))), {});
				const auto text = std::string("a") + std::string(separator) + "b";
				expectDiagnostics(document::validateWord(document::makeWordNormal(std::nullopt, std::nullopt, text), {}, common::TimingLevel::kLine),
					{{"text", "word.text.separator"}});
				expectDiagnostics(enriched::validateWord(enriched::makeWordNormal(std::nullopt, std::nullopt, text), {}, common::TimingLevel::kLine),
					{{"text", "word.text.separator"}});
			}
			const std::string zeroWidthSpace = "\xe2\x80\x8b";
			expectDiagnostics(document::validateWord(document::makeWordNormal(std::nullopt, std::nullopt, "a" + zeroWidthSpace + "b"), {}, common::TimingLevel::kLine),
				{});
			expectDiagnostics(enriched::validateWord(enriched::makeWordNormal(std::nullopt, std::nullopt, "a" + zeroWidthSpace + "b"), {}, common::TimingLevel::kLine),
				{});
			expectDiagnostics(document::validateWord(document::makeWordSpace(zeroWidthSpace)), {{"text", "word.text.not_separator"}});
			expectDiagnostics(enriched::validateWord(enriched::makeWordSpace(zeroWidthSpace)), {{"text", "word.text.not_separator"}});
		}
	} // namespace

	int commonTests() {
		return runCases({
			{"language tags follow RFC 5646 syntax", languageTagSyntax},
			{"nested language errors have shared diagnostic paths", nestedLanguageDiagnostics},
			{"time ranges and offset operations preserve their boundaries", timeRangesAndOffsetOverflow},
			{"word separators use Unicode White_Space", unicodeWordSeparators},
		});
	}
} // namespace gondola::lyrics::model::test
