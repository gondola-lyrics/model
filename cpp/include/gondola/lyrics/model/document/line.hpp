#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/common/roman.hpp>
#include <gondola/lyrics/model/generated/common/agent.gen.hpp>
#include <gondola/lyrics/model/generated/document/line.gen.hpp>

namespace gondola::lyrics::model::document {
	/**
	 * Preserves source romanization fragments without adding whole-line text.
	 */
	[[nodiscard]] LineAnnotationRomanContent makeLineAnnotationRomanContentTokens(std::vector<common::TextToken> tokens);

	/**
	 * Preserves whole-line romanization text without adding timed fragments.
	 */
	[[nodiscard]] LineAnnotationRomanContent makeLineAnnotationRomanContentText(std::string text);

	/**
	 * Preserves romanization identifiers, timing, and content without normalization.
	 */
	[[nodiscard]] LineAnnotationRoman makeLineAnnotationRoman(std::optional<std::string> language = std::nullopt,
		std::optional<std::string>                                                   scheme   = std::nullopt,
		std::optional<common::TimeRange>                                             time     = std::nullopt,
		std::optional<LineAnnotationRomanContent>                                    content  = std::nullopt);

	/**
	 * Attaches translation text to the whole line without normalizing its language.
	 */
	[[nodiscard]] LineAnnotationTranslation makeLineAnnotationTranslation(std::optional<std::string> language = std::nullopt, std::string text = {});

	/**
	 * Preserves explicit line annotation lists without deriving word annotations.
	 */
	[[nodiscard]] LineAnnotation makeLineAnnotation(std::vector<LineAnnotationRoman> romans = {}, std::vector<LineAnnotationTranslation> translations = {});

	/**
	 * Preserves ordered words and leaves whole-line text unset.
	 */
	[[nodiscard]] LineContent makeLineContentWords(std::vector<Word> words);

	/**
	 * Preserves whole-line text, including explicit empty text, and leaves the word list empty.
	 */
	[[nodiscard]] LineContent makeLineContentText(std::string text);

	/**
	 * Fixes the normal line discriminator without normalizing supplied fields.
	 */
	[[nodiscard]] Line makeLineNormal(std::string id          = {},
		std::optional<common::TimeRange>      time        = std::nullopt,
		std::optional<common::Part>           part        = std::nullopt,
		std::vector<std::string>              agentIds    = {},
		std::vector<std::string>              languages   = {},
		std::vector<LineBackground>           backgrounds = {},
		std::optional<LineContent>            content     = std::nullopt,
		std::optional<LineAnnotation>         annotation  = std::nullopt);

	/**
	 * Fixes the instrumental discriminator and leaves fields forbidden on instrumental lines unset.
	 */
	[[nodiscard]] Line makeLineInstrumental(std::string id = {}, std::optional<common::TimeRange> time = std::nullopt, std::optional<common::Part> part = std::nullopt);

	/**
	 * Preserves background vocal fields without inferring timing from the owning line.
	 */
	[[nodiscard]] LineBackground makeLineBackground(std::string id         = {},
		std::optional<common::TimeRange>                    time       = std::nullopt,
		std::vector<std::string>                            agentIds   = {},
		std::vector<std::string>                            languages  = {},
		std::optional<LineContent>                          content    = std::nullopt,
		std::optional<LineAnnotation>                       annotation = std::nullopt);

	/**
	 * Uses explicit whole-line text even when empty, otherwise joins source words.
	 */
	[[nodiscard]] std::string getLineContentText(const LineContent& content);

	/**
	 * Uses explicit whole-line text or source words, returning empty text for unset content.
	 */
	[[nodiscard]] std::string getLineContentText(const std::optional<LineContent>& content);

	/**
	 * Checks for a non-empty word list without inferring the lyric timing level or checking for conflicting whole-line text.
	 */
	[[nodiscard]] bool hasLineWords(const Line& line) noexcept;

	/**
	 * Checks for a non-empty background word list without inferring the lyric timing level or checking for conflicting whole-line text.
	 */
	[[nodiscard]] bool hasLineWords(const LineBackground& line) noexcept;

	/**
	 * Returns distinct non-empty, ASCII-lowercased line languages in source order, using normal-word tags only when the declared list is empty.
	 */
	[[nodiscard]] std::vector<std::string> resolveLineLanguages(const Line& line);

	/**
	 * Returns distinct non-empty, ASCII-lowercased background languages in source order, using normal-word tags only when the declared list is empty.
	 */
	[[nodiscard]] std::vector<std::string> resolveLineLanguages(const LineBackground& line);

	/**
	 * Resolves case-sensitive agent references in order using the first agent with the matching non-empty id.
	 *
	 * Omits unknown and empty references and preserves repeated references as repeated pointers.
	 * Returned pointers borrow vector elements and remain valid only while those elements are alive and their pointers have not been invalidated.
	 */
	[[nodiscard]] std::vector<const common::Agent*> resolveLineAgents(const Line& line, const std::vector<common::Agent>& agents);

	/**
	 * Resolves case-sensitive background agent references in order using the first agent with the matching non-empty id.
	 *
	 * Omits unknown and empty references and preserves repeated references as repeated pointers.
	 * Returned pointers borrow vector elements and remain valid only while those elements are alive and their pointers have not been invalidated.
	 */
	[[nodiscard]] std::vector<const common::Agent*> resolveLineAgents(const LineBackground& line, const std::vector<common::Agent>& agents);

	/**
	 * Prevents borrowed agent pointers from referring to a temporary vector.
	 */
	std::vector<const common::Agent*> resolveLineAgents(const Line&, const std::vector<common::Agent>&&) = delete;

	/**
	 * Prevents borrowed background agent pointers from referring to a temporary vector.
	 */
	std::vector<const common::Agent*> resolveLineAgents(const LineBackground&, const std::vector<common::Agent>&&) = delete;

	/**
	 * Uses explicit romanization text even when empty, otherwise joins source fragments without separators; unset content returns empty text.
	 */
	[[nodiscard]] std::string getLineAnnotationRomanText(const LineAnnotationRoman& roman);

	/**
	 * Uses the whole romanization range, falling back to the line only when the range is unset.
	 *
	 * Preserves an unknown end and returns nullopt when both ranges are unset; the selected range is not validated.
	 */
	[[nodiscard]] std::optional<common::TimeRange> resolveLineAnnotationRomanTime(const LineAnnotationRoman& roman, const Line& line) noexcept;

	/**
	 * Uses the whole romanization range, falling back to the background only when the range is unset.
	 *
	 * Preserves an unknown end and returns nullopt when both ranges are unset; the selected range is not validated.
	 */
	[[nodiscard]] std::optional<common::TimeRange> resolveLineAnnotationRomanTime(const LineAnnotationRoman& roman, const LineBackground& line) noexcept;

	/**
	 * Uses the first present whole range in token, romanization, then owning line order.
	 *
	 * Preserves an unknown end and returns nullopt when all ranges are unset; the selected range is not validated.
	 */
	[[nodiscard]] std::optional<common::TimeRange> resolveLineAnnotationRomanTokenTime(const common::TextToken& token,
		const LineAnnotationRoman&                                                                          roman,
		const Line&                                                                                         line) noexcept;

	/**
	 * Uses the first present whole range in token, romanization, then background order.
	 *
	 * Preserves an unknown end and returns nullopt when all ranges are unset; the selected range is not validated.
	 */
	[[nodiscard]] std::optional<common::TimeRange> resolveLineAnnotationRomanTokenTime(const common::TextToken& token,
		const LineAnnotationRoman&                                                                          roman,
		const LineBackground&                                                                               line) noexcept;

	/**
	 * Aggregates display text by language and scheme in first appearance order, collapsing separator words to one space between contributions.
	 *
	 * Variant keys ignore ASCII case and treat empty identifiers as unset; views with empty text are omitted.
	 * Results own their strings, while timing and fragment boundaries remain on the original annotations.
	 */
	[[nodiscard]] std::vector<common::LineRomanView> deriveLineRomanViews(const LineContent& content);

	/**
	 * Aggregates word romanizations into display views, returning no views for unset content.
	 */
	[[nodiscard]] std::vector<common::LineRomanView> deriveLineRomanViews(const std::optional<LineContent>& content);

	/**
	 * Checks exclusive content, non-empty text, a token timing anchor, and containment within declared annotation timing.
	 *
	 * Explicit token times are independent of the original line when the annotation range is unset.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLineAnnotationRomanContent(const std::optional<LineAnnotationRomanContent>& content,
		std::string_view                                                                                                          path = {},
		const std::optional<common::TimeRange>&                                                                                   time = std::nullopt);

	/**
	 * Checks romanization content, language, and declared timing independently of the original line.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLineAnnotationRoman(const LineAnnotationRoman& roman, std::string_view path = {});

	/**
	 * Checks line annotation variants and reports duplicates before nested content diagnostics.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLineAnnotation(const LineAnnotation& annotation, std::string_view path = {});

	/**
	 * Checks exclusive source content and applies the supplied timing rules to words.
	 *
	 * NONE and LINE reject word lists; missing content is reported only when required is true.
	 * Word timing is compared with the enclosing range outside NONE and LINE timing.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLineContent(const std::optional<LineContent>& content,
		const std::optional<common::TimeRange>&                                                     time     = std::nullopt,
		std::string_view                                                                            path     = {},
		common::TimingLevel                                                                         timing   = common::TimingLevel::kUnspecified,
		bool                                                                                        required = true);

	/**
	 * Checks background fields and timing without requiring an explicit end.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLineBackground(const LineBackground& background,
		std::string_view                                                                   path   = {},
		common::TimingLevel                                                                timing = common::TimingLevel::kUnspecified);

	/**
	 * Checks line kind, permitted fields, timing, annotations, and backgrounds.
	 *
	 * Unresolved kinds may omit content; forbidden fields are reported without validating their contents.
	 */
	[[nodiscard]] std::vector<common::Diagnostic> validateLine(const Line& line, std::string_view path = {}, common::TimingLevel timing = common::TimingLevel::kUnspecified);

	/**
	 * Removes default romanization tokens while preserving source fragment order, text, and timing.
	 */
	[[nodiscard]] LineAnnotationRomanContent canonicalizeLineAnnotationRomanContent(LineAnnotationRomanContent content);

	/**
	 * Normalizes romanization identifiers and content without inferring missing timing boundaries.
	 */
	[[nodiscard]] LineAnnotationRoman canonicalizeLineAnnotationRoman(LineAnnotationRoman roman);

	/**
	 * Normalizes the language identifier while preserving whole-line translation text.
	 */
	[[nodiscard]] LineAnnotationTranslation canonicalizeLineAnnotationTranslation(LineAnnotationTranslation translation);

	/**
	 * Normalizes line annotations and removes default entries without merging variants.
	 */
	[[nodiscard]] LineAnnotation canonicalizeLineAnnotation(LineAnnotation annotation);

	/**
	 * Normalizes source words while preserving explicit whole-line text.
	 */
	[[nodiscard]] LineContent canonicalizeLineContent(LineContent content);

	/**
	 * Normalizes background languages and nested content, removing empty agent references and default fields.
	 */
	[[nodiscard]] LineBackground canonicalizeLineBackground(LineBackground background);

	/**
	 * Normalizes line fields and orders backgrounds without changing source timing or discriminators.
	 */
	[[nodiscard]] Line canonicalizeLine(Line line);

	/**
	 * Orders backgrounds stably by usable start times, leaving unset and invalid ranges at the end.
	 */
	[[nodiscard]] Line orderLineBackgrounds(Line line);
} // namespace gondola::lyrics::model::document
