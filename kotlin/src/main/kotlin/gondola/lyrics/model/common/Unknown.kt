@file:JvmName("UnknownHelper")

package gondola.lyrics.model.common

/**
 * Creates an UnknownEntry, a preserved key-value pair the model has no typed field for.
 */
fun makeUnknownEntry(key: String = "", value: String = ""): UnknownEntry = UnknownEntry.newBuilder().setKey(key).setValue(value).build()

/**
 * Collects the values of every entry carrying the key, in order, since one key may appear more than once.
 * Keys compare exactly, as the source wrote them.
 */
fun getUnknownValues(unknowns: List<UnknownEntry>, key: String): List<String> = unknowns.filter { it.key == key }.map { it.value }
