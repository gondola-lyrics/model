@file:JvmName("AgentHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findDuplicates
import gondola.lyrics.model.utils.lowerTag

/**
 * Creates an Agent, a performing voice referenced by lines through its id.
 */
fun makeAgent(id: String = "", type: AgentType = AgentType.AGENT_TYPE_UNSPECIFIED, raw: String? = null, names: List<Text> = emptyList()): Agent {
    val builder = Agent.newBuilder().setId(id).setType(type).addAllNames(names)
    if (raw != null) {
        builder.raw = raw
    }
    return builder.build()
}

/**
 * Validates an Agent: its id must be non-empty, its type must be resolved, an OTHER type must carry the source's own word in `raw`, and its names hold one entry per language.
 */
fun validateAgent(agent: Agent, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (agent.id.isEmpty()) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.AgentIdEmpty))
    }
    if (agent.typeValue == 0 || agent.type == AgentType.UNRECOGNIZED) {
        diagnostics.add(Diagnostic(childPath(path, "type"), DiagnosticCode.AgentTypeUnspecified))
    } else if (agent.type == AgentType.AGENT_TYPE_OTHER && !agent.hasRaw()) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.AgentRawMissing))
    }
    // The names are one per language rather than one per member, so a language may not repeat; an unset and an empty tag are the same default language.
    findDuplicates(agent.namesList) { lowerTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "names[$index]"), DiagnosticCode.AgentNamesLanguageDuplicate))
    }
    agent.namesList.forEachIndexed { index, name -> diagnostics.addAll(validateText(name, childPath(path, "names[$index]"))) }
    return diagnostics
}

/**
 * Returns a copy of the Agent with its names canonicalized and all-default entries dropped.
 */
fun canonicalizeAgent(agent: Agent): Agent = agent.toBuilder().clearNames().addAllNames(canonicalizeList(agent.namesList, ::canonicalizeText)).build()

private fun resolveAgents(ids: List<String>, agents: List<Agent>): List<Agent> {
    val byId = linkedMapOf<String, Agent>()
    for (agent in agents) {
        if (agent.id.isNotEmpty() && !byId.containsKey(agent.id)) {
            byId[agent.id] = agent
        }
    }
    return ids.mapNotNull { byId[it] }
}

/**
 * Resolves a line's agent ids to the Agent objects they reference, in order with the lead first.
 * An id matching no agent is skipped, so a dangling reference drops out rather than leaving a hole.
 * An empty id never resolves, and the first agent claiming an id keeps it, matching what validate reports about both.
 */
fun resolveLineAgents(line: gondola.lyrics.model.storage.Line, agents: List<Agent>): List<Agent> = resolveAgents(line.agentsList, agents)

/**
 * Resolves a line's agent ids to the Agent objects they reference, in order with the lead first.
 * An id matching no agent is skipped, so a dangling reference drops out rather than leaving a hole.
 * An empty id never resolves, and the first agent claiming an id keeps it, matching what validate reports about both.
 */
fun resolveLineAgents(line: gondola.lyrics.model.storage.LineBackground, agents: List<Agent>): List<Agent> = resolveAgents(line.agentsList, agents)

/**
 * Resolves a line's agent ids to the Agent objects they reference, in order with the lead first.
 * An id matching no agent is skipped, so a dangling reference drops out rather than leaving a hole.
 * An empty id never resolves, and the first agent claiming an id keeps it, matching what validate reports about both.
 */
fun resolveLineAgents(line: gondola.lyrics.model.runtime.Line, agents: List<Agent>): List<Agent> = resolveAgents(line.agentsList, agents)

/**
 * Resolves a line's agent ids to the Agent objects they reference, in order with the lead first.
 * An id matching no agent is skipped, so a dangling reference drops out rather than leaving a hole.
 * An empty id never resolves, and the first agent claiming an id keeps it, matching what validate reports about both.
 */
fun resolveLineAgents(line: gondola.lyrics.model.runtime.LineBackground, agents: List<Agent>): List<Agent> = resolveAgents(line.agentsList, agents)
