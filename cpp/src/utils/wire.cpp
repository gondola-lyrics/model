#include "wire.hpp"

#include <utility>
#include <vector>

namespace gondola::lyrics::model::utils {
	namespace {

		constexpr std::uint32_t kVarint      = 0;
		constexpr std::uint32_t kFixed64     = 1;
		constexpr std::uint32_t kDelimited   = 2;
		constexpr std::uint32_t kGroupStart  = 3;
		constexpr std::uint32_t kGroupEnd    = 4;
		constexpr std::uint32_t kFixed32     = 5;
		constexpr std::uint32_t kMapKeyTag   = 10;
		constexpr std::uint32_t kMapValueTag = 18;

		// Count nested groups inside the outermost skipped group, as the Go reader does.
		constexpr std::size_t kMaxGroupDepth = 10000;

		bool valid_utf8(std::string_view bytes) {
			for (std::size_t offset = 0; offset < bytes.size();) {
				const auto first = static_cast<unsigned char>(bytes[offset]);
				if (first < 0x80) {
					++offset;
					continue;
				}

				std::size_t   length;
				unsigned char min_second = 0x80;
				unsigned char max_second = 0xbf;
				if (first >= 0xc2 && first <= 0xdf) {
					length = 2;
				} else if (first >= 0xe0 && first <= 0xef) {
					length = 3;
					if (first == 0xe0) {
						min_second = 0xa0;
					} else if (first == 0xed) {
						max_second = 0x9f;
					}
				} else if (first >= 0xf0 && first <= 0xf4) {
					length = 4;
					if (first == 0xf0) {
						min_second = 0x90;
					} else if (first == 0xf4) {
						max_second = 0x8f;
					}
				} else {
					return false;
				}

				if (length > bytes.size() - offset) {
					return false;
				}
				const auto second = static_cast<unsigned char>(bytes[offset + 1]);
				if (second < min_second || second > max_second) {
					return false;
				}
				for (std::size_t index = 2; index < length; ++index) {
					const auto byte = static_cast<unsigned char>(bytes[offset + index]);
					if (byte < 0x80 || byte > 0xbf) {
						return false;
					}
				}
				offset += length;
			}
			return true;
		}

	} // namespace

	bool Writer::append(std::string_view bytes) {
		if (bytes.size() > kMaxMessageSize - buffer_.size()) {
			return false;
		}
		buffer_.append(bytes);
		return true;
	}

	bool Writer::varint(std::uint64_t value) {
		std::uint8_t bytes[10];
		std::size_t  length = 0;
		while (value >= 0x80) {
			bytes[length++] = static_cast<std::uint8_t>((value & 0x7f) | 0x80);
			value >>= 7;
		}
		bytes[length++] = static_cast<std::uint8_t>(value);
		return append(std::string_view(reinterpret_cast<const char*>(bytes), length));
	}

	bool Writer::delimited(std::uint32_t tag, std::string_view bytes) {
		return varint(tag) && varint(bytes.size()) && append(bytes);
	}

	Writer& Writer::child() {
		if (!child_) {
			child_ = std::make_unique<Writer>();
		}
		child_->buffer_.clear();
		return *child_;
	}

	bool Writer::uint32(std::uint32_t tag, std::uint32_t value) {
		return varint(tag) && varint(value);
	}

	bool Writer::int32(std::uint32_t tag, std::int32_t value) {
		return varint(tag) && varint(static_cast<std::uint64_t>(value));
	}

	bool Writer::sint32(std::uint32_t tag, std::int32_t value) {
		const auto bits = static_cast<std::uint32_t>(value);
		const auto sign = value < 0 ? std::numeric_limits<std::uint32_t>::max() : std::uint32_t{0};
		return uint32(tag, (bits << 1) ^ sign);
	}

	bool Writer::boolean(std::uint32_t tag, bool value) {
		return uint32(tag, value ? 1u : 0u);
	}

	bool Writer::string(std::uint32_t tag, std::string_view value) {
		return value.size() <= kMaxMessageSize && valid_utf8(value) && delimited(tag, value);
	}

	bool Writer::string_map(std::uint32_t tag, const std::map<std::string, std::string>& entries) {
		for (const auto& [key, value] : entries) {
			auto& entry = child();
			if (!entry.string(kMapKeyTag, key) || !entry.string(kMapValueTag, value) || !delimited(tag, entry.buffer_)) {
				return false;
			}
		}
		return true;
	}

	std::string Writer::finish() && {
		return std::move(buffer_);
	}

	bool Reader::empty() const {
		return bytes_.empty();
	}

	bool Reader::advance(std::size_t count) {
		if (count > bytes_.size()) {
			return false;
		}
		bytes_.remove_prefix(count);
		return true;
	}

	bool Reader::varint(std::uint64_t& value) {
		value = 0;
		for (unsigned int shift = 0; shift <= 63; shift += 7) {
			if (empty()) {
				return false;
			}
			const auto byte = static_cast<unsigned char>(bytes_.front());
			bytes_.remove_prefix(1);
			if (shift == 63 && byte > 1) {
				return false;
			}
			value |= static_cast<std::uint64_t>(byte & 0x7f) << shift;
			if (byte < 0x80) {
				return true;
			}
		}
		return false;
	}

	bool Reader::delimited(std::string_view& bytes) {
		std::uint64_t length;
		if (!varint(length) || length > bytes_.size()) {
			return false;
		}
		const auto count = static_cast<std::size_t>(length);
		bytes            = bytes_.substr(0, count);
		bytes_.remove_prefix(count);
		return true;
	}

	bool Reader::tag(std::uint32_t& value) {
		std::uint64_t number;
		if (!varint(number) || number > std::numeric_limits<std::uint32_t>::max() || (number >> 3) == 0 || (number & 7) > kFixed32) {
			return false;
		}
		value = static_cast<std::uint32_t>(number);
		return true;
	}

	bool Reader::uint32(std::uint32_t& value) {
		std::uint64_t number;
		if (!varint(number)) {
			return false;
		}
		value = static_cast<std::uint32_t>(number);
		return true;
	}

	bool Reader::int32(std::int32_t& value) {
		std::uint32_t bits;
		if (!uint32(bits)) {
			return false;
		}
		if (bits <= static_cast<std::uint32_t>(std::numeric_limits<std::int32_t>::max())) {
			value = static_cast<std::int32_t>(bits);
		} else {
			value = -1 - static_cast<std::int32_t>(std::numeric_limits<std::uint32_t>::max() - bits);
		}
		return true;
	}

	bool Reader::sint32(std::int32_t& value) {
		std::uint32_t bits;
		if (!uint32(bits)) {
			return false;
		}
		const auto half = static_cast<std::int32_t>(bits >> 1);
		value           = (bits & 1) == 0 ? half : -1 - half;
		return true;
	}

	bool Reader::boolean(bool& value) {
		std::uint64_t number;
		if (!varint(number)) {
			return false;
		}
		value = number != 0;
		return true;
	}

	bool Reader::string(std::string& value) {
		std::string_view bytes;
		if (!delimited(bytes) || !valid_utf8(bytes)) {
			return false;
		}
		value.assign(bytes);
		return true;
	}

	bool Reader::string_map_entry(std::map<std::string, std::string>& entries) {
		std::string_view bytes;
		if (!delimited(bytes)) {
			return false;
		}
		Reader      entry(bytes);
		std::string key;
		std::string value;
		while (!entry.empty()) {
			std::uint32_t field;
			if (!entry.tag(field)) {
				return false;
			}
			switch (field) {
			case kMapKeyTag:
				if (!entry.string(key)) {
					return false;
				}
				break;
			case kMapValueTag:
				if (!entry.string(value)) {
					return false;
				}
				break;
			default:
				if (!entry.skip(field)) {
					return false;
				}
			}
		}
		entries.insert_or_assign(std::move(key), std::move(value));
		return true;
	}

	bool Reader::skip(std::uint32_t tag_value) {
		if ((tag_value & 7) != kGroupStart) {
			return skip_value(tag_value & 7);
		}

		std::vector<std::uint32_t> groups{tag_value >> 3};
		while (!groups.empty()) {
			std::uint32_t inner;
			if (!tag(inner)) {
				return false;
			}
			switch (inner & 7) {
			case kGroupStart:
				if (groups.size() > kMaxGroupDepth) {
					return false;
				}
				groups.push_back(inner >> 3);
				break;
			case kGroupEnd:
				if (groups.back() != (inner >> 3)) {
					return false;
				}
				groups.pop_back();
				break;
			default:
				if (!skip_value(inner & 7)) {
					return false;
				}
			}
		}
		return true;
	}

	bool Reader::skip_value(std::uint32_t wire_type) {
		switch (wire_type) {
		case kVarint: {
			std::uint64_t value;
			return varint(value);
		}
		case kFixed64:
			return advance(8);
		case kDelimited: {
			std::string_view bytes;
			return delimited(bytes);
		}
		case kFixed32:
			return advance(4);
		default:
			return false;
		}
	}

} // namespace gondola::lyrics::model::utils
