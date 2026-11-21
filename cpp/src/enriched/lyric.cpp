#include "utils/lyric.hpp"

#include <cstddef>
#include <stdexcept>
#include <unordered_map>
#include <unordered_set>
#include <utility>

#include <gondola/lyrics/model/common/agent.hpp>
#include <gondola/lyrics/model/common/meta.hpp>
#include <gondola/lyrics/model/enriched/language.hpp>
#include <gondola/lyrics/model/enriched/line.hpp>
#include <gondola/lyrics/model/enriched/lyric.hpp>
#include <gondola/lyrics/model/generated/version.gen.hpp>

namespace gondola::lyrics::model::enriched {
	namespace {

		using common::Diagnostic;
		using common::DiagnosticCode;
		using common::Part;
		using common::TimingLevel;

		constexpr std::string_view kDigits               = "0123456789";
		constexpr std::string_view kIdentifierCharacters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-";

		bool consume(std::string_view& text, char prefix) noexcept {
			if (text.empty() || text.front() != prefix) {
				return false;
			}
			text.remove_prefix(1);
			return true;
		}

		bool consume_version_number(std::string_view& text) noexcept {
			const auto number = text.substr(0, text.find_first_not_of(kDigits));
			if (number.empty() || (number.size() > 1 && number.front() == '0')) {
				return false;
			}
			text.remove_prefix(number.size());
			return true;
		}

		bool consume_version_identifiers(std::string_view& text, bool prerelease) noexcept {
			do {
				const auto identifier = text.substr(0, text.find_first_not_of(kIdentifierCharacters));
				if (identifier.empty() ||
					(prerelease && identifier.size() > 1 && identifier.front() == '0' && identifier.find_first_not_of(kDigits) == std::string_view::npos)) {
					return false;
				}
				text.remove_prefix(identifier.size());
			} while (consume(text, '.'));
			return true;
		}

		bool is_semver(std::string_view version) noexcept {
			for (int component = 0; component < 3; ++component) {
				if ((component > 0 && !consume(version, '.')) || !consume_version_number(version)) {
					return false;
				}
			}
			if (consume(version, '-') && !consume_version_identifiers(version, true)) {
				return false;
			}
			if (consume(version, '+') && !consume_version_identifiers(version, false)) {
				return false;
			}
			return version.empty();
		}

		bool is_resolved(LyricStatus status) noexcept {
			return status == LyricStatus::kValid || status == LyricStatus::kInvalid;
		}

		void validate_parts(const std::vector<Line>& lines, std::optional<std::size_t> lastSung, std::vector<Diagnostic>& diagnostics) {
			struct Section {
				const Part& first;
				std::size_t lastIndex;
			};
			std::unordered_map<std::string_view, Section> sections;
			for (std::size_t index = 0; index < lines.size(); ++index) {
				const auto& part = lines[index].part;
				if (!part) {
					continue;
				}
				const auto path = utils::child_path(utils::indexed_path({}, "lines", index), "part");
				if (part->type == common::PartType::kInterlude && (!lastSung || index >= *lastSung)) {
					diagnostics.push_back({utils::child_path(path, "type"), DiagnosticCode::kLyricPartInterludeTrailing});
				}
				if (!part->id || part->id->empty()) {
					continue;
				}
				const auto [previous, inserted] = sections.try_emplace(*part->id, Section{*part, index});
				if (!inserted) {
					auto& section = previous->second;
					if (part->type != section.first.type || part->raw != section.first.raw) {
						diagnostics.push_back({path, DiagnosticCode::kLyricPartMismatch});
					}
					if (section.lastIndex + 1 != index) {
						diagnostics.push_back({utils::child_path(path, "id"), DiagnosticCode::kLyricPartIdReused});
					}
					section.lastIndex = index;
				}
			}
		}

	} // namespace

	Lyric makeLyric(LyricStatus                status,
		std::string                        format,
		std::string                        profile,
		TimingLevel                        timing,
		std::optional<common::Meta>        meta,
		std::vector<common::Agent>         agents,
		std::vector<Line>                  lines,
		std::vector<LanguageUsage>         languageUsages,
		std::map<std::string, std::string> extra) {
		if (!is_resolved(status)) {
			throw std::invalid_argument("Lyric status must be valid or invalid");
		}
		return {status,
			SCHEMA_VERSION,
			std::move(format),
			std::move(profile),
			timing,
			std::move(meta),
			std::move(agents),
			std::move(lines),
			std::move(languageUsages),
			std::move(extra)};
	}

	std::vector<Diagnostic> validateLyric(const Lyric& lyric) {
		std::vector<Diagnostic> diagnostics;
		if (!is_semver(lyric.version)) {
			diagnostics.push_back({"version", DiagnosticCode::kLyricVersionMalformed});
		}
		if (!is_resolved(lyric.status)) {
			diagnostics.push_back({"status", DiagnosticCode::kLyricStatusUnspecified});
		}
		const bool timed = utils::is_timed_content(lyric.timing);
		if (!timed && lyric.timing != TimingLevel::kNone) {
			diagnostics.push_back({"timing", DiagnosticCode::kLyricTimingUnspecified});
		}

		std::unordered_set<std::string_view> agentIds;
		for (std::size_t index = 0; index < lyric.agents.size(); ++index) {
			const auto& agent = lyric.agents[index];
			const auto  path  = utils::indexed_path({}, "agents", index);
			if (!agent.id.empty() && !agentIds.insert(agent.id).second) {
				diagnostics.push_back({path, DiagnosticCode::kLyricAgentIdDuplicate});
			}
			utils::append_diagnostics(diagnostics, common::validateAgent(agent, path));
		}
		if (lyric.meta) {
			utils::append_diagnostics(diagnostics, common::validateMeta(*lyric.meta, "meta"));
		}

		const auto                      expectedUsages = deriveLanguageUsages(lyric.lines);
		bool                            matchingUsages = lyric.language_usages.size() == expectedUsages.size();
		std::unordered_set<std::string> languageTags;
		for (std::size_t index = 0; index < lyric.language_usages.size(); ++index) {
			const auto& usage = lyric.language_usages[index];
			const auto  path  = utils::indexed_path({}, "languageUsages", index);
			const auto  tag   = utils::lowercase_ascii(usage.tag);
			if (!languageTags.insert(tag).second) {
				diagnostics.push_back({path, DiagnosticCode::kLyricLanguageUsagesTagDuplicate});
			}
			utils::append_diagnostics(diagnostics, validateLanguageUsage(usage, path));
			matchingUsages = matchingUsages && tag == expectedUsages[index].tag && usage.line_count == expectedUsages[index].line_count;
		}
		if (!matchingUsages) {
			diagnostics.push_back({"languageUsages", DiagnosticCode::kLyricLanguageUsagesMismatch});
		}

		bool                                 anyContent = false;
		bool                                 anyWords   = false;
		std::optional<std::size_t>           lastSung;
		std::unordered_set<std::string_view> lineIds;
		const auto                           claim_id = [&](std::string_view id, const std::string& path) {
			if (!id.empty() && !lineIds.insert(id).second) {
				diagnostics.push_back({path, DiagnosticCode::kLyricLineIdDuplicate});
			}
		};
		const auto check_sung_references = [&](const auto& line, std::string_view path, bool needsEnd) {
			for (std::size_t index = 0; index < line.agent_ids.size(); ++index) {
				if (agentIds.count(line.agent_ids[index]) == 0) {
					diagnostics.push_back({utils::indexed_path(path, "agentIds", index), DiagnosticCode::kLyricLineAgentDangling});
				}
			}
			const bool words = hasLineWords(line);
			anyWords         = anyWords || words;
			anyContent       = anyContent || words || (line.content && line.content->text.has_value());
			if (needsEnd && line.time && !line.time->end) {
				diagnostics.push_back({utils::child_path(path, "time.end"), DiagnosticCode::kLyricLineTimeEndMissing});
			}
		};
		for (std::size_t index = 0; index < lyric.lines.size(); ++index) {
			const auto& line = lyric.lines[index];
			const auto  path = utils::indexed_path({}, "lines", index);
			const bool  sung = line.type == LineType::kNormal;
			if (sung) {
				lastSung = index;
			}
			claim_id(line.id, path);
			if (line.type != LineType::kInstrumental) {
				check_sung_references(line, path, timed && sung && index + 1 != lyric.lines.size());
			}
			for (std::size_t backgroundIndex = 0; backgroundIndex < line.backgrounds.size(); ++backgroundIndex) {
				const auto& background     = line.backgrounds[backgroundIndex];
				const auto  backgroundPath = utils::indexed_path(path, "backgrounds", backgroundIndex);
				claim_id(background.id, backgroundPath);
				check_sung_references(background, backgroundPath, false);
			}
			utils::append_diagnostics(diagnostics, validateLine(line, path, lyric.timing));
		}
		if (lyric.timing == TimingLevel::kWord && anyContent && !anyWords) {
			diagnostics.push_back({"timing", DiagnosticCode::kLyricTimingWordMissing});
		}
		utils::report_unordered(lyric.lines, {}, "lines", DiagnosticCode::kLyricLinesUnordered, diagnostics);
		validate_parts(lyric.lines, lastSung, diagnostics);
		return diagnostics;
	}

	Lyric orderLyric(Lyric lyric) {
		utils::sort_by_start(lyric.lines);
		for (auto& line : lyric.lines) {
			line = orderLineBackgrounds(std::move(line));
		}
		lyric.language_usages = orderLanguageUsages(std::move(lyric.language_usages));
		return lyric;
	}

	Lyric canonicalizeLyric(Lyric lyric) {
		lyric.format  = utils::lowercase_ascii(lyric.format);
		lyric.profile = utils::lowercase_ascii(lyric.profile);
		utils::canonicalize_field(lyric.meta, common::canonicalizeMeta);
		utils::canonicalize_entries(lyric.agents, common::canonicalizeAgent);
		utils::canonicalize_entries(lyric.lines, canonicalizeLine);
		utils::sort_by_start(lyric.lines);
		lyric.language_usages = canonicalizeLanguageUsages(std::move(lyric.language_usages));
		return lyric;
	}

} // namespace gondola::lyrics::model::enriched
