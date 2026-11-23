#pragma once

#include <cstdlib>
#include <initializer_list>
#include <iostream>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <vector>

#include <gondola/lyrics/model/document.hpp>
#include <gondola/lyrics/model/enriched.hpp>
#include <gondola/lyrics/model/generated/version.gen.hpp>

namespace gondola::lyrics::model::test {
	inline void expect(bool condition, std::string_view message) {
		if (!condition) {
			throw std::runtime_error(std::string(message));
		}
	}

	template <typename Actual, typename Expected>
	void expectEqual(const Actual& actual, const Expected& expected, std::string_view message) {
		expect(actual == expected, message);
	}

	template <typename Exception, typename Function>
	void expectThrows(Function function, std::string_view message) {
		try {
			function();
		} catch (const Exception&) {
			return;
		}
		throw std::runtime_error(std::string(message));
	}

	inline void expectDiagnostics(const std::vector<common::Diagnostic>& actual, std::initializer_list<std::pair<std::string_view, std::string_view>> expected) {
		bool equal = actual.size() == expected.size();
		auto item  = expected.begin();
		for (std::size_t index = 0; equal && index < actual.size(); ++index, ++item) {
			equal = actual[index].path == item->first && common::toString(actual[index].code) == item->second;
		}
		if (!equal) {
			std::ostringstream message;
			message << "Unexpected diagnostics:";
			for (const auto& diagnostic : actual) {
				message << "\n  " << diagnostic.path << ": " << common::toString(diagnostic.code);
			}
			message << "\nExpected:";
			for (const auto& [path, code] : expected) {
				message << "\n  " << path << ": " << code;
			}
			throw std::runtime_error(message.str());
		}
	}

	template <typename Lyric>
	Lyric lyricWithTiming(common::TimingLevel timing) {
		Lyric lyric;
		lyric.version = SCHEMA_VERSION;
		lyric.timing  = timing;
		if constexpr (std::is_same_v<Lyric, enriched::Lyric>) {
			lyric.status = enriched::LyricStatus::kValid;
		}
		return lyric;
	}

	template <typename Line>
	Line textLine(std::string id, std::optional<common::TimeRange> time = std::nullopt) {
		Line line;
		line.id   = std::move(id);
		line.type = decltype(line.type)::kNormal;
		line.time = time;
		line.content.emplace();
		line.content->text = line.id.empty() ? "text" : line.id;
		return line;
	}

	struct TestCase {
		std::string_view name;
		void (*run)();
	};

	inline int runCases(std::initializer_list<TestCase> tests) {
		int failures = 0;
		for (const auto& test : tests) {
			try {
				test.run();
				std::cout << "PASS " << test.name << '\n';
			} catch (const std::exception& error) {
				++failures;
				std::cerr << "FAIL " << test.name << ": " << error.what() << '\n';
			}
		}
		return failures;
	}

	int codecTests();
	int commonTests();
	int helpersTests();
	int validateTests();
	int canonicalizeTests();
	int orderTests();
	int romanTests();
	int textTokenTests();
} // namespace gondola::lyrics::model::test
