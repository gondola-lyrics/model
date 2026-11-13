@file:JvmName("AgentHelper")

package gondola.lyrics.model.common

import gondola.lyrics.model.utils.canonicalizeList
import gondola.lyrics.model.utils.childPath
import gondola.lyrics.model.utils.findDuplicateIndices
import gondola.lyrics.model.utils.isUnresolved
import gondola.lyrics.model.utils.lowerNonEmptyTag

/**
 * Creates an Agent, a performing voice referenced by lines through its id.
 */
fun makeAgent(id: String = "", type: AgentType = AgentType.AGENT_TYPE_UNSPECIFIED, raw: String? = null, names: List<Text> = emptyList()): Agent {
    return Agent(id = id, type = type, raw = raw, names = names)
}

/**
 * Validates an Agent: its id must be non-empty, its type must be resolved, an OTHER type must carry the source's own word in `raw`, and its names hold one entry per language.
 */
fun validateAgent(agent: Agent, path: String = ""): List<Diagnostic> {
    val diagnostics = mutableListOf<Diagnostic>()
    if (agent.id.isEmpty()) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.AgentIdEmpty))
    }
    if (isUnresolved(agent.type)) {
        diagnostics.add(Diagnostic(childPath(path, "type"), DiagnosticCode.AgentTypeUnspecified))
    } else if (agent.type == AgentType.AGENT_TYPE_OTHER && agent.raw == null) {
        diagnostics.add(Diagnostic(path, DiagnosticCode.AgentRawMissing))
    }
    // The names are one per language rather than one per member, so a language may not repeat; an unset and an empty tag are the same default language.
    findDuplicateIndices(agent.names) { lowerNonEmptyTag(it.language) ?: "" }.forEach { index ->
        diagnostics.add(Diagnostic(childPath(path, "names[$index]"), DiagnosticCode.AgentNamesLanguageDuplicate))
    }
    agent.names.forEachIndexed { index, name -> diagnostics.addAll(validateText(name, childPath(path, "names[$index]"))) }
    return diagnostics
}

/**
 * Returns a copy of the Agent with its names canonicalized and all-default entries dropped.
 */
fun canonicalizeAgent(agent: Agent): Agent {
    return agent.copy(names = canonicalizeList(agent.names, ::canonicalizeText))
}

internal fun resolveAgents(ids: List<String>, agents: List<Agent>): List<Agent> {
    val byId = linkedMapOf<String, Agent>()
    for (agent in agents) {
        if (agent.id.isNotEmpty() && !byId.containsKey(agent.id)) {
            byId[agent.id] = agent
        }
    }
    return ids.mapNotNull { byId[it] }
}
