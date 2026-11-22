#include <utility>

#include <gondola/lyrics/model/document.hpp>
#include <gondola/lyrics/model/enriched.hpp>

#include "utils/detail.gen.hpp"
#include "utils/wire.hpp"

namespace gondola::lyrics::model {
	namespace {

		template <typename T>
		std::optional<std::string> encodeLyric(const T& lyric, bool (*encodeFields)(utils::Writer&, const T&)) {
			utils::Writer writer;
			if (!encodeFields(writer, lyric)) {
				return std::nullopt;
			}
			return std::move(writer).finish();
		}

		template <typename T>
		std::optional<T> decodeLyric(std::string_view bytes, bool (*decodeFields)(utils::Reader&, T&)) {
			if (bytes.size() > utils::kMaxMessageSize) {
				return std::nullopt;
			}
			utils::Reader reader(bytes);
			T             lyric;
			if (!decodeFields(reader, lyric)) {
				return std::nullopt;
			}
			return lyric;
		}

	} // namespace

	namespace document {

		std::optional<std::string> encode(const Lyric& lyric) {
			return encodeLyric(lyric, utils::generated::encodeDocumentLyric);
		}

		std::optional<Lyric> decode(std::string_view bytes) {
			return decodeLyric(bytes, utils::generated::decodeDocumentLyric);
		}

	} // namespace document

	namespace enriched {

		std::optional<std::string> encode(const Lyric& lyric) {
			return encodeLyric(lyric, utils::generated::encodeEnrichedLyric);
		}

		std::optional<Lyric> decode(std::string_view bytes) {
			return decodeLyric(bytes, utils::generated::decodeEnrichedLyric);
		}

	} // namespace enriched

} // namespace gondola::lyrics::model
