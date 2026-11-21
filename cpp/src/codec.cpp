#include <utility>

#include <gondola/lyrics/model/document.hpp>
#include <gondola/lyrics/model/enriched.hpp>

#include "utils/detail.gen.hpp"
#include "utils/wire.hpp"

namespace gondola::lyrics::model {
	namespace {

		template <typename T>
		std::optional<std::string> encode_lyric(const T& lyric, bool (*encode_fields)(utils::Writer&, const T&)) {
			utils::Writer writer;
			if (!encode_fields(writer, lyric)) {
				return std::nullopt;
			}
			return std::move(writer).finish();
		}

		template <typename T>
		std::optional<T> decode_lyric(std::string_view bytes, bool (*decode_fields)(utils::Reader&, T&)) {
			if (bytes.size() > utils::kMaxMessageSize) {
				return std::nullopt;
			}
			utils::Reader reader(bytes);
			T             lyric;
			if (!decode_fields(reader, lyric)) {
				return std::nullopt;
			}
			return lyric;
		}

	} // namespace

	namespace document {

		std::optional<std::string> encode(const Lyric& lyric) {
			return encode_lyric(lyric, utils::generated::encodeDocumentLyric);
		}

		std::optional<Lyric> decode(std::string_view bytes) {
			return decode_lyric(bytes, utils::generated::decodeDocumentLyric);
		}

	} // namespace document

	namespace enriched {

		std::optional<std::string> encode(const Lyric& lyric) {
			return encode_lyric(lyric, utils::generated::encodeEnrichedLyric);
		}

		std::optional<Lyric> decode(std::string_view bytes) {
			return decode_lyric(bytes, utils::generated::decodeEnrichedLyric);
		}

	} // namespace enriched

} // namespace gondola::lyrics::model
