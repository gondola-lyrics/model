"""
Renders the TypeScript models, wire codec functions and schema version into node/src/generated.
"""

from schema import Field, Schema

from .common import HEADER, block, camel, function_name, option, outside_refs

SCALARS = {"string": "string", "bool": "boolean", "uint32": "number", "sint32": "number"}
ZEROS = {"string": "''", "bool": "false", "uint32": "0", "sint32": "0"}

# The handwritten Writer and Reader live next to the public protobuf entry.
WIRE_MODULE = "../protobuf/wire"


def field_type(item: Field) -> str:
    if item.shape in ("scalar", "optional"):
        return SCALARS[item.scalar]
    if item.shape == "list-scalar":
        return f"{SCALARS[item.scalar]}[]"
    if item.shape == "map":
        return "Record<string, string>"
    if item.shape == "list-message":
        return f"{item.ref.name}[]"
    return item.ref.name


def zero(item: Field) -> str:
    if item.shape in ("list-scalar", "list-message"):
        return "[]"
    if item.shape == "map":
        return "{}"
    if item.shape == "enum":
        return "0"
    return ZEROS[item.scalar]


def render_models(model: Schema) -> list[tuple[str, str]]:
    files = []
    root_names = {message.name for message in model.roots}
    for group in model.packages:
        out = f"// {HEADER}\n\n"
        imports = outside_refs(group)
        if group.name != "common" and any(message.name in root_names for message in group.messages):
            imports["common"] = sorted({*imports.get("common", []), "ModelType"})
        for pkg, names in sorted(imports.items()):
            out += f"import type {{ {', '.join(names)} }} from './{pkg}.gen'\n"
        if imports:
            out += "\n"

        if group.name == "common":
            out += block(["Identifies a structure at run time, so the protobuf entry can tell which schema to use."])
            out += "export type ModelType<T> = {\n"
            out += "  readonly typeName: string\n  readonly phantom?: (value: T) => T\n}\n\n"

        for item in group.enums:
            out += f"{block(item.comment)}export enum {item.name} {{\n"
            for value in item.values:
                out += f"{block(value.comment, '  ')}  {value.short} = {value.number},\n"
            out += "}\n\n"

        for message in group.messages:
            out += f"{block(message.comment)}export type {message.name} = {{\n"
            for item in message.fields:
                optional = item.shape in ("optional", "message")
                mark, suffix = ("?", " | undefined") if optional else ("", "")
                out += f"{block(item.comment, '  ')}  {camel(item.name)}{mark}: {field_type(item)}{suffix}\n"
            out += "}\n\n"
            if message.name in root_names:
                token = f"{{ typeName: '{message.full[1:]}' }}"
                out += f"export const {message.name}: ModelType<{message.name}> = {token}\n\n"

        files.append((f"{group.name}.gen.ts", out.rstrip() + "\n"))
    return files


def render_encode(item: Field) -> str:
    name = f"v.{camel(item.name)}"
    tag = item.tag
    writer = "int32" if item.shape == "enum" else item.scalar
    put = f"w.tag({tag})\n    w.{writer}"
    if item.shape == "scalar":
        return f"  if ({name} !== {ZEROS[item.scalar]}) {{\n    {put}({name})\n  }}\n"
    if item.shape == "enum":
        return f"  if ({name} !== 0) {{\n    {put}({name})\n  }}\n"
    if item.shape == "optional":
        return f"  if ({name} !== undefined) {{\n    {put}({name})\n  }}\n"
    if item.shape == "message":
        encode = function_name("encode", item.ref)
        return f"  if ({name} !== undefined) {{\n    w.message({tag}, {encode}, {name})\n  }}\n"
    if item.shape == "list-scalar":
        return f"  for (const item of {name}) {{\n    w.tag({tag})\n    w.{item.scalar}(item)\n  }}\n"
    if item.shape == "list-message":
        encode = function_name("encode", item.ref)
        return f"  for (const item of {name}) {{\n    w.message({tag}, {encode}, item)\n  }}\n"
    return f"  w.map({tag}, {name})\n"


def render_decode(item: Field) -> str:
    name = f"m.{camel(item.name)}"
    tag = item.tag
    if item.shape in ("scalar", "optional"):
        return f"      case {tag}:\n        {name} = r.{item.scalar}()\n        break\n"
    if item.shape == "enum":
        return f"      case {tag}:\n        {name} = r.int32()\n        break\n"
    if item.shape == "list-scalar":
        return f"      case {tag}:\n        {name}.push(r.{item.scalar}())\n        break\n"
    if item.shape == "map":
        return f"      case {tag}:\n        r.mapEntry({name})\n        break\n"
    create = function_name("create", item.ref)
    decode = function_name("decode", item.ref)
    if item.shape == "message":
        return (
            f"      case {tag}: {{\n        {name} ??= {create}()\n        const end = r.enter()\n"
            f"        {decode}(r, {name})\n        r.leave(end)\n        break\n      }}\n"
        )
    return (
        f"      case {tag}: {{\n        const item = {create}()\n        const end = r.enter()\n"
        f"        {decode}(r, item)\n        r.leave(end)\n        {name}.push(item)\n        break\n      }}\n"
    )


def render_wire(model: Schema) -> tuple[str, str]:
    out = f"// {HEADER}\n\nimport type {{ Reader, Writer }} from '{WIRE_MODULE}'\n"
    for group in model.packages:
        out += f"import type * as {group.name} from './{group.name}.gen'\n"
    out += "\n"

    for message in model.messages:
        type_name = f"{message.pkg}.{message.name}"
        required = [item for item in message.fields if item.shape not in ("optional", "message")]
        initial = ", ".join(f"{camel(item.name)}: {zero(item)}" for item in required)
        out += f"export const {function_name('create', message)} = (): {type_name} => {{\n"
        out += f"  return {{ {initial} }}\n}}\n\n"
        out += f"export const {function_name('encode', message)} = (w: Writer, v: {type_name}): void => {{\n"
        out += "".join(render_encode(item) for item in message.by_number)
        out += "}\n\n"
        out += f"export const {function_name('decode', message)} = (r: Reader, m: {type_name}): void => {{\n"
        out += "  while (r.more()) {\n    switch (r.tag()) {\n"
        out += "".join(render_decode(item) for item in message.by_number)
        out += "      default:\n        r.skip()\n    }\n  }\n}\n\n"

    out += block(["Codec functions of each structure token, keyed by its type name."])
    out += "export const CODECS = {\n"
    for root in model.roots:
        functions = ", ".join(f"{verb}: {function_name(verb, root)}" for verb in ("create", "encode", "decode"))
        out += f"  '{root.full[1:]}': {{ {functions} }},\n"
    out += "}\n"
    return ("wire.gen.ts", out)


def render_version(version: str) -> tuple[str, str]:
    doc = block(
        [
            "Version of the Protobuf schema these bindings were generated from.",
            "Producers write it into `Lyric.version`.",
        ]
    )
    return ("version.gen.ts", f"// {HEADER}\n\n{doc}export const SCHEMA_VERSION = '{version}'\n")


def generate(model: Schema, options: dict[str, str]) -> list[tuple[str, str]]:
    return [*render_models(model), render_wire(model), render_version(option(options, "version"))]
