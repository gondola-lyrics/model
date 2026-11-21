#include <gondola/lyrics/model/common/diagnostic.hpp>

namespace gondola::lyrics::model::common {

	std::string_view toString(DiagnosticCode code) noexcept {
		switch (code) {
		case DiagnosticCode::kAgentIdEmpty:
			return "agent.id.empty";
		case DiagnosticCode::kAgentNamesLanguageDuplicate:
			return "agent.names.language.duplicate";
		case DiagnosticCode::kAgentRawMissing:
			return "agent.raw.missing";
		case DiagnosticCode::kAgentTypeUnspecified:
			return "agent.type.unspecified";
		case DiagnosticCode::kLanguageTagMalformed:
			return "language.tag.malformed";
		case DiagnosticCode::kLyricListEntryEmpty:
			return "lyric.list.entry.empty";
		case DiagnosticCode::kMetaAlbumsLanguageDuplicate:
			return "meta.albums.language.duplicate";
		case DiagnosticCode::kMetaCreditRawMissing:
			return "meta.credit.raw.missing";
		case DiagnosticCode::kMetaCreditRoleUnspecified:
			return "meta.credit.role.unspecified";
		case DiagnosticCode::kMetaDurationOverflow:
			return "meta.duration.overflow";
		case DiagnosticCode::kMetaIsrcsMalformed:
			return "meta.isrcs.malformed";
		case DiagnosticCode::kMetaReferenceIdsEmpty:
			return "meta.reference.ids.empty";
		case DiagnosticCode::kMetaReferencePlatformEmpty:
			return "meta.reference.platform.empty";
		case DiagnosticCode::kMetaReferencesPlatformDuplicate:
			return "meta.references.platform.duplicate";
		case DiagnosticCode::kMetaTitlesLanguageDuplicate:
			return "meta.titles.language.duplicate";
		case DiagnosticCode::kPartRawMissing:
			return "part.raw.missing";
		case DiagnosticCode::kPartTypeUnspecified:
			return "part.type.unspecified";
		case DiagnosticCode::kTextTextEmpty:
			return "text.text.empty";
		case DiagnosticCode::kTextTokenExtraKeyEmpty:
			return "text.token.extra.key.empty";
		case DiagnosticCode::kTimeRangeEndBeforeStart:
			return "time.range.end.before_start";
		case DiagnosticCode::kTimeRangeEndOverflow:
			return "time.range.end.overflow";
		case DiagnosticCode::kTimeRangeStartOverflow:
			return "time.range.start.overflow";
		}
		return {};
	}

} // namespace gondola::lyrics::model::common
