# Gondola Lyric Model

Protobuf lyric schemas, native TypeScript and Kotlin models, helpers, and wire codecs.

## Modules

### [Proto](proto)

Protobuf schemas for shared types and the `document` and `enriched` models.

### [Node](node)

Native TypeScript models, helpers, and Protobuf codecs.

### [Kotlin](kotlin)

Native Kotlin models, helpers, Java-compatible APIs, and Protobuf codecs.

## Model Layers

- **document** stores source declarations, including whole-line or word-segmented lyrics and annotations.
- **enriched** adds parse status and language usage counts to the lyric content.
- **common** defines shared metadata, agents, parts, text tokens, and timing types.

`document` and `enriched` define separate line, word, and annotation types while sharing `common`.

## License

[MIT](LICENSE)
