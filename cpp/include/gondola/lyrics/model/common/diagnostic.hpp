#pragma once

#include <string>
#include <string_view>

namespace gondola::lyrics::model::common {

	enum class DiagnosticCode {
		kAgentIdEmpty,
		kAgentNamesLanguageDuplicate,
		kAgentRawMissing,
		kAgentTypeUnspecified,
		kLanguageTagMalformed,
		kLyricListEntryEmpty,
		kMetaAlbumsLanguageDuplicate,
		kMetaCreditRawMissing,
		kMetaCreditRoleUnspecified,
		kMetaDurationOverflow,
		kMetaIsrcsMalformed,
		kMetaReferenceIdsEmpty,
		kMetaReferencePlatformEmpty,
		kMetaReferencesPlatformDuplicate,
		kMetaTitlesLanguageDuplicate,
		kPartRawMissing,
		kPartTypeUnspecified,
		kTextTextEmpty,
		kTextTokenExtraKeyEmpty,
		kTimeRangeEndBeforeStart,
		kTimeRangeEndOverflow,
		kTimeRangeStartOverflow,
	};

	/**
 * Identifies a model violation relative to the input or the caller's path prefix.
 */
	struct Diagnostic {
		std::string    path;
		DiagnosticCode code;
	};

	/**
 * Returns the diagnostic identifier shared by the bindings.
 */
	[[nodiscard]] std::string_view toString(DiagnosticCode code) noexcept;

} // namespace gondola::lyrics::model::common
