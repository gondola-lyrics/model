#pragma once

#include <cstddef>
#include <cstdint>
#include <limits>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <string_view>

namespace gondola::lyrics::model::utils {
	inline constexpr std::size_t kMaxMessageSize = std::numeric_limits<std::int32_t>::max();

	class Writer {
	public:
		bool uint32(std::uint32_t tag, std::uint32_t value);
		bool int32(std::uint32_t tag, std::int32_t value);
		bool sint32(std::uint32_t tag, std::int32_t value);
		bool boolean(std::uint32_t tag, bool value);
		bool string(std::uint32_t tag, std::string_view value);
		bool stringMap(std::uint32_t tag, const std::map<std::string, std::string>& entries);

		template <typename T>
		bool message(std::uint32_t tag, const T& value, bool (*encode)(Writer&, const T&)) {
			auto& nested = child();
			return encode(nested, value) && delimited(tag, nested.buffer_);
		}

		std::string finish() &&;

	private:
		bool    append(std::string_view bytes);
		bool    varint(std::uint64_t value);
		bool    delimited(std::uint32_t tag, std::string_view bytes);
		Writer& child();

		std::string             buffer_;
		std::unique_ptr<Writer> child_;
	};

	class Reader {
	public:
		explicit Reader(std::string_view bytes) : bytes_(bytes) {}

		bool empty() const;
		bool tag(std::uint32_t& value);
		bool uint32(std::uint32_t& value);
		bool sint32(std::int32_t& value);
		bool boolean(bool& value);
		bool string(std::string& value);
		bool stringMapEntry(std::map<std::string, std::string>& entries);
		bool skip(std::uint32_t tag);

		template <typename T>
		bool enumValue(T& value) {
			std::int32_t number;
			if (!int32(number)) {
				return false;
			}
			value = static_cast<T>(number);
			return true;
		}

		template <typename T>
		bool message(T& value, bool (*decode)(Reader&, T&)) {
			std::string_view bytes;
			if (!delimited(bytes)) {
				return false;
			}
			Reader nested(bytes);
			return decode(nested, value);
		}

		template <typename T>
		bool message(std::optional<T>& value, bool (*decode)(Reader&, T&)) {
			if (!value) {
				value.emplace();
			}
			return message(*value, decode);
		}

	private:
		bool advance(std::size_t count);
		bool varint(std::uint64_t& value);
		bool delimited(std::string_view& bytes);
		bool int32(std::int32_t& value);
		bool skipValue(std::uint32_t wire_type);

		std::string_view bytes_;
	};
} // namespace gondola::lyrics::model::utils
