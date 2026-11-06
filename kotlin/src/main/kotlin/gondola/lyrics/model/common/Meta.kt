@file:JvmName("MetaHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.MAX_TIME
import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findDuplicates
import gondola.lyrics.model.utils.lowerTag
import gondola.lyrics.model.utils.uint32
import gondola.lyrics.model.utils.unsigned

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
    val builder = Meta.newBuilder()
        .addAllUnknowns(unknowns)
        .setOffset(offset.toInt())
        .addAllTitles(titles)
        .addAllArtists(artists)
        .addAllAlbums(albums)
        .addAllAuthors(authors)
        .addAllIsrcs(isrcs)
        .addAllCredits(credits)
        .addAllReferences(references)
    if (duration != null) {
        builder.duration = uint32(duration)
    }
    if (language != null) {
        builder.language = language
    }
    return builder.build()
}

/**
 * Creates a MetaCredit, one credited role and the names filling it.
 */
fun makeMetaCredit(role: CreditRole = CreditRole.CREDIT_ROLE_UNSPECIFIED, raw: String? = null, names: List<Text> = emptyList()): MetaCredit {
    val builder = MetaCredit.newBuilder().setRole(role).addAllNames(names)
    if (raw != null) {
        builder.raw = raw
    }
    return builder.build()
}

/**
 * Creates a MetaReference, an external platform id for the lyric.
 */
fun makeMetaReference(platform: String = "", ids: List<String> = emptyList()): MetaReference =
    MetaReference.newBuilder().setPlatform(platform).addAllIds(ids).build()

/**
 * Validates a MetaCredit: its role must be resolved, and an OTHER role must carry the source's own word in `raw`.
 * An unresolved role makes no credit at all, so `raw` is asked for only once the role says which one it named.
 */
fun validateMetaCredit(credit: MetaCredit, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (credit.roleValue == 0 || credit.role == CreditRole.UNRECOGNIZED) {
        diagnostics.add(Diagnostic(childPath(path, "role"), DiagnosticCode.MetaCreditRoleUnspecified))
    } else if (credit.role == CreditRole.CREDIT_ROLE_OTHER && !credit.hasRaw()) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.MetaCreditRawMissing))
    }
    credit.namesList.forEachIndexed { index, name -> diagnostics.addAll(validateText(name, childPath(path, "names[$index]"))) }
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
    if (reference.idsCount == 0) {
        diagnostics.add(Diagnostic(childPath(path, "ids"), DiagnosticCode.MetaReferenceIdsEmpty))
    }
    return diagnostics
}

/**
 * Validates a Meta: its offset and its duration, when set, must lie within the schema's domain, its titles, albums and references hold one entry per key, and each of its credits and references must be valid.
 *
 * The generated sint32 field already constrains offset to its integer domain.
 */
fun validateMeta(meta: Meta, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (meta.hasDuration() && unsigned(meta.duration) > MAX_TIME) {
        diagnostics.add(Diagnostic(childPath(path, "duration"), DiagnosticCode.MetaDurationOverflow))
    }
    // Titles and albums are one per language, while artists, authors and credited names are one per person, so only the first two are checked.
    findDuplicates(meta.titlesList) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "titles[$index]"), DiagnosticCode.MetaTitlesLanguageDuplicate))
    }
    findDuplicates(meta.albumsList) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "albums[$index]"), DiagnosticCode.MetaAlbumsLanguageDuplicate))
    }
    // Every list of text names something, whatever it is keyed by, so each entry is asked for its own text.
    val textFields = listOf("titles" to meta.titlesList, "artists" to meta.artistsList, "albums" to meta.albumsList, "authors" to meta.authorsList)
    for ((field, entries) in textFields) {
        entries.forEachIndexed { index, entry -> diagnostics.addAll(validateText(entry, childPath(path, "$field[$index]"))) }
    }
    // An ISRC is read by other catalogues, so one outside the shape they read names no recording; which case and separators it is written with is canonical form rather than shape.
    meta.isrcsList.forEachIndexed { index, isrc ->
        if (isrc.isNotEmpty() && !ISRC_PATTERN.matches(isrc.replace(ISRC_SEPARATORS, "").uppercase())) {
            diagnostics.add(Diagnostic(childPath(path, "isrcs[$index]"), DiagnosticCode.MetaIsrcsMalformed))
        }
    }
    meta.creditsList.forEachIndexed { index, credit -> diagnostics.addAll(validateMetaCredit(credit, childPath(path, "credits[$index]"))) }
    findDuplicates(meta.referencesList) { it.platform.lowercase() }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "references[$index]"), DiagnosticCode.MetaReferencesPlatformDuplicate))
    }
    meta.referencesList.forEachIndexed { index, reference ->
        diagnostics.addAll(validateMetaReference(reference, childPath(path, "references[$index]")))
    }
    return diagnostics
}

/**
 * Returns a copy of the credit with its names canonicalized and all-default entries dropped.
 */
fun canonicalizeMetaCredit(credit: MetaCredit): MetaCredit =
    credit.toBuilder().clearNames().addAllNames(canonicalizeList(credit.namesList, ::canonicalizeText)).build()

/**
 * Returns a copy of the reference with its platform lowercased and empty ids dropped.
 */
fun canonicalizeMetaReference(reference: MetaReference): MetaReference =
    reference.toBuilder().setPlatform(reference.platform.lowercase()).clearIds().addAllIds(
        reference.idsList.filter {
            it.isNotEmpty()
        },
    ).build()

/**
 * Returns a copy of the Meta with its language tag lowercased, its text lists, credits and references canonicalized, all-default unknown entries dropped, and its ISRCs upper-cased without separators.
 */
fun canonicalizeMeta(meta: Meta): Meta {
    val builder = meta.toBuilder()
        .clearUnknowns().addAllUnknowns(canonicalizeList(meta.unknownsList) { it })
        .clearLanguage()
        .clearTitles().addAllTitles(canonicalizeList(meta.titlesList, ::canonicalizeText))
        .clearArtists().addAllArtists(canonicalizeList(meta.artistsList, ::canonicalizeText))
        .clearAlbums().addAllAlbums(canonicalizeList(meta.albumsList, ::canonicalizeText))
        .clearAuthors().addAllAuthors(canonicalizeList(meta.authorsList, ::canonicalizeText))
        .clearIsrcs().addAllIsrcs(meta.isrcsList.map { it.replace(ISRC_SEPARATORS, "").uppercase() }.filter { it.isNotEmpty() })
        .clearCredits().addAllCredits(canonicalizeList(meta.creditsList, ::canonicalizeMetaCredit))
        .clearReferences().addAllReferences(canonicalizeList(meta.referencesList, ::canonicalizeMetaReference))
    lowerTag(meta.language)?.let { builder.language = it }
    return builder.build()
}

/**
 * Applies a timeline offset to a playback clock, yielding the value to compare against stored times.
 * A positive offset makes the lyric appear earlier.
 * Compute in signed 64-bit, since a uint32 clock plus a sint32 offset overflows unsigned arithmetic.
 */
fun applyOffset(clock: Long, offset: Long): Long = clock + offset

/**
 * Removes a timeline offset from a stored time, yielding the playback clock at which it is reached.
 * This inverts applyOffset.
 * The result may be negative, meaning before playback starts.
 */
fun removeOffset(time: Long, offset: Long): Long = time - offset
