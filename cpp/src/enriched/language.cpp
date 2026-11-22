#include <algorithm>
#include <limits>
#include <unordered_map>
#include <unordered_set>
#include <utility>

#include <gondola/lyrics/model/enriched/language.hpp>
#include <gondola/lyrics/model/generated/document/line.gen.hpp>
#include <gondola/lyrics/model/generated/enriched/line.gen.hpp>

#include "utils/common.hpp"

namespace gondola::lyrics::model::enriched {
	namespace {
		using Counts = std::unordered_map<std::string, std::uint32_t>;

		void addCount(std::uint32_t& total, std::uint32_t count) noexcept {
			total += std::min(std::numeric_limits<std::uint32_t>::max() - total, count);
		}

		std::vector<LanguageUsage> finishCounts(const Counts& counts) {
			std::vector<LanguageUsage> usages;
			usages.reserve(counts.size());
			for (const auto& [tag, count] : counts) {
				usages.push_back({tag, count});
			}
			return orderLanguageUsages(std::move(usages));
		}

		template <typename T>
		std::vector<LanguageUsage> deriveUsagesFromLines(const std::vector<T>& lines) {
			Counts counts;
			for (const auto& line : lines) {
				if (line.type != decltype(line.type)::kNormal) {
					continue;
				}
				std::unordered_set<std::string> tags;
				for (const auto& language : line.languages) {
					if (!language.empty()) {
						tags.insert(utils::lowercaseAscii(language));
					}
				}
				if (line.content) {
					for (const auto& word : line.content->words) {
						if (word.type == decltype(word.type)::kNormal && word.language && !word.language->empty()) {
							tags.insert(utils::lowercaseAscii(*word.language));
						}
					}
				}
				for (const auto& tag : tags) {
					addCount(counts[tag], 1);
				}
			}
			return finishCounts(counts);
		}
	} // namespace

	LanguageUsage makeLanguageUsage(std::string tag, std::int64_t lineCount) {
		return {std::move(tag), utils::requireUint32(lineCount)};
	}

	std::vector<common::Diagnostic> validateLanguageUsage(const LanguageUsage& usage, std::string_view path) {
		if (usage.tag.empty()) {
			return {{utils::childPath(path, "tag"), common::DiagnosticCode::kLanguageUsageTagEmpty}};
		}
		if (!common::isWellFormedLanguageTag(usage.tag)) {
			return {{utils::childPath(path, "tag"), common::DiagnosticCode::kLanguageTagMalformed}};
		}
		return {};
	}

	std::vector<LanguageUsage> deriveLanguageUsages(const std::vector<Line>& lines) {
		return deriveUsagesFromLines(lines);
	}

	std::vector<LanguageUsage> deriveLanguageUsages(const std::vector<document::Line>& lines) {
		return deriveUsagesFromLines(lines);
	}

	std::vector<LanguageUsage> orderLanguageUsages(std::vector<LanguageUsage> usages) {
		std::stable_sort(usages.begin(), usages.end(), [](const LanguageUsage& a, const LanguageUsage& b) {
			return a.line_count != b.line_count ? a.line_count > b.line_count : utils::lowercaseAscii(a.tag) < utils::lowercaseAscii(b.tag);
		});
		return usages;
	}

	std::vector<LanguageUsage> canonicalizeLanguageUsages(std::vector<LanguageUsage> usages) {
		Counts counts;
		for (const auto& usage : usages) {
			if (!usage.tag.empty()) {
				addCount(counts[utils::lowercaseAscii(usage.tag)], usage.line_count);
			}
		}
		return finishCounts(counts);
	}
} // namespace gondola::lyrics::model::enriched
