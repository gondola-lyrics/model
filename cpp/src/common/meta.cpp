#include <algorithm>
#include <limits>
#include <stdexcept>
#include <utility>

#include <gondola/lyrics/model/common/meta.hpp>
#include <gondola/lyrics/model/common/text.hpp>

#include "utils/common.hpp"

namespace gondola::lyrics::model::common {
	namespace {

		bool is_resolved(CreditRole role) noexcept {
			switch (role) {
			case CreditRole::kOther:
			case CreditRole::kPerformer:
			case CreditRole::kSongwriter:
			case CreditRole::kLyricist:
			case CreditRole::kComposer:
			case CreditRole::kArranger:
			case CreditRole::kProducer:
			case CreditRole::kMixingEngineer:
			case CreditRole::kMasteringEngineer:
			case CreditRole::kRecordingEngineer:
				return true;
			default:
				return false;
			}
		}

		bool is_isrc_letter(char ch) noexcept {
			return ch >= 'A' && ch <= 'Z';
		}

		bool is_isrc_digit(char ch) noexcept {
			return ch >= '0' && ch <= '9';
		}

		std::string canonical_isrc(std::string_view value) {
			std::string result;
			for (const auto ch : value) {
				if (is_isrc_letter(ch) || is_isrc_digit(ch)) {
					result += ch;
				} else if (ch >= 'a' && ch <= 'z') {
					result += static_cast<char>(ch - ('a' - 'A'));
				}
			}
			return result;
		}

		bool has_isrc_shape(std::string_view value) {
			const auto isrc = canonical_isrc(value);
			if (isrc.size() != 12) {
				return false;
			}
			return std::all_of(isrc.begin(), isrc.begin() + 2, is_isrc_letter) && std::all_of(isrc.begin() + 5, isrc.end(), is_isrc_digit);
		}

		std::int64_t shift_time(std::int64_t time, std::int64_t delta) {
			if ((delta > 0 && time > std::numeric_limits<std::int64_t>::max() - delta) || (delta < 0 && time < std::numeric_limits<std::int64_t>::min() - delta)) {
				throw std::overflow_error("Adjusted time does not fit in int64");
			}
			return time + delta;
		}

	} // namespace

	Meta makeMeta(std::vector<UnknownEntry> unknowns,
		std::int64_t                    offset,
		std::optional<std::int64_t>     duration,
		std::optional<std::string>      language,
		std::vector<Text>               titles,
		std::vector<Text>               artists,
		std::vector<Text>               albums,
		std::vector<Text>               authors,
		std::vector<std::string>        isrcs,
		std::vector<MetaCredit>         credits,
		std::vector<MetaReference>      references) {
		if (offset < std::numeric_limits<std::int32_t>::min() || offset > std::numeric_limits<std::int32_t>::max()) {
			throw std::out_of_range("Offset must fit in sint32");
		}
		return {
			std::move(unknowns),
			static_cast<std::int32_t>(offset),
			duration ? std::optional{utils::require_uint32(*duration)} : std::nullopt,
			std::move(language),
			std::move(titles),
			std::move(artists),
			std::move(albums),
			std::move(authors),
			std::move(isrcs),
			std::move(credits),
			std::move(references),
		};
	}

	MetaCredit makeMetaCredit(CreditRole role, std::optional<std::string> raw, std::vector<Text> names) {
		return {role, std::move(raw), std::move(names)};
	}

	MetaReference makeMetaReference(std::string platform, std::vector<std::string> ids) {
		return {std::move(platform), std::move(ids)};
	}

	std::vector<Diagnostic> validateMetaCredit(const MetaCredit& credit, std::string_view path) {
		std::vector<Diagnostic> diagnostics;
		if (!is_resolved(credit.role)) {
			diagnostics.push_back({utils::child_path(path, "role"), DiagnosticCode::kMetaCreditRoleUnspecified});
		} else if (credit.role == CreditRole::kOther && !credit.raw) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kMetaCreditRawMissing});
		}
		utils::validate_entries(credit.names, validateText, path, "names", diagnostics);
		return diagnostics;
	}

	std::vector<Diagnostic> validateMetaReference(const MetaReference& reference, std::string_view path) {
		std::vector<Diagnostic> diagnostics;
		if (reference.platform.empty()) {
			diagnostics.push_back({utils::child_path(path, "platform"), DiagnosticCode::kMetaReferencePlatformEmpty});
		}
		if (reference.ids.empty()) {
			diagnostics.push_back({utils::child_path(path, "ids"), DiagnosticCode::kMetaReferenceIdsEmpty});
		}
		for (std::size_t index = 0; index < reference.ids.size(); ++index) {
			if (reference.ids[index].empty()) {
				diagnostics.push_back({utils::indexed_path(path, "ids", index), DiagnosticCode::kLyricListEntryEmpty});
			}
		}
		return diagnostics;
	}

	std::vector<Diagnostic> validateMeta(const Meta& meta, std::string_view path) {
		std::vector<Diagnostic> diagnostics;
		utils::validate_language(meta.language, path, diagnostics);
		if (meta.duration && *meta.duration > utils::kMaxTime) {
			diagnostics.push_back({utils::child_path(path, "duration"), DiagnosticCode::kMetaDurationOverflow});
		}

		const auto language_key = [](const Text& value) { return utils::language_key(value.language); };
		utils::report_duplicates(meta.titles, language_key, path, "titles", DiagnosticCode::kMetaTitlesLanguageDuplicate, diagnostics);
		utils::report_duplicates(meta.albums, language_key, path, "albums", DiagnosticCode::kMetaAlbumsLanguageDuplicate, diagnostics);
		utils::validate_entries(meta.titles, validateText, path, "titles", diagnostics);
		utils::validate_entries(meta.artists, validateText, path, "artists", diagnostics);
		utils::validate_entries(meta.albums, validateText, path, "albums", diagnostics);
		utils::validate_entries(meta.authors, validateText, path, "authors", diagnostics);

		for (std::size_t index = 0; index < meta.isrcs.size(); ++index) {
			const auto& isrc = meta.isrcs[index];
			if (!isrc.empty() && !has_isrc_shape(isrc)) {
				diagnostics.push_back({utils::indexed_path(path, "isrcs", index), DiagnosticCode::kMetaIsrcsMalformed});
			}
		}
		utils::validate_entries(meta.credits, validateMetaCredit, path, "credits", diagnostics);
		const auto platform_key = [](const MetaReference& value) { return utils::lowercase_ascii(value.platform); };
		utils::report_duplicates(meta.references, platform_key, path, "references", DiagnosticCode::kMetaReferencesPlatformDuplicate, diagnostics);
		utils::validate_entries(meta.references, validateMetaReference, path, "references", diagnostics);

		// The semantic checks already report the other all-default child entries.
		for (std::size_t index = 0; index < meta.unknowns.size(); ++index) {
			if (meta.unknowns[index] == UnknownEntry{}) {
				diagnostics.push_back({utils::indexed_path(path, "unknowns", index), DiagnosticCode::kLyricListEntryEmpty});
			}
		}
		for (std::size_t index = 0; index < meta.isrcs.size(); ++index) {
			if (meta.isrcs[index].empty()) {
				diagnostics.push_back({utils::indexed_path(path, "isrcs", index), DiagnosticCode::kLyricListEntryEmpty});
			}
		}
		return diagnostics;
	}

	MetaCredit canonicalizeMetaCredit(MetaCredit credit) {
		utils::canonicalize_entries(credit.names, canonicalizeText);
		return credit;
	}

	MetaReference canonicalizeMetaReference(MetaReference reference) {
		reference.platform = utils::lowercase_ascii(reference.platform);
		utils::erase_defaults(reference.ids);
		return reference;
	}

	Meta canonicalizeMeta(Meta meta) {
		utils::erase_defaults(meta.unknowns);
		utils::normalize_language(meta.language);
		utils::canonicalize_entries(meta.titles, canonicalizeText);
		utils::canonicalize_entries(meta.artists, canonicalizeText);
		utils::canonicalize_entries(meta.albums, canonicalizeText);
		utils::canonicalize_entries(meta.authors, canonicalizeText);
		utils::canonicalize_entries(meta.isrcs, canonical_isrc);
		utils::canonicalize_entries(meta.credits, canonicalizeMetaCredit);
		utils::canonicalize_entries(meta.references, canonicalizeMetaReference);
		return meta;
	}

	std::int64_t applyTimeOffset(std::int64_t clock, std::int32_t offset) {
		return shift_time(clock, offset);
	}

	std::int64_t removeTimeOffset(std::int64_t time, std::int32_t offset) {
		return shift_time(time, -static_cast<std::int64_t>(offset));
	}

} // namespace gondola::lyrics::model::common
