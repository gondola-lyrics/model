"""
Renders the Kotlin models, internal wire codec functions and schema version into kotlin/src/generated/kotlin.

Model files follow the proto layout while keeping their existing package names.
"""

import posixpath

from schema import Enum, Field, Message, ProtoFile, Schema

from .common import HEADER, block, camel, function_name, option, upper_first

SCALARS = {"string": "String", "bool": "Boolean", "uint32": "Long", "sint32": "Int"}
DEFAULTS = {"string": '""', "bool": "false", "uint32": "0", "sint32": "0"}
ZEROS = {"string": '""', "bool": "false", "uint32": "0L", "sint32": "0"}

WIRE_TYPES = """\
/**
 * The operations used by the generated encoders, independent of the buffer implementation.
 */
internal interface WireWriter {
    fun tag(value: Int)
    fun uint32(value: Long)
    fun int32(value: Int)
    fun sint32(value: Int)
    fun bool(value: Boolean)
    fun string(value: String)
    fun <T> message(tag: Int, encode: (WireWriter, T) -> Unit, value: T)
    fun stringMap(tag: Int, entries: Map<String, String>)
}

/**
 * The operations used by the generated decoders, confined to the current message range.
 */
internal interface WireReader {
    fun more(): Boolean
    fun tag(): Int
    fun uint32(): Long
    fun int32(): Int
    fun sint32(): Int
    fun bool(): Boolean
    fun string(): String
    fun enter(): Int
    fun leave(previous: Int)
    fun mapEntry(target: MutableMap<String, String>)
    fun skip()
}

"""


def field_type(item: Field) -> str:
    if item.shape == "scalar":
        return SCALARS[item.scalar]
    if item.shape == "optional":
        return f"{SCALARS[item.scalar]}?"
    if item.shape == "list-scalar":
        return f"List<{SCALARS[item.scalar]}>"
    if item.shape == "map":
        return "Map<String, String>"
    if item.shape == "list-message":
        return f"List<{item.ref.name}>"
    if item.shape == "message":
        return f"{item.ref.name}?"
    return item.ref.name


def fallback(item: Field) -> str:
    if item.shape == "scalar":
        return DEFAULTS[item.scalar]
    if item.shape in ("list-scalar", "list-message"):
        return "emptyList()"
    if item.shape == "map":
        return "emptyMap()"
    if item.shape == "enum":
        return f"{item.ref.name}.{item.ref.zero.name}"
    return "null"


def render_enum(item: Enum) -> str:
    out = f"{block(item.comment)}public class {item.name}(@JvmField public val value: Int) {{\n"
    out += f"    override fun equals(other: Any?): Boolean {{\n        return other is {item.name} && other.value == value\n    }}\n\n"
    out += "    override fun hashCode(): Int {\n        return value\n    }\n\n"
    out += "    override fun toString(): String {\n        return when (value) {\n"
    for value in item.values:
        out += f'            {value.number} -> "{value.name}"\n'
    out += f'            else -> "{item.name}($value)"\n        }}\n    }}\n\n    public companion object {{\n'
    for value in item.values:
        constant = f"@JvmField public val {value.name}: {item.name} = {item.name}({value.number})"
        out += f"{block(value.comment, '        ')}        {constant}\n"
    out += "    }\n}\n\n"
    return out


def render_model(proto_file: ProtoFile, package: str) -> tuple[str, str]:
    out = f"// {HEADER}\n\npackage {package}.{proto_file.pkg}\n\n"
    imports = {
        f"import {package}.{item.ref.pkg}.{item.ref.name}\n"
        for message in proto_file.messages
        for item in message.fields
        if item.ref is not None and item.ref.pkg != proto_file.pkg
    }
    if imports:
        out += "".join(sorted(imports)) + "\n"
    out += "".join(render_enum(item) for item in proto_file.enums)
    for message in proto_file.messages:
        out += f"{block(message.comment)}public data class {message.name}(\n"
        for item in message.fields:
            parameter = f"val {camel(item.name)}: {field_type(item)} = {fallback(item)}"
            out += f"{block(item.comment, '    ')}    {parameter},\n"
        out += ")\n\n"
    stem = upper_first(posixpath.splitext(posixpath.basename(proto_file.name))[0])
    return (posixpath.join(*package.split("."), proto_file.pkg, f"{stem}.gen.kt"), out.rstrip() + "\n")


def alias(item: Message | Enum) -> str:
    return f"{upper_first(item.pkg)}{item.name}"


def render_encode(item: Field) -> str:
    name = f"src.{camel(item.name)}"
    tag = item.tag
    if item.shape == "scalar":
        if item.scalar == "bool":
            check = name
        elif item.scalar == "string":
            check = f"{name}.isNotEmpty()"
        else:
            check = f"{name} != {ZEROS[item.scalar]}"
        return f"    if ({check}) {{\n        w.tag({tag})\n        w.{item.scalar}({name})\n    }}\n"
    if item.shape == "enum":
        return f"    if ({name}.value != 0) {{\n        w.tag({tag})\n        w.int32({name}.value)\n    }}\n"
    if item.shape == "optional":
        return f"    {name}?.let {{\n        w.tag({tag})\n        w.{item.scalar}(it)\n    }}\n"
    if item.shape == "list-scalar":
        return f"    for (item in {name}) {{\n        w.tag({tag})\n        w.{item.scalar}(item)\n    }}\n"
    if item.shape == "map":
        return f"    w.stringMap({tag}, {name})\n"
    encode = function_name("encode", item.ref)
    if item.shape == "message":
        return f"    {name}?.let {{ w.message({tag}, ::{encode}, it) }}\n"
    return f"    for (item in {name}) {{\n        w.message({tag}, ::{encode}, item)\n    }}\n"


def render_state_field(item: Field) -> str:
    name = camel(item.name)
    if item.shape == "scalar":
        return f"    var {name}: {SCALARS[item.scalar]} = {ZEROS[item.scalar]}\n"
    if item.shape == "optional":
        return f"    var {name}: {SCALARS[item.scalar]}? = null\n"
    if item.shape == "enum":
        return f"    var {name}: {alias(item.ref)} = {alias(item.ref)}.{item.ref.zero.name}\n"
    if item.shape == "message":
        return f"    var {name}: {alias(item.ref)}State? = null\n"
    if item.shape == "map":
        return f"    val {name} = LinkedHashMap<String, String>()\n"
    element = SCALARS[item.scalar] if item.shape == "list-scalar" else f"{alias(item.ref)}State"
    return f"    val {name} = ArrayList<{element}>()\n"


def render_finish_field(item: Field) -> str:
    name = camel(item.name)
    value = name
    if item.shape == "message":
        value += "?.finish()"
    elif item.shape == "list-message":
        value += ".map { it.finish() }"
    return f"            {name} = {value},\n"


def render_case(item: Field) -> str:
    tag = item.tag
    name = f"state.{camel(item.name)}"
    if item.shape in ("scalar", "optional"):
        return f"            {tag} -> {name} = r.{item.scalar}()\n"
    if item.shape == "enum":
        return f"            {tag} -> {name} = {alias(item.ref)}(r.int32())\n"
    if item.shape == "list-scalar":
        return f"            {tag} -> {name}.add(r.{item.scalar}())\n"
    if item.shape == "map":
        return f"            {tag} -> r.mapEntry({name})\n"
    state = f"{alias(item.ref)}State()"
    create = f"{name} ?: {state}.also {{ {name} = it }}" if item.shape == "message" else state
    append = f"                {name}.add(item)\n" if item.shape == "list-message" else ""
    return (
        f"            {tag} -> {{\n                val item = {create}\n                val end = r.enter()\n"
        f"                {function_name('merge', item.ref)}(r, item)\n                r.leave(end)\n"
        f"{append}            }}\n"
    )


def render_codec(model: Schema, package: str) -> tuple[str, str]:
    imports = sorted(
        f"import {package}.{item.pkg}.{item.name} as {alias(item)}" for item in [*model.messages, *model.enums]
    )
    out = f'// {HEADER}\n\n@file:JvmName("CodecGen")\n\npackage {package}.utils\n\n'
    out += "\n".join(imports) + "\n\n"
    out += WIRE_TYPES
    for message in model.messages:
        out += (
            f"@JvmSynthetic\ninternal fun {function_name('encode', message)}(w: WireWriter, src: {alias(message)}) {{\n"
        )
        out += "".join(render_encode(item) for item in message.by_number)
        out += "}\n\n"

    out += block(["Decode state keeps repeated submessages merging in place until the root is complete."])
    for message in model.messages:
        out += f"private class {alias(message)}State {{\n"
        out += "".join(render_state_field(item) for item in message.fields)
        out += f"\n    fun finish(): {alias(message)} {{\n        return {alias(message)}(\n"
        out += "".join(render_finish_field(item) for item in message.fields)
        out += "        )\n    }\n}\n\n"

    for message in model.messages:
        out += f"private fun {function_name('merge', message)}(r: WireReader, state: {alias(message)}State) {{\n"
        out += "    while (r.more()) {\n        when (r.tag()) {\n"
        out += "".join(render_case(item) for item in message.by_number)
        out += "            else -> r.skip()\n        }\n    }\n}\n\n"
        out += f"@JvmSynthetic\ninternal fun {function_name('decode', message)}(r: WireReader): {alias(message)} {{\n"
        out += f"    val state = {alias(message)}State()\n    {function_name('merge', message)}(r, state)\n"
        out += "    return state.finish()\n}\n\n"
    return (posixpath.join(*package.split("."), "utils", "Codec.gen.kt"), out.rstrip() + "\n")


def default_check(item: Field) -> str:
    name = f"message.{camel(item.name)}"
    if item.shape == "scalar":
        return f"{name} == {ZEROS[item.scalar]}"
    if item.shape == "enum":
        return f"{name}.value == 0"
    if item.shape in ("message", "optional"):
        return f"{name} == null"
    return f"{name}.isEmpty()"


def render_detail(model: Schema, package: str) -> tuple[str, str]:
    imports = sorted(
        f"import {package}.{item.pkg}.{item.name} as {alias(item)}" for item in [*model.messages, *model.enums]
    )
    out = f'// {HEADER}\n\n@file:JvmName("DetailGen")\n\npackage {package}.utils\n\n'
    out += "\n".join(imports) + "\n\n"
    out += "internal enum class FieldShape { SCALAR, ENUM, OPTIONAL, MESSAGE, LIST_SCALAR, LIST_MESSAGE, MAP }\n\n"
    out += block(["Reports defaults without treating an explicitly present zero as an absent field."])
    out += "@JvmSynthetic\ninternal fun isDefault(message: Any): Boolean {\n    return when (message) {\n"
    for message in model.messages:
        checks = " &&\n            ".join(default_check(item) for item in message.fields) or "true"
        out += f"        is {alias(message)} -> {checks}\n"
    out += "        else -> false\n    }\n}\n\n"

    out += block(["Visits declared fields without reflection or a dependency on the codec."])
    out += "@JvmSynthetic\ninternal fun visitFields(message: Any, visit: (String, FieldShape, Any?) -> Unit) {\n"
    out += "    when (message) {\n"
    for message in model.messages:
        out += f"        is {alias(message)} -> {{\n"
        for item in message.fields:
            name = camel(item.name)
            shape = item.shape.replace("-", "_").upper()
            out += f'            visit("{name}", FieldShape.{shape}, message.{name})\n'
        out += "        }\n"
    out += "    }\n}\n\n"

    out += block(["Reads diagnostic fields, exposing enum numbers and preserving optional presence."])
    out += "@JvmSynthetic\ninternal fun readField(message: Any, name: String): Any? {\n    return when (message) {\n"
    for message in model.messages:
        out += f"        is {alias(message)} -> when (name) {{\n"
        for item in message.fields:
            name = camel(item.name)
            suffix = ".value" if item.shape == "enum" else ""
            out += f'            "{name}" -> message.{name}{suffix}\n'
        out += "            else -> null\n        }\n"
    out += "        else -> null\n    }\n}\n\n"

    out += block(["Treats zero and values unknown to this schema as unresolved without discarding their numbers."])
    out += "@JvmSynthetic\ninternal fun isUnresolved(value: Any): Boolean {\n    return when (value) {\n"
    for item in model.enums:
        checks = " && ".join(f"value.value != {entry.number}" for entry in item.values if entry.number != 0) or "true"
        out += f"        is {alias(item)} -> {checks}\n"
    out += "        else -> false\n    }\n}\n"
    return (posixpath.join(*package.split("."), "utils", "Detail.gen.kt"), out)


def render_version(package: str, version: str) -> tuple[str, str]:
    doc = block(
        [
            "Version of the Protobuf schema used to generate these bindings.",
            "",
            "Producers write this value into the lyric's version field.",
        ]
    )
    # Keep the facade class name of the former build-generated Version.kt so Java callers do not change.
    out = f'// {HEADER}\n\n@file:JvmName("VersionKt")\n\npackage {package}\n\n'
    out += f'{doc}public const val SCHEMA_VERSION: String = "{version}"\n'
    return (posixpath.join(*package.split("."), "Version.gen.kt"), out)


def generate(model: Schema, options: dict[str, str]) -> list[tuple[str, str]]:
    package = option(options, "package")
    version = option(options, "version")
    return [
        render_version(package, version),
        *(render_model(proto_file, package) for proto_file in model.files),
        render_codec(model, package),
        render_detail(model, package),
    ]
