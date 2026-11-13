## v2.0.0 (2026-11-14)

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
- correct package names ([fa67fa4](https://github.com/gondola-lyrics/model/commit/fa67fa402fd015ac0b7254433c56773ee8f5d087))

### Refactor

- rename helpers for clarity ([c1882f1](https://github.com/gondola-lyrics/model/commit/c1882f13c637a2e0d708eb301dd031f822c6b417))
- rename engineering credit roles ([10ab898](https://github.com/gondola-lyrics/model/commit/10ab898d2f74d511448533a434d08178de47f550))
- reorder lyric and line fields ([b9c732b](https://github.com/gondola-lyrics/model/commit/b9c732b19e31cb09ab20b27d1baa333450b11b29))
- rename language usage fields ([66457c4](https://github.com/gondola-lyrics/model/commit/66457c4b3f3f59300a592f84c39f5723ce94ef68))
- rename line agents to agent ids ([bf944b2](https://github.com/gondola-lyrics/model/commit/bf944b2d572184e79f03fcdfffdd4fce2986c939))
- rename timing to timing level ([d9fc66c](https://github.com/gondola-lyrics/model/commit/d9fc66c7e5ff905da61833834925a72f61896a6b))
- consolidate time definitions ([0f8a584](https://github.com/gondola-lyrics/model/commit/0f8a58474488c0f3c01ab794d32367f673ae6c24))
- rename model layers to document and enriched ([29be7c4](https://github.com/gondola-lyrics/model/commit/29be7c4c436364ea1e9e8bc3bfc17dd56570dc71))

### Document

- align readmes with current models ([c3c9b14](https://github.com/gondola-lyrics/model/commit/c3c9b140c179c6b43ef4c33926cf1bc2a6a1bb87))
- clarify storage timing contract ([d2d94b6](https://github.com/gondola-lyrics/model/commit/d2d94b694d5a97ab9ee66788c9e0249e10a68025))

## v1.1.0 (2026-10-14)

### Feature

- require a known end on every sung line but the last ([e30eb6a](https://github.com/gondola-lyrics/model/commit/e30eb6ac57ae47d81d610e62b38e960c01c3e583))

### Fix

- correct the last line end rule ([e4ab422](https://github.com/gondola-lyrics/model/commit/e4ab422d67ae420eb4e8187cc959abd1d521ec10))

### Document

- optimize comments ([a45c927](https://github.com/gondola-lyrics/model/commit/a45c927c4b0556b642b8a5ba0c136e15032b2d1e))

## v1.0.0 (2026-10-13)

### Feature

- check declared languages against the lines in validators ([1da7b4e](https://github.com/gondola-lyrics/model/commit/1da7b4e25bf83a7400a6f92e72cba57fb1c020dd))
- make time range end optional ([07a2186](https://github.com/gondola-lyrics/model/commit/07a2186cabf7d715e5ee22d972d6d722366359a2))
- add storage line language fields ([68ead33](https://github.com/gondola-lyrics/model/commit/68ead3312513498dbdb3cb194a7b49a8ddff1a3f))
- add meta language field ([1e3617c](https://github.com/gondola-lyrics/model/commit/1e3617cd631956bd7a231d94437dbedb13c83982))
- split word per layer and rename fields ([2f284f0](https://github.com/gondola-lyrics/model/commit/2f284f046e3a8e6bff7b7c2e0d816505a611d595))
- split line content into words or text ([d2b97a0](https://github.com/gondola-lyrics/model/commit/d2b97a0af0342c85642c11b323cd8be97764f256))
- add java options ([d2aac22](https://github.com/gondola-lyrics/model/commit/d2aac225e02cdda244e1ae9bef49b14b278633c6))
- add line id field ([59ad823](https://github.com/gondola-lyrics/model/commit/59ad823f0e165006dce9483f6abe61fbbd753323))
- require non-empty agent ids ([bd57a53](https://github.com/gondola-lyrics/model/commit/bd57a5336519f39f03821950a10646d17177e31d))
- add version file ([5308d69](https://github.com/gondola-lyrics/model/commit/5308d6955ce2670b80154c9c5259e57729bc84db))
- init base proto ([ebea8ad](https://github.com/gondola-lyrics/model/commit/ebea8ad187d39472cd421b0b685cdb599d7da528))

### Fix

- check lines by their kind and timing in validators ([ccefea7](https://github.com/gondola-lyrics/model/commit/ccefea7f16e82c70c533f6c2e0e791420d70ac02))
- make time end required ([5d73b7c](https://github.com/gondola-lyrics/model/commit/5d73b7cfbd936d7a2dceb4564538c2850a048882))

### Refactor

- reorder fields for consistent layout ([98657f4](https://github.com/gondola-lyrics/model/commit/98657f48d1ef4952d507e881f810ab2bf9e62f17))
- rename unknown message to unknown entry ([6c1ac35](https://github.com/gondola-lyrics/model/commit/6c1ac355c93d21b6abcadff6ec146259018ebefa))
- rename time message to time range ([c676d03](https://github.com/gondola-lyrics/model/commit/c676d03b6723a49d556dbdffd4430c1d6d5d5f21))

### Document

- update readme ([4256e78](https://github.com/gondola-lyrics/model/commit/4256e780a77675f9cd86e5d3f6f4090c5c54fba7))
- define a part by its type and raw ([3b5f2f6](https://github.com/gondola-lyrics/model/commit/3b5f2f68415c11b46a60bcdc388d1dcb37c1b447))
- optimize comments ([82a3119](https://github.com/gondola-lyrics/model/commit/82a3119e742ed61d43363eb97061602250f52803))
- align the timing level comments ([1b2294e](https://github.com/gondola-lyrics/model/commit/1b2294ef981968f5801dccc0e455cce61a17114a))
- state the instrumental line end rule ([be27587](https://github.com/gondola-lyrics/model/commit/be275878dd5c94a380d66174d9facd932311c297))
- optimize line language comments ([16cef11](https://github.com/gondola-lyrics/model/commit/16cef114dc011678f6e330d69053c3e9abdebd51))
- drop unnecessary comments ([1df337e](https://github.com/gondola-lyrics/model/commit/1df337e6f459463c4c2cf4b01e3c9b9055809a0b))
- optimize comments ([e1393bb](https://github.com/gondola-lyrics/model/commit/e1393bb96a6d1b9cae1703a9c6580ae61f3a8ff3))
- optimize comments ([e5914ca](https://github.com/gondola-lyrics/model/commit/e5914cab6d89f7cc4c4fe1d2edd2db93b5b60709))
