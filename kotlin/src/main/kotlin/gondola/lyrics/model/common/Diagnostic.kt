@file:JvmName("DiagnosticHelper")

package gondola.lyrics.model.common

import com.google.protobuf.Descriptors
import com.google.protobuf.Message
import gondola.lyrics.model.utils.unsigned

/**
 * Stable error codes shared with the Node binding.
 */
enum class DiagnosticCode(val value: String) {
    TextTextEmpty("text.text.empty"),
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
    LanguageUsageCountInvalid("language.usage.count.invalid"),
    LanguageUsageCountOverflow("language.usage.count.overflow"),
    LineTypeUnspecified("line.type.unspecified"),
    LineTimeMissing("line.time.missing"),
    LineTimeEndMissing("line.time.end.missing"),
    LineTimeEmpty("line.time.empty"),
    LineBackgroundsUnordered("line.backgrounds.unordered"),
    LineAgentsUnexpected("line.agents.unexpected"),
    LineLanguagesUnexpected("line.languages.unexpected"),
    LineLanguagesDuplicate("line.languages.duplicate"),
    LineAnnotationUnexpected("line.annotation.unexpected"),
    LineAnnotationRomansLanguageDuplicate("line.annotation.romans.language.duplicate"),
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
    LineWordAnnotationRubiesLanguageDuplicate("line.word.annotation.rubies.language.duplicate"),
    LineWordAnnotationRomansLanguageDuplicate("line.word.annotation.romans.language.duplicate"),
    LineWordAnnotationTranslationsLanguageDuplicate("line.word.annotation.translations.language.duplicate"),
    LineWordEmphasisUnexpected("line.word.emphasis.unexpected"),
    LyricVersionMalformed("lyric.version.malformed"),
    LyricStatusUnspecified("lyric.status.unspecified"),
    LyricTimingUnspecified("lyric.timing.unspecified"),
    LyricAgentIdDuplicate("lyric.agent.id.duplicate"),
    LyricLineAgentDangling("lyric.line.agent.dangling"),
    LyricLineIdDuplicate("lyric.line.id.duplicate"),
    LyricLineTimeEndMissing("lyric.line.time.end.missing"),
    LyricLinesUnordered("lyric.lines.unordered"),
    LyricLanguageTagDuplicate("lyric.language.tag.duplicate"),
    LyricLanguagesMismatch("lyric.languages.mismatch"),
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
    override fun toString(): String = value
}

/**
 * A broken schema rule and its path relative to the validated message.
 */
data class Diagnostic(val path: String, val code: DiagnosticCode)

private val PATH_SEGMENT = Regex("""^([${'$'}A-Za-z_][${'$'}\w]*)(?:\[(\d+)\])?$""")

private fun diagnosticValue(field: Descriptors.FieldDescriptor, value: Any): Any = when {
    value is Descriptors.EnumValueDescriptor -> value.number
    field.type == Descriptors.FieldDescriptor.Type.UINT32 -> unsigned(value as Int)
    else -> value
}

private fun messageField(message: Message, name: String): Any? {
    val field = message.descriptorForType.fields.find { it.jsonName == name } ?: return null
    if (field.isMapField) {
        val entries = message.getField(field) as List<*>
        return entries.associate { entry ->
            val messageEntry = entry as Message
            val key = messageEntry.descriptorForType.findFieldByName("key")
            val value = messageEntry.descriptorForType.findFieldByName("value")
            messageEntry.getField(key) to diagnosticValue(value, messageEntry.getField(value))
        }
    }
    if (field.isRepeated) {
        return (message.getField(field) as List<*>).map { diagnosticValue(field, it!!) }
    }
    if (field.hasPresence() && !message.hasField(field)) {
        return null
    }
    return diagnosticValue(field, message.getField(field))
}

/**
 * Resolves a diagnostic path against the node it was reported from, returning the value located there.
 * The path locates by field name and list index only, each segment `field` or `field[n]` joined by dots, as `validate*` builds it.
 * It returns null when a segment names an unset field or runs past a list, so a diagnostic about an absent field yields null there.
 *
 * Generated messages, maps, and diagnostics are supported; uint32 fields return unsigned Longs.
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
            is Message -> messageField(current, name)

            is Map<*, *> -> current[name]

            is Diagnostic -> when (name) {
                "path" -> current.path
                "code" -> current.code
                else -> null
            }

            else -> null
        }
        val index = match.groups[2]?.value
        if (index != null) {
            val position = index.toIntOrNull() ?: return null
            node = (node as? List<*>)?.getOrNull(position)
        }
    }
    return node
}
