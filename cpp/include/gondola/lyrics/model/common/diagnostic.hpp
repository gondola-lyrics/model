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
		kLanguageUsageTagEmpty,
		kLineAgentIdsUnexpected,
		kLineAnnotationRomanContentAmbiguous,
		kLineAnnotationRomanContentMissing,
		kLineAnnotationRomanContentTextEmpty,
		kLineAnnotationRomanContentTokensTimeMissing,
		kLineAnnotationRomansConflict,
		kLineAnnotationRomansDuplicate,
		kLineAnnotationRomanTimeUncovered,
		kLineAnnotationRomanTokenTextEmpty,
		kLineAnnotationTranslationsLanguageDuplicate,
		kLineAnnotationUnexpected,
		kLineBackgroundsTimeUncovered,
		kLineBackgroundsUnexpected,
		kLineBackgroundsUnordered,
		kLineContentAmbiguous,
		kLineContentMissing,
		kLineContentTextEmpty,
		kLineContentUnexpected,
		kLineLanguagesDuplicate,
		kLineLanguagesUnexpected,
		kLinePartInterludeNotInstrumental,
		kLineTimeEmpty,
		kLineTimeEndMissing,
		kLineTimeMissing,
		kLineTypeUnspecified,
		kLineWordAnnotationRomansDuplicate,
		kLineWordAnnotationRubiesDuplicate,
		kLineWordAnnotationTimeUncovered,
		kLineWordAnnotationTranslationsLanguageDuplicate,
		kLineWordAnnotationUnexpected,
		kLineWordEmphasisUnexpected,
		kLineWordEmphasisValueMissing,
		kLineWordLanguageUnexpected,
		kLineWordTimeMissing,
		kLineWordTimeUncovered,
		kLineWordTimeUnexpected,
		kLyricAgentIdDuplicate,
		kLyricLanguageUsagesMismatch,
		kLyricLanguageUsagesTagDuplicate,
		kLyricLineAgentDangling,
		kLyricLineIdDuplicate,
		kLyricLinesUnordered,
		kLyricLineTimeEndMissing,
		kLyricPartIdReused,
		kLyricPartInterludeTrailing,
		kLyricPartMismatch,
		kLyricStatusUnspecified,
		kLyricTimingLineTimeMissing,
		kLyricTimingLineWords,
		kLyricTimingNoneInstrumental,
		kLyricTimingNonePresent,
		kLyricTimingNoneWords,
		kLyricTimingUnspecified,
		kLyricTimingWordMissing,
		kLyricVersionMalformed,
		kWordTextEmpty,
		kWordTextNotSeparator,
		kWordTextSeparator,
		kWordTypeUnspecified,
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
