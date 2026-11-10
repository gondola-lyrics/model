@file:JvmName("MetaHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.MAX_TIME
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findDuplicates
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.lowerTag
import gondola.lyrics.model.utils.uint32

/**
 * An ISRC names a recording as two letters for the country, three for the registrant, then seven digits for the year and the designation.
 * It is read without case or separators, since those are the canonical form rather than part of the identifier, and a string outside this shape names no recording at all.
 */
private val ISRC_PATTERN = Regex("^[A-Z]{2}[0-9A-Z]{3}[0-9]{7}$")
private val ISRC_SEPARATORS = Regex("[^0-9a-zA-Z]")

/**
 * Creates a Meta, the lyric's metadata.
 *
 * Offset must fit in sint32 and duration must fit in uint32; the schema's stricter duration limit is checked by `validateMeta`.
 */
fun makeMeta(
    unknowns: List<UnknownEntry> = emptyList(),
    offset: Long = 0,
    duration: Long? = null,
    language: String? = null,
    titles: List<Text> = emptyList(),
    artists: List<Text> = emptyList(),
    albums: List<Text> = emptyList(),
    authors: List<Text> = emptyList(),
    isrcs: List<String> = emptyList(),
    credits: List<MetaCredit> = emptyList(),
    references: List<MetaReference> = emptyList(),
): Meta {
    require(offset in Int.MIN_VALUE.toLong()..Int.MAX_VALUE.toLong()) { "Offset must fit in sint32: $offset" }
    return Meta(
        unknowns = unknowns,
        offset = offset.toInt(),
        duration = duration?.let(::uint32),
        language = language,
        titles = titles,
        artists = artists,
        albums = albums,
        authors = authors,
        isrcs = isrcs,
        credits = credits,
        references = references,
    )
}

/**
 * Creates a MetaCredit, one credited role and the names filling it.
 */
fun makeMetaCredit(role: CreditRole = CreditRole.CREDIT_ROLE_UNSPECIFIED, raw: String? = null, names: List<Text> = emptyList()): MetaCredit {
    return MetaCredit(role = role, raw = raw, names = names)
}

/**
 * Creates a MetaReference, an external platform id for the lyric.
 */
fun makeMetaReference(platform: String = "", ids: List<String> = emptyList()): MetaReference {
    return MetaReference(platform = platform, ids = ids)
}

/**
 * Validates a MetaCredit: its role must be resolved, and an OTHER role must carry the source's own word in `raw`.
 * An unresolved role makes no credit at all, so `raw` is asked for only once the role says which one it named.
 */
fun validateMetaCredit(credit: MetaCredit, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (isUnresolved(credit.role)) {
        diagnostics.add(Diagnostic(childPath(path, "role"), DiagnosticCode.MetaCreditRoleUnspecified))
    } else if (credit.role == CreditRole.CREDIT_ROLE_OTHER && credit.raw == null) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.MetaCreditRawMissing))
    }
    credit.names.forEachIndexed { index, name -> diagnostics.addAll(validateText(name, childPath(path, "names[$index]"))) }
    return diagnostics
}

/**
 * Validates a MetaReference: it must name the platform it points at, and carry at least one identifier on it; an empty identifier is reported by the lyric's entry sweep.
 */
fun validateMetaReference(reference: MetaReference, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (reference.platform.isEmpty()) {
        diagnostics.add(Diagnostic(childPath(path, "platform"), DiagnosticCode.MetaReferencePlatformEmpty))
    }
    if (reference.ids.isEmpty()) {
        diagnostics.add(Diagnostic(childPath(path, "ids"), DiagnosticCode.MetaReferenceIdsEmpty))
    }
    return diagnostics
}

/**
 * Validates a Meta: its offset and its duration, when set, must lie within the schema's domain, its titles, albums and references hold one entry per key, and each of its credits and references must be valid.
 *
 * The Int offset already fits the schema's sint32 domain.
 */
fun validateMeta(meta: Meta, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    val duration = meta.duration
    if (duration != null) {
        if (duration < 0) {
            diagnostics.add(Diagnostic(childPath(path, "duration"), DiagnosticCode.MetaDurationInvalid))
        } else if (duration > MAX_TIME) {
            diagnostics.add(Diagnostic(childPath(path, "duration"), DiagnosticCode.MetaDurationOverflow))
        }
    }
    // Titles and albums are one per language, while artists, authors and credited names are one per person, so only the first two are checked.
    findDuplicates(meta.titles) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "titles[$index]"), DiagnosticCode.MetaTitlesLanguageDuplicate))
    }
    findDuplicates(meta.albums) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "albums[$index]"), DiagnosticCode.MetaAlbumsLanguageDuplicate))
    }
    // Every list of text names something, whatever it is keyed by, so each entry is asked for its own text.
    val textFields = listOf("titles" to meta.titles, "artists" to meta.artists, "albums" to meta.albums, "authors" to meta.authors)
    for ((field, entries) in textFields) {
        entries.forEachIndexed { index, entry -> diagnostics.addAll(validateText(entry, childPath(path, "$field[$index]"))) }
    }
    // An ISRC is read by other catalogues, so one outside the shape they read names no recording; which case and separators it is written with is canonical form rather than shape.
    meta.isrcs.forEachIndexed { index, isrc ->
        if (isrc.isNotEmpty() && !ISRC_PATTERN.matches(isrc.replace(ISRC_SEPARATORS, "").uppercase())) {
            diagnostics.add(Diagnostic(childPath(path, "isrcs[$index]"), DiagnosticCode.MetaIsrcsMalformed))
        }
    }
    meta.credits.forEachIndexed { index, credit -> diagnostics.addAll(validateMetaCredit(credit, childPath(path, "credits[$index]"))) }
    findDuplicates(meta.references) { it.platform.lowercase() }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "references[$index]"), DiagnosticCode.MetaReferencesPlatformDuplicate))
    }
    meta.references.forEachIndexed { index, reference ->
        diagnostics.addAll(validateMetaReference(reference, childPath(path, "references[$index]")))
    }
    return diagnostics
}

/**
 * Returns a copy of the credit with its names canonicalized and all-default entries dropped.
 */
fun canonicalizeMetaCredit(credit: MetaCredit): MetaCredit {
    return credit.copy(names = canonicalizeList(credit.names, ::canonicalizeText))
}

/**
 * Returns a copy of the reference with its platform lowercased and empty ids dropped.
 */
fun canonicalizeMetaReference(reference: MetaReference): MetaReference {
    return reference.copy(platform = reference.platform.lowercase(), ids = reference.ids.filter { it.isNotEmpty() })
}

/**
 * Returns a copy of the Meta with its language tag lowercased, its text lists, credits and references canonicalized, all-default unknown entries dropped, and its ISRCs upper-cased without separators.
 */
fun canonicalizeMeta(meta: Meta): Meta {
    return meta.copy(
        unknowns = canonicalizeList(meta.unknowns) { it },
        language = lowerTag(meta.language),
        titles = canonicalizeList(meta.titles, ::canonicalizeText),
        artists = canonicalizeList(meta.artists, ::canonicalizeText),
        albums = canonicalizeList(meta.albums, ::canonicalizeText),
        authors = canonicalizeList(meta.authors, ::canonicalizeText),
        isrcs = meta.isrcs.map { it.replace(ISRC_SEPARATORS, "").uppercase() }.filter { it.isNotEmpty() },
        credits = canonicalizeList(meta.credits, ::canonicalizeMetaCredit),
        references = canonicalizeList(meta.references, ::canonicalizeMetaReference),
    )
}

/**
 * Applies a timeline offset to a playback clock, yielding the value to compare against stored times.
 * A positive offset makes the lyric appear earlier.
 * Compute in signed 64-bit, since a uint32 clock plus a sint32 offset overflows unsigned arithmetic.
 */
fun applyOffset(clock: Long, offset: Long): Long {
    return clock + offset
}

/**
 * Removes a timeline offset from a stored time, yielding the playback clock at which it is reached.
 * This inverts applyOffset.
 * The result may be negative, meaning before playback starts.
 */
fun removeOffset(time: Long, offset: Long): Long {
    return time - offset
}
