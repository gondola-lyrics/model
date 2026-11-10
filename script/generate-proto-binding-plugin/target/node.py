"""
Renders the TypeScript models, internal wire codec and schema version into node/src/generated.

The models follow the layout of proto/, with an index per package.
"""

import posixpath

from schema import Enum, Field, Message, ProtoFile, Schema

from .common import HEADER, block, camel, function_name, option

SCALARS = {"string": "string", "bool": "boolean", "uint32": "number", "sint32": "number"}
ZEROS = {"string": "''", "bool": "false", "uint32": "0", "sint32": "0"}

# The methods the generated functions call, declared here so codec.gen.ts imports nothing handwritten.
WIRE_TYPES = """\
/**
 * What the generated encoders write through.
 */
export type WireWriter = {
  tag(tag: number): void
  uint32(value: number): void
  int32(value: number): void
  sint32(value: number): void
  bool(value: boolean): void
  string(value: string): void
  message<T>(tag: number, encode: (writer: WireWriter, value: T) => void, value: T): void
  map(tag: number, entries: Record<string, string>): void
}

/**
 * What the generated decoders read through.
 */
export type WireReader = {
  more(): boolean
  tag(): number
  uint32(): number
  int32(): number
  sint32(): number
  bool(): boolean
  string(): string
  enter(): number
  leave(previous: number): void
  mapEntry(target: Record<string, string>): void
  skip(): void
}

"""


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


def stem(proto_name: str) -> str:
    return posixpath.splitext(posixpath.basename(proto_name))[0]


def module_of(importer: ProtoFile, ref: Message | Enum) -> str:
    name = f"{stem(ref.file)}.gen"
    return f"./{name}" if ref.pkg == importer.pkg else f"../{ref.pkg}/{name}"


def render_imports(proto_file: ProtoFile) -> str:
    found: dict[str, set[str]] = {}
    for message in proto_file.messages:
        for item in message.fields:
            if item.ref is not None and item.ref.file != proto_file.name:
                found.setdefault(module_of(proto_file, item.ref), set()).add(item.ref.name)
    return "".join(
        f"import type {{ {', '.join(sorted(found[module]))} }} from '{module}'\n" for module in sorted(found)
    )


def render_model(proto_file: ProtoFile) -> tuple[str, str]:
    out = f"// {HEADER}\n\n"
    imports = render_imports(proto_file)
    if imports:
        out += f"{imports}\n"

    for item in proto_file.enums:
        out += f"{block(item.comment)}export enum {item.name} {{\n"
        for value in item.values:
            out += f"{block(value.comment, '  ')}  {value.short} = {value.number},\n"
        out += "}\n\n"

    for message in proto_file.messages:
        out += f"{block(message.comment)}export type {message.name} = {{\n"
        for item in message.fields:
            optional = item.shape in ("optional", "message")
            mark, suffix = ("?", " | undefined") if optional else ("", "")
            out += f"{block(item.comment, '  ')}  {camel(item.name)}{mark}: {field_type(item)}{suffix}\n"
        out += "}\n\n"

    return (posixpath.join(proto_file.pkg, f"{stem(proto_file.name)}.gen.ts"), out.rstrip() + "\n")


def render_index(model: Schema, package: str) -> tuple[str, str]:
    stems = sorted(stem(proto_file.name) for proto_file in model.files if proto_file.pkg == package)
    exports = "".join(f"export * from './{name}.gen'\n" for name in stems)
    return (posixpath.join(package, "index.gen.ts"), f"// {HEADER}\n\n{exports}")


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


def render_field_info(item: Field) -> str:
    message = f", message: {function_name('fields', item.ref)}" if item.shape in ("message", "list-message") else ""
    return f"    {{ name: '{camel(item.name)}', shape: '{item.shape}'{message} }},\n"


def render_detail(model: Schema) -> tuple[str, str]:
    out = f"// {HEADER}\n\n"
    for group in model.packages:
        out += f"import type * as {group.name} from './{group.name}/index.gen'\n"
    out += "\n"

    out += block(["One field of a structure, for the helpers that walk a structure without naming its fields."])
    out += "export type FieldInfo =\n"
    out += "  | { readonly name: string; readonly shape: 'scalar' | 'enum' | 'optional' | 'list-scalar' | 'map' }\n"
    out += "  | { readonly name: string; readonly shape: 'message' | 'list-message'; readonly message: MessageFields<any> }\n\n"
    out += block(["The fields of one structure, tied to its type so a table cannot be paired with another structure."])
    out += "export type MessageFields<T> = {\n"
    out += "  readonly fields: readonly FieldInfo[]\n  readonly phantom?: (value: T) => T\n}\n\n"

    for message in model.messages:
        type_name = f"{message.pkg}.{message.name}"
        required = [item for item in message.fields if item.shape not in ("optional", "message")]
        initial = ", ".join(f"{camel(item.name)}: {zero(item)}" for item in required)
        out += f"export const {function_name('fields', message)}: MessageFields<{type_name}> = {{\n  fields: [\n"
        out += "".join(render_field_info(item) for item in message.fields)
        out += "  ],\n}\n\n"
        out += f"export const {function_name('create', message)} = (): {type_name} => {{\n"
        out += f"  return {{ {initial} }}\n}}\n\n"
    return ("detail.gen.ts", out.rstrip() + "\n")


def render_codec(model: Schema) -> tuple[str, str]:
    out = f"// {HEADER}\n\n"
    for group in model.packages:
        out += f"import type * as {group.name} from './{group.name}/index.gen'\n"
    out += "\n"

    creates = sorted(
        {
            function_name("create", item.ref)
            for message in model.messages
            for item in message.fields
            if item.shape in ("message", "list-message")
        }
    )
    if creates:
        out += "import {\n" + "".join(f"  {name},\n" for name in creates) + "} from './detail.gen'\n\n"
    out += WIRE_TYPES

    for message in model.messages:
        type_name = f"{message.pkg}.{message.name}"
        out += f"export const {function_name('encode', message)} = (w: WireWriter, v: {type_name}): void => {{\n"
        out += "".join(render_encode(item) for item in message.by_number)
        out += "}\n\n"
        out += f"export const {function_name('decode', message)} = (r: WireReader, m: {type_name}): void => {{\n"
        out += "  while (r.more()) {\n    switch (r.tag()) {\n"
        out += "".join(render_decode(item) for item in message.by_number)
        out += "      default:\n        r.skip()\n    }\n  }\n}\n\n"
    return ("codec.gen.ts", out.rstrip() + "\n")


def render_version(version: str) -> tuple[str, str]:
    doc = block(
        [
            "Version of the Protobuf schema these bindings were generated from.",
            "Producers write it into `Lyric.version`.",
        ]
    )
    return ("version.gen.ts", f"// {HEADER}\n\n{doc}export const SCHEMA_VERSION = '{version}'\n")


def generate(model: Schema, options: dict[str, str]) -> list[tuple[str, str]]:
    return [
        *(render_model(proto_file) for proto_file in model.files),
        *(render_index(model, group.name) for group in model.packages),
        render_detail(model),
        render_codec(model),
        render_version(option(options, "version")),
    ]
