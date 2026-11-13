# Gondola Lyric Schema

Protobuf definitions for shared types and the `document` and `enriched` lyric models.

## Commands

**Build**

```bash
buf build
```

**Check**

```bash
buf lint
```

## Modules

- **common**: Shared metadata, agents, parts, `Text`, `TextToken`, `TimeRange`, and `TimingLevel`.
- **document**: Source declarations, including original text, timing, and annotations.
- **enriched**: Lyric content with parse status and derived language usage counts.

## Model Shape

`document` and `enriched` each define their own `Lyric`, `Line`, `LineBackground`, `Word`, and annotation messages.

| Field                                                     | Description                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `Lyric.agents`                                            | Shared `Agent` entries referenced by ID.                                          |
| `Line.agent_ids`, `LineBackground.agent_ids`              | Agent IDs referencing `Lyric.agents`.                                             |
| `Line.content`, `LineBackground.content`                  | Whole-line `text` or a non-empty `words` list.                                    |
| `LineAnnotationRoman.content`                             | Whole-line `text` or a non-empty `tokens` list with at least one timed token.     |
| `WordAnnotationRoman.tokens`, `WordAnnotationRuby.tokens` | `TextToken` fragments; language and scheme are declared on the parent annotation. |
| `enriched.Lyric.status`                                   | Parse status, separate from model validation.                                     |
| `enriched.Lyric.language_usages`                          | `LanguageUsage` entries with `tag` and `line_count`.                              |

`TextToken` holds `time`, `text`, and an `extra` string map.
Unset token `time` falls back to the parent annotation; an explicit `TimeRange` is used as-is, including an unset `end`.
`Lyric.timing` applies to the original text; annotations can carry independent timing.

## License

[MIT](../LICENSE)
