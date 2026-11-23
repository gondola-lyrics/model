#include "test.hpp"

namespace gondola::lyrics::model::test {
	namespace {
		std::string fromHex(std::string_view hex) {
			expect(hex.size() % 2 == 0, "Hex fixture has an incomplete byte");
			const auto nibble = [](char digit) {
				const auto value = std::string_view("0123456789abcdef").find(digit);
				expect(value != std::string_view::npos, "Hex fixture contains an invalid digit");
				return value;
			};
			std::string bytes;
			bytes.reserve(hex.size() / 2);
			for (std::size_t index = 0; index < hex.size(); index += 2) {
				bytes.push_back(static_cast<char>((nibble(hex[index]) << 4) | nibble(hex[index + 1])));
			}
			return bytes;
		}

		std::string groups(std::size_t count) {
			const auto  start = fromHex("a306");
			const auto  end   = fromHex("a406");
			std::string bytes;
			for (std::size_t index = 0; index < count; ++index) {
				bytes += start;
			}
			for (std::size_t index = 0; index < count; ++index) {
				bytes += end;
			}
			return bytes;
		}

		void roundTripsBothLayers() {
			auto document   = document::makeLyric("lrc", "source", common::TimingLevel::kWord);
			auto line       = document::makeLineNormal("lead", common::makeTimeRange(1000, 2000));
			auto word       = document::makeWordNormal(common::makeTimeRange(1000, 1500), "en", "hi", std::nullopt, false);
			word.annotation = document::makeWordAnnotation({},
				{document::makeWordAnnotationRoman(std::nullopt, "en-Latn", "source", {common::makeTextToken(std::nullopt, "hi", {{"source", "kept"}})})});
			line.content   = document::makeLineContentWords({word, document::makeWordSpace(" "), document::makeWordNormal(common::makeTimeRange(1500), "en", "there")});
			document.lines = {line};
			document.meta  = common::makeMeta({common::makeUnknownEntry("k", "first"), common::makeUnknownEntry("k", "second")}, -250, 0);
			document.extra = {{"format", "preserved"}};
			const auto documentBytes = document::encode(document);
			expect(documentBytes.has_value(), "Document sample must encode");
			expectEqual(document::decode(*documentBytes), std::optional{document}, "Document codec must preserve the nested sample");

			auto enriched            = enriched::makeLyric(enriched::LyricStatus::kValid, "lrc", "source", common::TimingLevel::kWord);
			auto enrichedLine        = enriched::makeLineNormal("lead", common::makeTimeRange(1000, 2000));
			enrichedLine.languages   = {"en"};
			enrichedLine.content     = enriched::makeLineContentWords({
				enriched::makeWordNormal(common::makeTimeRange(1000, 1500), "en", "hi", std::nullopt, enriched::makeWordEmphasis(false, false)),
				enriched::makeWordSpace(" "),
				enriched::makeWordNormal(common::makeTimeRange(1500), "en", "there"),
			});
			enriched.lines           = {enrichedLine};
			enriched.language_usages = enriched::deriveLanguageUsages(enriched.lines);
			enriched.meta            = document.meta;
			enriched.extra           = document.extra;
			const auto enrichedBytes = enriched::encode(enriched);
			expect(enrichedBytes.has_value(), "Enriched sample must encode");
			expectEqual(enriched::decode(*enrichedBytes), std::optional{enriched}, "Enriched codec must preserve the nested sample");
		}

		void preservesOptionalWireValues() {
			// The content bytes are the presence sample shared with the Kotlin codec tests, wrapped in a document lyric.
			const auto bytes   = fromHex("3a29100142250a090801120210002201610a0d0801120208051a0022016130000a07086322016130011200");
			const auto decoded = document::decode(bytes);
			expect(decoded && decoded->lines.size() == 1 && decoded->lines[0].content, "Presence fixture must decode its line");
			const auto& content = *decoded->lines[0].content;
			expectEqual(content.text, std::optional<std::string>{""}, "Explicit empty content text must remain present");
			expectEqual(content.words.size(), std::size_t{3}, "Presence fixture must contain three words");
			expect(content.words[0].time.has_value(), "Explicit zero end must retain its time message");
			expectEqual(content.words[0].time->end, std::optional<std::uint32_t>{0}, "Explicit zero end must remain present");
			expect(!content.words[0].emphasis, "Absent emphasis must remain absent");
			expect(content.words[1].time && !content.words[1].time->end, "Unknown end must remain absent");
			expectEqual(content.words[1].language, std::optional<std::string>{""}, "Explicit empty language must remain present");
			expectEqual(content.words[1].emphasis, std::optional{false}, "Explicit false emphasis must remain present");
			expectEqual(static_cast<std::int32_t>(content.words[2].type), 99, "Unknown enum values must survive decoding");
			expectEqual(document::encode(*decoded), std::optional{bytes}, "Presence fixture must encode to the reference bytes");

			const auto emphasis = enriched::decode(fromHex("420c100142080a06080132020800"));
			expect(emphasis && emphasis->lines.size() == 1 && emphasis->lines[0].content, "Enriched emphasis fixture must decode");
			expectEqual(emphasis->lines[0].content->words.size(), std::size_t{1}, "Enriched emphasis fixture must retain its word");
			const auto& emptyWord = emphasis->lines[0].content->words[0];
			expect(emptyWord.emphasis && emptyWord.emphasis->value == false, "Enriched false value must remain present");
		}

		void rejectsMalformedWireData() {
			const std::pair<std::string_view, std::string_view> malformed[] = {
				{"missing field value", "0a"},
				{"length beyond input", "0a05"},
				{"zero field number", "00"},
				{"invalid wire type", "0f"},
				{"tag beyond 32 bits", "8880808010"},
				{"varint beyond 64 bits", "08ffffffffffffffffff02"},
				{"unterminated varint", "08ffffffffffffffffffff"},
				{"stray end group", "0c"},
				{"mismatched end group", "a306ac06"},
				{"unterminated group", "a306"},
			};
			for (const auto& [reason, hex] : malformed) {
				const auto bytes = fromHex(hex);
				expect(!document::decode(bytes), reason);
				expect(!enriched::decode(bytes), reason);
			}
			expect(!document::decode(fromHex("2a020a7f")), "Document nested lengths must stay inside the containing message");
			expect(!enriched::decode(fromHex("32020a7f")), "Enriched nested lengths must stay inside the containing message");
		}

		void rejectsInvalidUtf8AndRetainsBom() {
			for (std::string_view hex : {"ff", "c080", "eda080", "f4908080"}) {
				const auto text          = fromHex(hex);
				const auto documentBytes = std::string("\x12", 1) + static_cast<char>(text.size()) + text;
				const auto enrichedBytes = std::string("\x1a", 1) + static_cast<char>(text.size()) + text;
				expect(!document::decode(documentBytes), "Document codec must reject invalid UTF-8");
				expect(!enriched::decode(enrichedBytes), "Enriched codec must reject invalid UTF-8");
				document::Lyric document;
				document.format = text;
				enriched::Lyric enriched;
				enriched.format = text;
				expect(!document::encode(document), "Document encoding must reject invalid UTF-8");
				expect(!enriched::encode(enriched), "Enriched encoding must reject invalid UTF-8");
			}
			const auto bytes   = fromHex("1a03efbbbf");
			const auto decoded = enriched::decode(bytes);
			expect(decoded.has_value(), "Leading UTF-8 BOM is valid source text");
			expectEqual(decoded->format, fromHex("efbbbf"), "Decoding must retain a leading BOM");
			expectEqual(enriched::encode(*decoded), std::optional{bytes}, "Encoding must retain a leading BOM");
		}

		void followsMergeAndSkippingRules() {
			const std::pair<std::string_view, std::string_view> accepted[] = {
				{"1001", ""},
				{"a2060161", ""},
				{"a3060801a406", ""},
				{"9280808080000161", "120161"},
				{"120161120162", "120162"},
				{"3202100232021807", "320410021807"},
				{"52030a0161", "52050a01611200"},
				{"5203120161", "52050a00120161"},
				{"52060a016112016252060a0161120163", "52060a0161120163"},
				{"28ffffffffffffffffff01", "28ffffffffffffffffff01"},
				{"2880808080808080808000", ""},
				{"320618ffffffff7f", "320618ffffffff0f"},
			};
			for (const auto& [input, expected] : accepted) {
				const auto decoded = enriched::decode(fromHex(input));
				expect(decoded.has_value(), input);
				expectEqual(enriched::encode(*decoded), std::optional{fromHex(expected)}, input);
			}
			expectEqual(enriched::decode(fromHex("a00601")), std::optional{enriched::Lyric{}}, "Unknown fields must be skipped");

			auto input = fromHex("32021002");
			for (int index = 0; index < 128; ++index) {
				input += fromHex("32050a030a016b");
			}
			input += fromHex("32021807");
			const auto decoded = enriched::decode(input);
			expect(decoded && decoded->meta, "Repeated metadata chunks must decode");
			expectEqual(decoded->meta->offset, 1, "Merge must retain fields from the first message chunk");
			expectEqual(decoded->meta->duration, std::optional<std::uint32_t>{7}, "Merge must retain fields from the last message chunk");
			expectEqual(decoded->meta->unknowns, std::vector<common::UnknownEntry>(128, common::makeUnknownEntry("k")), "Merge must append repeated entries");
		}

		void enforcesGroupDepth() {
			const auto allowed = groups(10001);
			expect(document::decode(allowed).has_value(), "Document maximum group depth must be accepted");
			expect(enriched::decode(allowed).has_value(), "Enriched maximum group depth must be accepted");
			const auto excessive = groups(10002);
			expect(!document::decode(excessive), "Document excessive group depth must be rejected");
			expect(!enriched::decode(excessive), "Enriched excessive group depth must be rejected");
		}
	} // namespace

	int codecTests() {
		return runCases({
			{"round trips both model layers", roundTripsBothLayers},
			{"preserves wire presence and unknown enum values", preservesOptionalWireValues},
			{"rejects malformed wire data", rejectsMalformedWireData},
			{"rejects invalid UTF-8 and retains a leading BOM", rejectsInvalidUtf8AndRetainsBom},
			{"follows message merge, map and unknown-field rules", followsMergeAndSkippingRules},
			{"enforces unknown group depth", enforcesGroupDepth},
		});
	}
} // namespace gondola::lyrics::model::test
