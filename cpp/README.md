# Gondola Lyric Model for C++

Native C++ models, helpers, and Protobuf codecs for `document` and `enriched` lyrics.

## Installation

Requires CMake 3.21 and C++17.
Builds as a static library without a Protobuf runtime dependency.
Checked-in generated sources build directly without `buf` or `protoc`.

### Source Directory

For a repository checkout or submodule at `external/model`, add to your `CMakeLists.txt` after defining the `app` target:

```cmake
add_subdirectory(external/model/cpp)
target_link_libraries(app PRIVATE gondola::lyrics::model)
```

### FetchContent

Replace `<commit>` with a full commit hash:

```cmake
include(FetchContent)

FetchContent_Declare(gondola_lyrics_model
  GIT_REPOSITORY "https://github.com/gondola-lyrics/model.git"
  GIT_TAG "<commit>"
  SOURCE_SUBDIR cpp
)
FetchContent_MakeAvailable(gondola_lyrics_model)

target_link_libraries(app PRIVATE gondola::lyrics::model)
```

### Installed Package

Build and install from `cpp/`, replacing `<prefix>` with the target directory:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
cmake --install build --config Release --prefix "<prefix>"
```

In your `CMakeLists.txt`:

```cmake
find_package(gondola-lyrics-model 1.0 CONFIG REQUIRED)
target_link_libraries(app PRIVATE gondola::lyrics::model)
```

Configure the build with the install prefix:

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_CONFIGURATION_TYPES=Release -DCMAKE_PREFIX_PATH="<prefix>"
cmake --build build --config Release
```

Build and install the `Debug` configuration separately if needed.
For multi-configuration generators, `CMAKE_CONFIGURATION_TYPES` must match the installed configurations (`RelWithDebInfo` and `MinSizeRel` can map to `Release`).
Both the library and consumer must use compatible compilers, standard libraries, architectures, and runtime settings.

The CMake package version identifies the C++ binding.
`gondola::lyrics::model::SCHEMA_VERSION` identifies the serialized schema.

## Usage

- **Timing Levels (`timing`)**: Specifies the timing granularity of the source lyric:
  - `common::TimingLevel::kNone`: Untimed; sung lines contain whole-line text.
  - `common::TimingLevel::kLine`: Each sung line carries a time range and whole-line text.
  - Use `kWord` if any line contains word-level timing.
  - `common::TimingLevel::kWord`: Normal words carry time ranges; whole-line text lines may also appear.
  - Use `kLine` if all sung lines use whole-line text.

Include `<gondola/lyrics/model/document.hpp>` or `<gondola/lyrics/model/enriched.hpp>` for model-specific types and helpers.
Both include shared types from `<gondola/lyrics/model/common.hpp>`.
Model-specific helpers share identical names under `gondola::lyrics::model::document` and `gondola::lyrics::model::enriched`.
Shared utilities reside in `gondola::lyrics::model::common`.

### Document Example

```cpp
#include <iostream>

#include <gondola/lyrics/model/document.hpp>

namespace common   = gondola::lyrics::model::common;
namespace document = gondola::lyrics::model::document;

int main() {
	// The last timed line may omit end.
	auto line       = document::makeLineNormal({}, common::makeTimeRange(170644));
	line.languages  = {"en"};
	line.content    = document::makeLineContentText("Like the first time tangled by the fishing line");
	line.annotation = document::makeLineAnnotation({},
		{
			document::makeLineAnnotationTranslation("zh-Hans", "就像第一次被渔线缠住那样"),
		});

	auto persisted  = document::makeLyric("lrc", {}, common::TimingLevel::kLine);
	persisted.lines = {line};

	std::cout << document::validateLyric(persisted).size() << '\n'; // => 0
	return 0;
}
```

### Enriched Example

```cpp
#include <iostream>

#include <gondola/lyrics/model/enriched.hpp>

namespace common   = gondola::lyrics::model::common;
namespace enriched = gondola::lyrics::model::enriched;

int main() {
	// Instrumental lines require a complete, non-empty time range.
	const auto interlude = enriched::makeLineInstrumental({}, common::makeTimeRange(176883, 178550));

	auto sung       = enriched::makeLineNormal({}, common::makeTimeRange(178550, 188199));
	sung.languages  = {"en"};
	sung.content    = enriched::makeLineContentWords({
		enriched::makeWordNormal(common::makeTimeRange(178550, 180198), "en", "I"),
		// Separate words with kSpace words.
		enriched::makeWordSpace(" "),
		enriched::makeWordNormal(common::makeTimeRange(180198, 181686), "en", "wish"),
		enriched::makeWordSpace(" "),
		enriched::makeWordNormal(common::makeTimeRange(181686, 184055), "en", "you"),
		enriched::makeWordSpace(" "),
		enriched::makeWordNormal(common::makeTimeRange(184055, 184278), "en", "are"),
		enriched::makeWordSpace(" "),
		enriched::makeWordNormal(common::makeTimeRange(184278, 184614), "en", "still"),
		enriched::makeWordSpace(" "),
		enriched::makeWordNormal(common::makeTimeRange(184614, 184966), "en", "by"),
		enriched::makeWordSpace(" "),
		enriched::makeWordNormal(common::makeTimeRange(184966, 185718), "en", "my"),
		enriched::makeWordSpace(" "),
		enriched::makeWordNormal(common::makeTimeRange(185718, 188199), "en", "side"),
	});
	sung.annotation = enriched::makeLineAnnotation({},
		{
			enriched::makeLineAnnotationTranslation("zh-Hans", "多希望你就在我身旁"),
		});

	auto played  = enriched::makeLyric(enriched::LyricStatus::kValid, "lrc", {}, common::TimingLevel::kWord);
	played.lines = {interlude, sung};
	// Must match languages declared on normal lines and normal words.
	played.language_usages = enriched::deriveLanguageUsages(played.lines);

	std::cout << enriched::validateLyric(played).size() << '\n';     // => 0
	std::cout << enriched::getLineContentText(sung.content) << '\n'; // => I wish you are still by my side

	const auto bytes = enriched::encode(enriched::canonicalizeLyric(played));
	if (!bytes) {
		return 1;
	}
	const auto decoded = enriched::decode(*bytes);
	if (!decoded) {
		return 1;
	}
	std::cout << decoded->lines.size() << '\n'; // => 2
	return 0;
}
```

### Validation & Diagnostics

Diagnostic paths use camelCase field names with zero-based indices.
`common::toString()` converts the diagnostic code to its string identifier.

```cpp
#include <iostream>

#include <gondola/lyrics/model/document.hpp>
#include <gondola/lyrics/model/enriched.hpp>

namespace common   = gondola::lyrics::model::common;
namespace document = gondola::lyrics::model::document;
namespace enriched = gondola::lyrics::model::enriched;

int main() {
	auto documentLine      = document::makeLineNormal({}, common::makeTimeRange(163908));
	documentLine.languages = {"en"};
	documentLine.content   = document::makeLineContentText("I'm still figuring out my life");

	// Unset timing is reported rather than inferred.
	auto brokenPersisted  = document::makeLyric("lrc");
	brokenPersisted.lines = {documentLine};
	for (const auto& diagnostic : document::validateLyric(brokenPersisted)) {
		std::cout << diagnostic.path << ": " << common::toString(diagnostic.code) << '\n';
	}
	// => timing: lyric.timing.unspecified

	auto enrichedLine      = enriched::makeLineNormal({}, common::makeTimeRange(163908, 169347));
	enrichedLine.languages = {"en"};
	enrichedLine.content   = enriched::makeLineContentWords({
		// kNormal words cannot contain whitespace.
		enriched::makeWordNormal(common::makeTimeRange(163908, 169347), "en", "I'm still figuring out my life"),
	});

	// Missing language_usages is reported rather than derived.
	auto brokenPlayed  = enriched::makeLyric(enriched::LyricStatus::kValid, "lrc", {}, common::TimingLevel::kWord);
	brokenPlayed.lines = {enrichedLine};
	for (const auto& diagnostic : enriched::validateLyric(brokenPlayed)) {
		std::cout << diagnostic.path << ": " << common::toString(diagnostic.code) << '\n';
	}
	// => languageUsages: lyric.language_usages.mismatch
	// => lines[0].content.words[0].text: word.text.separator
	return 0;
}
```

### Line Romanization

```cpp
#include <iostream>
#include <optional>

#include <gondola/lyrics/model/document.hpp>

namespace common   = gondola::lyrics::model::common;
namespace document = gondola::lyrics::model::document;

int main() {
	const auto plainRoman = document::makeLineAnnotationRoman("zh-latn", "pinyin", std::nullopt, document::makeLineAnnotationRomanContentText("ni hao"));

	const auto timedRoman = document::makeLineAnnotationRoman("zh-latn",
		"pinyin",
		std::nullopt,
		document::makeLineAnnotationRomanContentTokens({
			common::makeTextToken(common::makeTimeRange(1000, 1800), "ni ", {{"source", "parser"}}),
			common::makeTextToken(common::makeTimeRange(2000), "hao"),
		}));

	std::cout << document::getLineAnnotationRomanText(plainRoman) << '\n'; // => ni hao
	std::cout << document::getLineAnnotationRomanText(timedRoman) << '\n'; // => ni hao
	return 0;
}
```

### Word Romanization Views

`document::deriveLineRomanViews()` and `enriched::deriveLineRomanViews()` aggregate word-level romanizations into `common::LineRomanView` items (`language`, `scheme`, and `text`) for display.
Token timing and boundaries remain on the word annotations, while line-level romanizations stay in `line.annotation->romans`.

```cpp
#include <iostream>
#include <optional>
#include <vector>

#include <gondola/lyrics/model/document.hpp>

namespace common   = gondola::lyrics::model::common;
namespace document = gondola::lyrics::model::document;

int main() {
	const auto annotation = document::makeWordAnnotation({},
		{
			document::makeWordAnnotationRoman(std::nullopt,
				"zh-Latn",
				"pinyin",
				{
					common::makeTextToken(common::makeTimeRange(1000, 1800), "ni "),
					common::makeTextToken(common::makeTimeRange(2000, 2600), "hao"),
				}),
			document::makeWordAnnotationRoman(std::nullopt,
				"zh-Latn",
				"pinyin-numeric",
				{
					common::makeTextToken(std::nullopt, "ni3 hao3"),
				}),
		});
	const auto word       = document::makeWordNormal(common::makeTimeRange(1000, 2600), "zh", "你好", annotation);
	const auto content    = document::makeLineContentWords({word});

	const std::vector<common::LineRomanView> views = document::deriveLineRomanViews(content);
	for (const auto& view : views) {
		std::cout << view.language.value_or("") << ' ' << view.scheme.value_or("") << ": " << view.text << '\n';
	}
	// => zh-latn pinyin: ni hao
	// => zh-latn pinyin-numeric: ni3 hao3

	if (const auto* selected = common::pickItemByLanguage(views, {"zh-Latn", "en"})) {
		std::cout << selected->text << '\n'; // => ni hao
	}
	if (const auto* selected = common::pickItemByScheme(views, {"pinyin-numeric", {"zh-Latn", "en"}, false})) {
		std::cout << selected->text << '\n'; // => ni3 hao3
	}
	return 0;
}
```

Language preferences are evaluated in order.
Untagged items match only if no preference succeeds.
`common::pickItemByScheme()` filters by `scheme` (ASCII case-insensitive) before applying language matching and `fallback`.
Passing `std::nullopt` skips scheme filtering, while `""` matches untagged schemes.
Selection helpers return `const T*` (or `nullptr`) borrowing elements from the input vector.
They follow `std::vector` pointer invalidation rules.

See the [public headers](include/gondola/lyrics/model) and [Proto definitions](https://github.com/gondola-lyrics/model/tree/main/proto) for complete API details.

## Development Commands

Run all commands from `cpp/`.

### Generate

Regenerates `generated/` from `../proto/` (requires `buf` 1.72.0 on `PATH`):

```bash
python ../script/generate-proto-binding.py cpp
```

### Build

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

### Check & Format

Generated files are excluded from formatting (`find` requires Bash):

```bash
python ../script/generate-proto-binding.py cpp --check
find include src test -type f \(-name '*.hpp' -o -name '*.cpp'\) -exec clang-format -i {} +
```

### Test

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DGONDOLA_LYRICS_MODEL_BUILD_TESTS=ON
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

## License

[MIT](../LICENSE)
