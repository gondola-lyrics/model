## v2.0.0 (2026-11-14)

> Proto Version: [2.0.0](https://github.com/gondola-lyrics/model/blob/proto/v2.0.0/proto/CHANGELOG.md)

### Breaking

- remove protobuf runtime dependencies
- replace protobuf messages with data classes and remove builders, descriptors, and kotlin dsl
- use Long for uint32 fields and expose nullable properties instead of presence methods
- replace repeated and map accessors with collection properties
- replace enums with numeric wrappers that preserve unknown values
- helpers no longer copy supplied lists or maps
- encode rejects strings containing lone surrogates instead of replacing them
- decode drops unknown fields, rejects malformed bytes per go protobuf rules, and throws IllegalArgumentException
- make validateLineTags and validateLyricTags internal

### Feature

- support selecting annotations by scheme ([102a27a](https://github.com/gondola-lyrics/model/commit/102a27aa92e603e4ee1cedd9acb6000c48f0bed5))
- support ordered language preference lists ([2b7cf1e](https://github.com/gondola-lyrics/model/commit/2b7cf1e1547fcc670aaab48b7efcf20a55928fa6))
- add interlude part type ([9cf3b3d](https://github.com/gondola-lyrics/model/commit/9cf3b3df1db3b8c57e3547556bd454a625dbeacc))
- add credit roles ([e9c034e](https://github.com/gondola-lyrics/model/commit/e9c034ee7194abd015483207af37aa4dfb59887c))
- unify annotation tokens and extensions ([6c350a3](https://github.com/gondola-lyrics/model/commit/6c350a347a174d400ce2ba91cedbf1dbb3a52df7))
- support romanization for timed lines ([cabfcbd](https://github.com/gondola-lyrics/model/commit/cabfcbda61499e369d88591fcb778f51d9d26c17))
- add part id field ([f1c12bd](https://github.com/gondola-lyrics/model/commit/f1c12bdbce308bf33a149f7b10a05732cfb66261))
- add transliteration scheme field ([b0a3545](https://github.com/gondola-lyrics/model/commit/b0a35459279698dda86303abcb454fec1d3b324d))
- add format profile field ([ac3a460](https://github.com/gondola-lyrics/model/commit/ac3a460c94285b2bc616fbe3fe88ec5ff895069c))

### Fix

- align local validation rules and diagnostic paths ([2488071](https://github.com/gondola-lyrics/model/commit/248807197542e0f4316667381e5902af61283916))
- preserve counts for invalid languages ([427883c](https://github.com/gondola-lyrics/model/commit/427883c8d325029ecc2d0df3051ce83a5e0a9252))
- ignore case when comparing language usages ([c589f6c](https://github.com/gondola-lyrics/model/commit/c589f6cb89a5b1426fcf2bf651e825867a8fcb68))
- validate language tag syntax ([957540a](https://github.com/gondola-lyrics/model/commit/957540a9b21e94043adef597208957fa22a30531))
- report unrecognized lyric statuses ([329d1aa](https://github.com/gondola-lyrics/model/commit/329d1aa411f99d3017128993a222f36247657edd))
- preserve line order when start times are equal ([3f8c58a](https://github.com/gondola-lyrics/model/commit/3f8c58a7f8e1de22fa43643d651c0b2b9d61d676))
- preserve explicit emphasis values ([9281a86](https://github.com/gondola-lyrics/model/commit/9281a861bc8cb3a968065e635129d7db6fecb847))

### Refactor

- rename helpers for clarity ([c1882f1](https://github.com/gondola-lyrics/model/commit/c1882f13c637a2e0d708eb301dd031f822c6b417))
- rename engineering credit roles ([10ab898](https://github.com/gondola-lyrics/model/commit/10ab898d2f74d511448533a434d08178de47f550))
- reorder lyric and line fields ([b9c732b](https://github.com/gondola-lyrics/model/commit/b9c732b19e31cb09ab20b27d1baa333450b11b29))
- rename language usage fields ([66457c4](https://github.com/gondola-lyrics/model/commit/66457c4b3f3f59300a592f84c39f5723ce94ef68))
- rename line agents to agent ids ([bf944b2](https://github.com/gondola-lyrics/model/commit/bf944b2d572184e79f03fcdfffdd4fce2986c939))
- rename timing to timing level ([d9fc66c](https://github.com/gondola-lyrics/model/commit/d9fc66c7e5ff905da61833834925a72f61896a6b))
- consolidate time definitions ([0f8a584](https://github.com/gondola-lyrics/model/commit/0f8a58474488c0f3c01ab794d32367f673ae6c24))
- flatten model exports with prefixes ([23815b6](https://github.com/gondola-lyrics/model/commit/23815b69d1252e6f3eec63462c4e07f1b88b8af8))
- rename model layers to document and enriched ([29be7c4](https://github.com/gondola-lyrics/model/commit/29be7c4c436364ea1e9e8bc3bfc17dd56570dc71))
- replace protobuf runtime with generated models ([7ad95eb](https://github.com/gondola-lyrics/model/commit/7ad95eb0ba4298ebdb79929a60abd2879475d905))

### Document

- align readmes with current models ([c3c9b14](https://github.com/gondola-lyrics/model/commit/c3c9b140c179c6b43ef4c33926cf1bc2a6a1bb87))
- clarify storage timing contract ([d2d94b6](https://github.com/gondola-lyrics/model/commit/d2d94b694d5a97ab9ee66788c9e0249e10a68025))
- add readme ([cda6341](https://github.com/gondola-lyrics/model/commit/cda6341d0d43a6f994b67032840ade652dbed21d))

## v1.0.0 (2026-11-06)

> Proto Version: [1.1.0](https://github.com/gondola-lyrics/model/blob/proto/v1.1.0/proto/CHANGELOG.md)

### Feature

- add storage helpers ([2c32482](https://github.com/gondola-lyrics/model/commit/2c3248210f0014c7e8f968453059d70c7dc72e2b))
- add runtime helpers ([2f42825](https://github.com/gondola-lyrics/model/commit/2f428256163738e38e75f8177f84d762770a265e))
- add common helpers ([9a95a61](https://github.com/gondola-lyrics/model/commit/9a95a610de93b1f8bedc52f831037c6c58054271))
- add utils ([6d5619d](https://github.com/gondola-lyrics/model/commit/6d5619d03169c5a01da37a07580d246a8966d05b))
- init ([1b7c90c](https://github.com/gondola-lyrics/model/commit/1b7c90ca4e5d4b2f99e2d823951df9e4168633fc))
- check declared languages against the lines in validators ([1da7b4e](https://github.com/gondola-lyrics/model/commit/1da7b4e25bf83a7400a6f92e72cba57fb1c020dd))

### Fix

- correct package names ([fa67fa4](https://github.com/gondola-lyrics/model/commit/fa67fa402fd015ac0b7254433c56773ee8f5d087))
- check lines by their kind and timing in validators ([ccefea7](https://github.com/gondola-lyrics/model/commit/ccefea7f16e82c70c533f6c2e0e791420d70ac02))

### Document

- update readme ([4256e78](https://github.com/gondola-lyrics/model/commit/4256e780a77675f9cd86e5d3f6f4090c5c54fba7))
- optimize comments ([82a3119](https://github.com/gondola-lyrics/model/commit/82a3119e742ed61d43363eb97061602250f52803))
