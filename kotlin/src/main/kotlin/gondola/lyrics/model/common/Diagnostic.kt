@file:JvmName("DiagnosticHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.readField

/**
 * An error code `validate*` can report.
 */
enum class DiagnosticCode(val value: String) {
    TextTextEmpty("text.text.empty"),
    TextTokenExtraKeyEmpty("text.token.extra.key.empty"),
    TimeRangeEndBeforeStart("time.range.end.before_start"),
    TimeRangeStartInvalid("time.range.start.invalid"),
    TimeRangeEndInvalid("time.range.end.invalid"),
    TimeRangeStartOverflow("time.range.start.overflow"),
    TimeRangeEndOverflow("time.range.end.overflow"),
    WordTypeUnspecified("word.type.unspecified"),
    WordTextEmpty("word.text.empty"),
    WordTextSeparator("word.text.separator"),
    WordTextNotSeparator("word.text.not_separator"),
    AgentIdEmpty("agent.id.empty"),
    AgentRawMissing("agent.raw.missing"),
    AgentTypeUnspecified("agent.type.unspecified"),
    AgentNamesLanguageDuplicate("agent.names.language.duplicate"),
    PartRawMissing("part.raw.missing"),
    PartTypeUnspecified("part.type.unspecified"),
    MetaCreditRawMissing("meta.credit.raw.missing"),
    MetaCreditRoleUnspecified("meta.credit.role.unspecified"),
    MetaOffsetInvalid("meta.offset.invalid"),
    MetaOffsetOverflow("meta.offset.overflow"),
    MetaDurationInvalid("meta.duration.invalid"),
    MetaDurationOverflow("meta.duration.overflow"),
    MetaIsrcsMalformed("meta.isrcs.malformed"),
    MetaTitlesLanguageDuplicate("meta.titles.language.duplicate"),
    MetaAlbumsLanguageDuplicate("meta.albums.language.duplicate"),
    MetaReferencesPlatformDuplicate("meta.references.platform.duplicate"),
    MetaReferencePlatformEmpty("meta.reference.platform.empty"),
    MetaReferenceIdsEmpty("meta.reference.ids.empty"),
    LanguageUsageTagEmpty("language.usage.tag.empty"),
    LanguageTagMalformed("language.tag.malformed"),
    LanguageUsageLineCountInvalid("language.usage.line_count.invalid"),
    LanguageUsageLineCountOverflow("language.usage.line_count.overflow"),
    LineTypeUnspecified("line.type.unspecified"),
    LineTimeMissing("line.time.missing"),
    LineTimeEndMissing("line.time.end.missing"),
    LineTimeEmpty("line.time.empty"),
    LineBackgroundsUnordered("line.backgrounds.unordered"),
    LineAgentIdsUnexpected("line.agent_ids.unexpected"),
    LineLanguagesUnexpected("line.languages.unexpected"),
    LineLanguagesDuplicate("line.languages.duplicate"),
    LineAnnotationUnexpected("line.annotation.unexpected"),
    LineAnnotationRomansDuplicate("line.annotation.romans.duplicate"),
    LineAnnotationRomansConflict("line.annotation.romans.conflict"),
    LineAnnotationRomanContentMissing("line.annotation.roman.content.missing"),
    LineAnnotationRomanContentAmbiguous("line.annotation.roman.content.ambiguous"),
    LineAnnotationRomanContentTextEmpty("line.annotation.roman.content.text.empty"),
    LineAnnotationRomanContentTokensTimeMissing("line.annotation.roman.content.tokens.time.missing"),
    LineAnnotationRomanTokenTextEmpty("line.annotation.roman.token.text.empty"),
    LineAnnotationRomanTimeUncovered("line.annotation.roman.time.uncovered"),
    LineAnnotationTranslationsLanguageDuplicate("line.annotation.translations.language.duplicate"),
    LineBackgroundsUnexpected("line.backgrounds.unexpected"),
    LineBackgroundsTimeUncovered("line.backgrounds.time.uncovered"),
    LineContentMissing("line.content.missing"),
    LineContentAmbiguous("line.content.ambiguous"),
    LineContentUnexpected("line.content.unexpected"),
    LineContentTextEmpty("line.content.text.empty"),
    LineWordTimeMissing("line.word.time.missing"),
    LineWordTimeUncovered("line.word.time.uncovered"),
    LineWordTimeUnexpected("line.word.time.unexpected"),
    LineWordLanguageUnexpected("line.word.language.unexpected"),
    LineWordAnnotationUnexpected("line.word.annotation.unexpected"),
    LineWordAnnotationTimeUncovered("line.word.annotation.time.uncovered"),
    LineWordAnnotationRubiesDuplicate("line.word.annotation.rubies.duplicate"),
    LineWordAnnotationRomansDuplicate("line.word.annotation.romans.duplicate"),
    LineWordAnnotationTranslationsLanguageDuplicate("line.word.annotation.translations.language.duplicate"),
    LineWordEmphasisUnexpected("line.word.emphasis.unexpected"),
    LineWordEmphasisValueMissing("line.word.emphasis.value.missing"),
    LyricVersionMalformed("lyric.version.malformed"),
    LyricStatusUnspecified("lyric.status.unspecified"),
    LyricTimingUnspecified("lyric.timing.unspecified"),
    LyricAgentIdDuplicate("lyric.agent.id.duplicate"),
    LyricLineAgentDangling("lyric.line.agent.dangling"),
    LyricLineIdDuplicate("lyric.line.id.duplicate"),
    LyricPartMismatch("lyric.part.mismatch"),
    LyricPartIdReused("lyric.part.id.reused"),
    LyricLineTimeEndMissing("lyric.line.time.end.missing"),
    LyricLinesUnordered("lyric.lines.unordered"),
    LyricLanguageUsagesTagDuplicate("lyric.language_usages.tag.duplicate"),
    LyricLanguageUsagesMismatch("lyric.language_usages.mismatch"),
    LyricListEntryEmpty("lyric.list.entry.empty"),
    LyricTimingNonePresent("lyric.timing.none.present"),
    LyricTimingNoneWords("lyric.timing.none.words"),
    LyricTimingNoneInstrumental("lyric.timing.none.instrumental"),
    LyricTimingLineWords("lyric.timing.line.words"),
    LyricTimingLineTimeMissing("lyric.timing.line.time_missing"),
    LyricTimingWordMissing("lyric.timing.word.missing"),
    ;

    /**
     * Returns the diagnostic's portable string code.
     */
    override fun toString(): String {
        return value
    }
}

/**
 * A problem `validate*` reports, with `path` locating the offending message such as `lines[3].words[0]` and `code` naming the broken rule.
 */
data class Diagnostic(val path: String, val code: DiagnosticCode)

private val PATH_SEGMENT = Regex("""^([${'$'}A-Za-z_][${'$'}\w]*)(?:\[(\d+)\])?$""")

/**
 * Resolves a diagnostic path against the node it was reported from, returning the value located there.
 * The path locates by field name and list index only, each segment `field` or `field[n]` joined by dots, as `validate*` builds it.
 * It returns null when a segment names an unset field or runs past a list, so a diagnostic about an absent field yields null there.
 *
 * Generated structures, maps, and diagnostics are supported; enum fields return their raw numbers.
 */
fun resolveDiagnosticPath(root: Any?, path: String): Any? {
    if (path.isEmpty()) {
        return root
    }
    var node = root
    for (segment in path.split('.')) {
        // A field is named by the identifier the generated code gives it, which is the schema's own name in lower camel case, so a name of more than one word resolves like any other.
        val match = PATH_SEGMENT.matchEntire(segment) ?: return null
        val name = match.groupValues[1]
        node = when (val current = node) {
            is Map<*, *> -> current[name]

            is Diagnostic -> when (name) {
                "path" -> current.path
                "code" -> current.code
                else -> null
            }

            else -> current?.let { readField(it, name) }
        }
        val index = match.groups[2]?.value
        if (index != null) {
            val position = index.toIntOrNull() ?: return null
            node = (node as? List<*>)?.getOrNull(position)
        }
    }
    return node
}
