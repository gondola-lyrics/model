@file:JvmName("PartHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.isUnresolved

/**
 * Creates a Part, the structural section a line belongs to.
 */
fun makePart(type: PartType = PartType.PART_TYPE_UNSPECIFIED, id: String? = null, raw: String? = null): Part {
    return Part(type = type, id = id, raw = raw)
}

/**
 * Validates a Part: its type must be resolved, and an OTHER type must carry the source's own word in `raw`.
 * An unresolved type makes no section at all, so `raw` is asked for only once the type says which section it named.
 */
fun validatePart(part: Part, path: String = ""): List<Diagnostic> {
    return when {
        isUnresolved(part.type) ->
            listOf(Diagnostic(childPath(path, "type"), DiagnosticCode.PartTypeUnspecified))

        part.type == PartType.PART_TYPE_OTHER && part.raw == null ->
            listOf(Diagnostic(path, DiagnosticCode.PartRawMissing))

        else -> emptyList()
    }
}

/**
 * Checks that each non-empty part id covers one contiguous run with a consistent type and raw.
 * Parts follow the lyric's line order; background lines inherit their parent's part.
 */
internal fun validateLyricParts(parts: List<Part?>): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val seen = mutableMapOf<String, Pair<Part, Int>>()
    parts.forEachIndexed { index, part ->
        if (part == null) {
            return@forEachIndexed
        }
        val id = part.id
        if (id.isNullOrEmpty()) {
            return@forEachIndexed
        }
        val previous = seen[id]
        if (previous != null) {
            val (first, lastIndex) = previous
            if (part.type != first.type || part.raw != first.raw) {
                diagnostics += Diagnostic("lines[$index].part", DiagnosticCode.LyricPartMismatch)
            }
            if (lastIndex != index - 1) {
                diagnostics += Diagnostic("lines[$index].part.id", DiagnosticCode.LyricPartIdReused)
            }
        }
        seen[id] = (previous?.first ?: part) to index
    }
    return diagnostics
}
