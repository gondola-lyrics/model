package gondola.lyrics.model.common

/**
 * Display text aggregated from word romanizations, without source timing or token boundaries.
 * Keep the original annotations for persistence and timed highlighting.
 */
data class LineRomanView(val language: String? = null, val scheme: String? = null, val text: String)
