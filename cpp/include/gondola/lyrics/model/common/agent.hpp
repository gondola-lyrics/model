#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <gondola/lyrics/model/common/diagnostic.hpp>
#include <gondola/lyrics/model/generated/common/agent.gen.hpp>

namespace gondola::lyrics::model::common {

	/**
 * Creates the identity of a voice that lines can reference.
 */
	[[nodiscard]] Agent makeAgent(std::string id = {}, AgentType type = AgentType::kUnspecified, std::optional<std::string> raw = std::nullopt, std::vector<Text> names = {});

	/**
 * Checks the id, type, raw label and one-name-per-language rule.
 */
	[[nodiscard]] std::vector<Diagnostic> validateAgent(const Agent& agent, std::string_view path = {});

	/**
 * Canonicalizes the names and drops all-default entries.
 */
	[[nodiscard]] Agent canonicalizeAgent(Agent agent);

	/**
 * Resolves ids in their given order using the first matching non-empty agent id.
 *
 * The returned pointers borrow elements from agents.
 */
	[[nodiscard]] std::vector<const Agent*> resolveLineAgents(const std::vector<std::string>& agentIds, const std::vector<Agent>& agents);
	std::vector<const Agent*>               resolveLineAgents(const std::vector<std::string>&, const std::vector<Agent>&&) = delete;

} // namespace gondola::lyrics::model::common
