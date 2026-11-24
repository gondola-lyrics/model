#include "test.hpp"

namespace gondola::lyrics::model::test {
	namespace {
		void languagePreferenceOrder() {
			const std::vector<common::Text> texts = {
				common::makeText(std::nullopt, "default"),
				common::makeText("en", "English"),
				common::makeText("zh-TW", "Chinese"),
			};
			expect(common::pickItemByLanguage(texts, {"zh", "en"}) == &texts[2], "Earlier preferences must take priority");
			expect(common::pickItemByLanguage(texts, {"en", "zh"}) == &texts[1], "Language order must affect selection");
			expect(common::pickItemByLanguage(texts, {"", "fr", "EN"}) == &texts[1], "Empty and unmatched preferences must not select the default early");
			expect(common::pickItemByLanguage(texts, {"fr", "de"}) == &texts[0], "Default fallback happens after all preferences fail");
			const std::vector<common::Text> ranked = {
				common::makeText("en", "generic"),
				common::makeText("en-US-x-demo", "extended"),
				common::makeText("en-US", "regional"),
				common::makeText("EN-us", "tied"),
			};
			expect(common::pickItemByLanguage(ranked, "EN-us") == &ranked[2], "Exact language must outrank extensions and preserve ties");
			expect(common::pickItemByLanguage(ranked, "en-US-x-other") == &ranked[2], "Matching must respect subtag boundaries");
			expect(common::pickItemByLanguage(ranked, "fr") == nullptr, "Missing preference without default must not force a match");
			expect(common::pickItemByLanguage(ranked, "fr", true) == &ranked[0], "Explicit fallback selects the first item");
			const std::vector<common::Text> unrelated = {common::makeText("jav", "other")};
			expect(common::pickItemByLanguage(unrelated, "ja") == nullptr, "A language prefix is not a subtag match");
		}

		template <typename Roman>
		void schemePreferenceFor() {
			const std::vector<Roman> items = {
				Roman{std::nullopt, "ja-Latn", "kunrei", {}},
				Roman{std::nullopt, "ja-Latn", std::nullopt, {}},
				Roman{std::nullopt, "ja-Latn", "", {}},
				Roman{std::nullopt, "ja-Latn", "HePbUrN", {}},
				Roman{std::nullopt, "en", "hepburn", {}},
				Roman{std::nullopt, std::nullopt, "hepburn", {}},
			};
			expect(common::pickItemByScheme(items, {std::nullopt, {"ja-Latn"}, false}) == &items[0], "Unset scheme permits all schemes");
			expect(common::pickItemByScheme(items, {"", {"ja-Latn"}, false}) == &items[1], "Empty scheme selects the first unspecified scheme");
			expect(common::pickItemByScheme(items, {"HEPBURN", {"zh", "en"}, false}) == &items[4], "Language preferences apply inside the scheme filter");
			expect(common::pickItemByScheme(items, {"hepburn", {"ja", "en"}, false}) == &items[3], "Scheme matching ignores ASCII case");
			expect(common::pickItemByScheme(items, {"hepburn", {"fr"}, true}) == &items[5], "Untagged fallback must stay inside the selected scheme");
			expect(common::pickItemByScheme(items, {"hepb", {"en"}, true}) == nullptr, "Scheme matching must be exact");
			expect(common::pickItemByScheme(items, {"missing", {}, true}) == nullptr, "First-item fallback cannot escape the scheme filter");
			const std::vector<Roman> noDefault = {items[0], items[4]};
			expect(common::pickItemByScheme(noDefault, {"hepburn", {"fr"}, false}) == nullptr, "No eligible language must return no selection");
			expect(common::pickItemByScheme(noDefault, {"hepburn", {"fr"}, true}) == &noDefault[1], "Explicit fallback uses the first eligible item");
		}

		void schemePreference() {
			schemePreferenceFor<document::WordAnnotationRoman>();
			schemePreferenceFor<enriched::WordAnnotationRoman>();
			schemePreferenceFor<document::WordAnnotationRuby>();
			schemePreferenceFor<enriched::WordAnnotationRuby>();
		}

		void nonAsciiSchemePreference() {
			const std::vector<document::WordAnnotationRoman> items = {{std::nullopt, "ja-Latn", u8"\u00c4-TEST", {}}};
			expect(common::pickItemByScheme(items, {u8"\u00c4-test", {"JA-latn"}, false}) == &items[0], "ASCII case matches within a non-ASCII scheme");
			expect(common::pickItemByScheme(items, {u8"\u00e4-test", {"JA-latn"}, true}) == nullptr, "Non-ASCII scheme characters remain distinct even with fallback");
		}

		template <typename Line>
		void resolveLanguagesFor() {
			Line line;
			line.languages = {"JA-JP", "ja-jp", "EN"};
			expectEqual(resolveLineLanguages(line), std::vector<std::string>{"ja-jp", "en"}, "Declared languages must normalize without duplicates");
			expectEqual(line.languages, std::vector<std::string>{"JA-JP", "ja-jp", "EN"}, "Resolving must preserve source declarations");
			line.languages.clear();
			line.content.emplace();
			using Word = typename decltype(line.content->words)::value_type;
			Word first;
			first.type      = decltype(first.type)::kNormal;
			first.language  = "EN";
			Word second     = first;
			second.language = "en";
			Word space;
			space.type          = decltype(space.type)::kSpace;
			space.language      = "fr";
			line.content->words = {first, space, second};
			expectEqual(resolveLineLanguages(line), std::vector<std::string>{"en"}, "Fallback languages include normal words only");
		}

		void resolveLanguagesAndAgents() {
			resolveLanguagesFor<document::Line>();
			resolveLanguagesFor<enriched::Line>();
			const std::vector<common::Agent> agents = {
				common::makeAgent("", common::AgentType::kPerson),
				common::makeAgent("a", common::AgentType::kPerson, std::nullopt, {common::makeText(std::nullopt, "first")}),
				common::makeAgent("a", common::AgentType::kPerson, std::nullopt, {common::makeText(std::nullopt, "second")}),
			};
			const std::vector<std::string> references = {"", "a", "missing", "a"};
			const auto                     resolved   = common::resolveLineAgents(references, agents);
			expectEqual(resolved,
				std::vector<const common::Agent*>{&agents[1], &agents[1]},
				"Resolution must borrow the first non-empty matching agent in reference order");
		}
	} // namespace

	int helpersTests() {
		return runCases({
			{"language selection respects preference order and boundaries", languagePreferenceOrder},
			{"scheme selection limits both matching and fallback", schemePreference},
			{"scheme selection preserves non-ASCII characters", nonAsciiSchemePreference},
			{"language and agent resolution preserve source identity", resolveLanguagesAndAgents},
		});
	}
} // namespace gondola::lyrics::model::test
