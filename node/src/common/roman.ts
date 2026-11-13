/**
 * Display text aggregated from word romanizations, without source timing or token boundaries.
 * Keep the original annotations for persistence and timed highlighting.
 */
export type LineRomanView = {
  language?: string | undefined
  scheme?: string | undefined
  text: string
}
