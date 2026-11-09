"""
Renders the Kotlin models, internal wire codec functions and schema version into kotlin/src/main/kotlin.
"""

import posixpath

from schema import Enum, Field, Message, Schema

from .common import HEADER, block, camel, function_name, option, outside_refs, upper_first

SCALARS = {"string": "String", "bool": "Boolean", "uint32": "Long", "sint32": "Int"}
DEFAULTS = {"string": '""', "bool": "false", "uint32": "0", "sint32": "0"}
ZEROS = {"string": '""', "bool": "false", "uint32": "0L", "sint32": "0"}


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
    out += f"    override fun equals(other: Any?): Boolean = other is {item.name} && other.value == value\n\n"
    out += "    override fun hashCode(): Int = value\n\n"
    out += "    override fun toString(): String = when (value) {\n"
    for value in item.values:
        out += f'        {value.number} -> "{value.name}"\n'
    out += f'        else -> "{item.name}($value)"\n    }}\n\n    public companion object {{\n'
    for value in item.values:
        constant = f"@JvmField public val {value.name}: {item.name} = {item.name}({value.number})"
        out += f"{block(value.comment, '        ')}        {constant}\n"
    out += "    }\n}\n\n"
    return out


def render_models(model: Schema, package: str) -> list[tuple[str, str]]:
    files = []
    for group in model.packages:
        out = f"// {HEADER}\npackage {package}.{group.name}\n\n"
        imports = [f"import {package}.{pkg}.{name}\n" for pkg, names in outside_refs(group).items() for name in names]
        if imports:
            out += "".join(sorted(imports)) + "\n"
        out += "".join(render_enum(item) for item in group.enums)
        for message in group.messages:
            out += f"{block(message.comment)}public data class {message.name}(\n"
            for item in message.fields:
                parameter = f"val {camel(item.name)}: {field_type(item)} = {fallback(item)}"
                out += f"{block(item.comment, '    ')}    {parameter},\n"
            out += ")\n\n"
        files.append((posixpath.join(*package.split("."), group.name, "Model.gen.kt"), out.rstrip() + "\n"))
    return files


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
        return f"    {name}?.let {{ item -> w.message({tag}) {{ {encode}(it, item) }} }}\n"
    return f"    for (item in {name}) {{\n        w.message({tag}) {{ {encode}(it, item) }}\n    }}\n"


def local(item: Field) -> str:
    return f"{camel(item.name)}Field"


def render_local(item: Field) -> str:
    name = camel(item.name)
    if item.shape == "scalar":
        return f"    var {local(item)}: {SCALARS[item.scalar]} = base?.{name} ?: {ZEROS[item.scalar]}\n"
    if item.shape == "optional":
        return f"    var {local(item)}: {SCALARS[item.scalar]}? = base?.{name}\n"
    if item.shape == "enum":
        return f"    var {local(item)}: {alias(item.ref)} = base?.{name} ?: {alias(item.ref)}.{item.ref.zero.name}\n"
    if item.shape == "message":
        return f"    var {local(item)}: {alias(item.ref)}? = base?.{name}\n"
    if item.shape == "map":
        container = "LinkedHashMap<String, String>()"
        return f"    val {local(item)} = {container}\n    base?.let {{ {local(item)}.putAll(it.{name}) }}\n"
    element = SCALARS[item.scalar] if item.shape == "list-scalar" else alias(item.ref)
    return f"    val {local(item)} = ArrayList<{element}>()\n    base?.let {{ {local(item)}.addAll(it.{name}) }}\n"


def render_case(item: Field) -> str:
    tag = item.tag
    if item.shape in ("scalar", "optional"):
        return f"            {tag} -> {local(item)} = r.{item.scalar}()\n"
    if item.shape == "enum":
        return f"            {tag} -> {local(item)} = {alias(item.ref)}(r.int32())\n"
    if item.shape == "list-scalar":
        return f"            {tag} -> {local(item)}.add(r.{item.scalar}())\n"
    if item.shape == "map":
        return f"            {tag} -> r.mapEntry({local(item)})\n"
    decode = function_name("decode", item.ref)
    # A repeated single message merges into the value decoded so far, as the wire format requires.
    value = f"{decode}(r, {local(item)})" if item.shape == "message" else f"{decode}(r, null)"
    store = f"{local(item)} = {value}" if item.shape == "message" else f"{local(item)}.add({value})"
    return (
        f"            {tag} -> {{\n                val end = r.enter()\n"
        f"                {store}\n                r.leave(end)\n            }}\n"
    )


def render_wire(model: Schema, package: str) -> tuple[str, str]:
    imports = sorted(
        f"import {package}.{item.pkg}.{item.name} as {alias(item)}" for item in [*model.messages, *model.enums]
    )
    out = f'// {HEADER}\n@file:JvmName("WireGen")\n\npackage {package}.protobuf\n\n'
    out += "\n".join(imports) + "\n\n"
    for message in model.messages:
        out += f"internal fun {function_name('encode', message)}(w: Writer, src: {alias(message)}) {{\n"
        out += "".join(render_encode(item) for item in message.by_number)
        out += "}\n\n"
        decode = function_name("decode", message)
        out += f"internal fun {decode}(r: Reader, base: {alias(message)}?): {alias(message)} {{\n"
        out += "".join(render_local(item) for item in message.by_number)
        out += "    while (r.more()) {\n        when (r.tag()) {\n"
        out += "".join(render_case(item) for item in message.by_number)
        out += f"            else -> r.skip()\n        }}\n    }}\n    return {alias(message)}(\n"
        out += "".join(f"        {camel(item.name)} = {local(item)},\n" for item in message.by_number)
        out += "    )\n}\n\n"
    return (posixpath.join(*package.split("."), "protobuf", "Wire.gen.kt"), out.rstrip() + "\n")


def render_version(package: str, version: str) -> tuple[str, str]:
    doc = block(
        [
            "Version of the Protobuf schema used to generate these bindings.",
            "",
            "Producers write this value into the lyric's version field.",
        ]
    )
    # Keep the facade class name of the former build-generated Version.kt so Java callers do not change.
    out = f'// {HEADER}\n@file:JvmName("VersionKt")\n\npackage {package}\n\n'
    out += f'{doc}public const val SCHEMA_VERSION: String = "{version}"\n'
    return (posixpath.join(*package.split("."), "Version.gen.kt"), out)


def generate(model: Schema, options: dict[str, str]) -> list[tuple[str, str]]:
    package = option(options, "package")
    version = option(options, "version")
    return [render_version(package, version), *render_models(model, package), render_wire(model, package)]
