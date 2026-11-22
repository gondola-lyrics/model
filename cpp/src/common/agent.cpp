#include <unordered_map>
#include <utility>

#include <gondola/lyrics/model/common/agent.hpp>
#include <gondola/lyrics/model/common/text.hpp>

#include "utils/common.hpp"

namespace gondola::lyrics::model::common {
	namespace {
		bool isResolved(AgentType type) noexcept {
			switch (type) {
			case AgentType::kOther:
			case AgentType::kPerson:
			case AgentType::kGroup:
				return true;
			default:
				return false;
			}
		}
	} // namespace

	Agent makeAgent(std::string id, AgentType type, std::optional<std::string> raw, std::vector<Text> names) {
		return {std::move(id), type, std::move(raw), std::move(names)};
	}

	std::vector<Diagnostic> validateAgent(const Agent& agent, std::string_view path) {
		std::vector<Diagnostic> diagnostics;
		if (agent.id.empty()) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kAgentIdEmpty});
		}
		if (!isResolved(agent.type)) {
			diagnostics.push_back({utils::childPath(path, "type"), DiagnosticCode::kAgentTypeUnspecified});
		} else if (agent.type == AgentType::kOther && !agent.raw) {
			diagnostics.push_back({std::string(path), DiagnosticCode::kAgentRawMissing});
		}
		const auto languageKey = [](const Text& value) { return utils::languageKey(value.language); };
		utils::reportDuplicates(agent.names, languageKey, path, "names", DiagnosticCode::kAgentNamesLanguageDuplicate, diagnostics);
		utils::validateEntries(agent.names, validateText, path, "names", diagnostics);
		return diagnostics;
	}

	Agent canonicalizeAgent(Agent agent) {
		utils::canonicalizeEntries(agent.names, canonicalizeText);
		return agent;
	}

	std::vector<const Agent*> resolveLineAgents(const std::vector<std::string>& agentIds, const std::vector<Agent>& agents) {
		std::unordered_map<std::string_view, const Agent*> by_id;
		by_id.reserve(agents.size());
		for (const auto& agent : agents) {
			if (!agent.id.empty()) {
				by_id.try_emplace(agent.id, &agent);
			}
		}
		std::vector<const Agent*> result;
		result.reserve(agentIds.size());
		for (const auto& id : agentIds) {
			const auto found = by_id.find(id);
			if (found != by_id.end()) {
				result.push_back(found->second);
			}
		}
		return result;
	}
} // namespace gondola::lyrics::model::common
