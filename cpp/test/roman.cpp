#include "test.hpp"

namespace gondola::lyrics::model::test {
	namespace {
		template <typename Line>
		void exclusiveContentFor() {
			Line line;
			line.annotation.emplace();
			line.annotation->romans.emplace_back();
			auto& roman = line.annotation->romans[0];
			expectDiagnostics(validateLineAnnotationRoman(roman), {{"content", "line.annotation.roman.content.missing"}});
			roman.content.emplace();
			roman.content->text = "";
			expectDiagnostics(validateLineAnnotationRoman(roman), {{"content.text", "line.annotation.roman.content.text.empty"}});
			roman.content->tokens = {common::makeTextToken(common::makeTimeRange(), "ni")};
			expectDiagnostics(validateLineAnnotationRoman(roman),
				{
					{"content", "line.annotation.roman.content.ambiguous"},
					{"content.text", "line.annotation.roman.content.text.empty"},
				});
			roman.content->text.reset();
			roman.content->tokens[0].time.reset();
			expectDiagnostics(validateLineAnnotationRoman(roman), {{"content.tokens", "line.annotation.roman.content.tokens.time.missing"}});
			roman.content->tokens[0].time = common::makeTimeRange();
			roman.content->tokens[0].text.clear();
			expectDiagnostics(validateLineAnnotationRoman(roman), {{"content.tokens[0].text", "line.annotation.roman.token.text.empty"}});
			roman.content->tokens[0].text = "ni";
			expectDiagnostics(validateLineAnnotationRoman(roman), {});
		}

		void exclusiveContent() {
			exclusiveContentFor<document::Line>();
			exclusiveContentFor<enriched::Line>();
		}

		template <typename Line>
		void independentTimingFor() {
			Line line;
			line.time = common::makeTimeRange(1000, 3000);
			line.annotation.emplace();
			line.annotation->romans.emplace_back();
			auto& roman = line.annotation->romans[0];
			roman.content.emplace();
			roman.content->tokens = {
				common::makeTextToken(common::makeTimeRange(900, 1800), "ni"),
				common::makeTextToken(std::nullopt, "  "),
				common::makeTextToken(common::makeTimeRange(2300), "hao"),
			};
			expectEqual(getLineAnnotationRomanText(roman), std::string("ni  hao"), "Roman fragments concatenate without changing source whitespace");
			expectEqual(resolveLineAnnotationRomanTime(roman, line), line.time, "Unset annotation range falls back to the line");
			expectDiagnostics(validateLineAnnotationRoman(roman), {});
			roman.time = common::makeTimeRange(900, 3500);
			expectEqual(resolveLineAnnotationRomanTime(roman, line), roman.time, "Explicit annotation range does not merge with the line");
			expectEqual(resolveLineAnnotationRomanTokenTime(roman.content->tokens[1], roman, line), roman.time, "Untimed fragments use the whole annotation range");
			expectEqual(resolveLineAnnotationRomanTokenTime(roman.content->tokens[2], roman, line),
				std::optional{common::makeTimeRange(2300)},
				"Timed fragments preserve unknown ends");
			expectDiagnostics(validateLineAnnotationRoman(roman), {{"content.tokens[2].time", "line.annotation.roman.time.uncovered"}});
			const auto canonical = canonicalizeLineAnnotationRoman(roman);
			expectEqual(canonical.content->tokens, roman.content->tokens, "Canonicalization must not fill or merge fragment timing");
		}

		void independentTiming() {
			independentTimingFor<document::Line>();
			independentTimingFor<enriched::Line>();
		}

		template <typename Line>
		void derivedViewsFor() {
			Line line;
			line.content.emplace();
			using Word       = typename decltype(line.content->words)::value_type;
			using Annotation = typename decltype(Word{}.annotation)::value_type;
			Annotation first;
			Annotation last;
			for (const auto& [scheme, text] : std::initializer_list<std::pair<std::optional<std::string>, std::string>>{
				     {"HEPBURN", "shi"},
				     {"kunrei", "si"},
				     {std::nullopt, "default"},
			     }) {
				first.romans.emplace_back();
				first.romans.back().language = "JA-Latn";
				first.romans.back().scheme   = scheme;
				first.romans.back().tokens   = {common::makeTextToken(std::nullopt, text)};
			}
			for (const auto& [scheme, text] : std::initializer_list<std::pair<std::optional<std::string>, std::string>>{
				     {"KUNREI", "ti"},
				     {"hepburn", "chi"},
				     {"", "text"},
			     }) {
				last.romans.emplace_back();
				last.romans.back().language = "ja-latn";
				last.romans.back().scheme   = scheme;
				last.romans.back().tokens   = {common::makeTextToken(std::nullopt, text)};
			}
			Word lead;
			lead.type       = decltype(lead.type)::kNormal;
			lead.text       = "x";
			lead.annotation = first;
			Word tail       = lead;
			tail.text       = "y";
			tail.annotation = last;
			Word omitted    = lead;
			omitted.text    = "omitted";
			omitted.annotation.reset();
			Word space;
			space.type          = decltype(space.type)::kSpace;
			space.text          = "  ";
			line.content->words = {space, lead, space, omitted, tail, space};
			const auto views    = deriveLineRomanViews(*line.content);
			expectEqual(views.size(), std::size_t{3}, "Each distinct language and scheme gets its own view");
			const std::vector<std::string>                texts   = {"shi chi", "si ti", "default text"};
			const std::vector<std::optional<std::string>> schemes = {"hepburn", "kunrei", std::nullopt};
			for (std::size_t index = 0; index < views.size(); ++index) {
				expectEqual(views[index].language, std::optional<std::string>{"ja-latn"}, "Derived view language is normalized");
				expectEqual(views[index].scheme, schemes[index], "Derived scheme order follows first appearance");
				expectEqual(views[index].text, texts[index], "Source separator runs become one display space between contributions");
			}
		}

		void derivedViews() {
			derivedViewsFor<document::Line>();
			derivedViewsFor<enriched::Line>();
		}

		template <typename Line>
		void lineWordPlacementFor() {
			auto line = textLine<Line>("lead");
			line.content->text.reset();
			line.content->words.emplace_back();
			auto& word = line.content->words[0];
			word.type  = decltype(word.type)::kNormal;
			word.text  = "x";
			word.time  = common::makeTimeRange();
			word.annotation.emplace();
			word.annotation->romans.emplace_back();
			word.annotation->romans[0].language = "JA-Latn";
			word.annotation->romans[0].scheme   = "HEPBURN";
			word.annotation->romans[0].tokens   = {common::makeTextToken(std::nullopt, "shi")};
			line.annotation.emplace();
			line.annotation->romans.emplace_back();
			auto& roman    = line.annotation->romans[0];
			roman.language = "ja-latn";
			roman.scheme   = "hepburn";
			roman.content.emplace();
			roman.content->text = "shi";
			expectDiagnostics(validateLine(line), {{"annotation.romans[0]", "line.annotation.romans.conflict"}});
			roman.scheme = "kunrei";
			expectDiagnostics(validateLine(line), {});
		}

		void lineWordPlacement() {
			lineWordPlacementFor<document::Line>();
			lineWordPlacementFor<enriched::Line>();
		}
	} // namespace

	int romanTests() {
		return runCases({
			{"roman content requires one non-empty representation and timing anchor", exclusiveContent},
			{"roman timing stays independent and preserves unknown ends", independentTiming},
			{"roman views preserve schemes and display spacing", derivedViews},
			{"line and word roman variants cannot claim the same key", lineWordPlacement},
		});
	}
} // namespace gondola::lyrics::model::test
