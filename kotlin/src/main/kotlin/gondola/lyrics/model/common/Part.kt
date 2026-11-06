@file:JvmName("PartHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.childPath

/**
 * Creates a Part, the structural section a line belongs to.
 */
fun makePart(type: PartType = PartType.PART_TYPE_UNSPECIFIED, raw: String? = null): Part {
    val builder = Part.newBuilder().setType(type)
    if (raw != null) {
        builder.raw = raw
    }
    return builder.build()
}

/**
 * Validates a Part: its type must be resolved, and an OTHER type must carry the source's own word in `raw`.
 * An unresolved type makes no section at all, so `raw` is asked for only once the type says which section it named.
 */
fun validatePart(part: Part, path: String = ""): List<Diagnostic> = when {
    part.typeValue == 0 || part.type == PartType.UNRECOGNIZED ->
        listOf(Diagnostic(childPath(path, "type"), DiagnosticCode.PartTypeUnspecified))

    part.type == PartType.PART_TYPE_OTHER && !part.hasRaw() ->
        listOf(Diagnostic(path, DiagnosticCode.PartRawMissing))

    else -> emptyList()
}
