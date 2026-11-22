"""
Renders C++ model headers and private wire codecs.
"""

import posixpath

from schema import Enum, Field, Message, ProtoFile, Schema

from .common import HEADER, function_name, option, pascal, slashes

SCALARS = {"string": "std::string", "bool": "bool", "uint32": "std::uint32_t", "sint32": "std::int32_t"}
NAMESPACE = "gondola::lyrics::model"
INCLUDE_DIR = posixpath.join(NAMESPACE.replace("::", "/"), "generated")
CODEC_DIR = "src/utils"
UTILS_NAMESPACE = f"{NAMESPACE}::utils"
GENERATED_NAMESPACE = f"{UTILS_NAMESPACE}::generated"
WIRE_METHODS = {"string": "string", "bool": "boolean", "uint32": "uint32", "sint32": "sint32"}
WIRE_ROOTS = {("document", "Lyric"), ("enriched", "Lyric")}
# Generated files bypass clang-format, so these widths follow cpp/.clang-format.
COLUMN_LIMIT = 180
TAB_WIDTH = 8
INDENT = "\t"


def header_name(path: str) -> str:
    stem = posixpath.splitext(path)[0]
    return posixpath.join(INCLUDE_DIR, f"{stem}.gen.hpp")


def render_includes(proto_file: ProtoFile) -> str:
    standard = {"cstdint"} if proto_file.enums else set()
    dependencies = set()
    for message in proto_file.messages:
        for item in message.fields:
            if item.scalar in ("uint32", "sint32"):
                standard.add("cstdint")
            if item.scalar == "string":
                standard.add("string")
            if item.shape in ("optional", "message"):
                standard.add("optional")
            if item.shape in ("list-scalar", "list-message"):
                standard.add("vector")
            if item.shape == "map":
                standard.update(("map", "string"))
            if item.ref is not None and item.ref.file != proto_file.name:
                dependencies.add(header_name(item.ref.file))
    blocks = ["".join(f"#include <{name}>\n" for name in sorted(group)) for group in (standard, dependencies) if group]
    return "\n".join(blocks)


def render_comparison(message: Message) -> str:
    comparisons = [f"a.{item.name} == b.{item.name}" for item in message.fields]
    if not comparisons:
        return "\t\treturn true;\n"
    lines = []
    line = "\t\treturn "
    for index, comparison in enumerate(comparisons):
        suffix = ";" if index + 1 == len(comparisons) else " &&"
        separator = " " if line.endswith(" &&") else ""
        if len((line + separator + comparison + suffix).expandtabs(TAB_WIDTH)) > COLUMN_LIMIT and line.endswith(" &&"):
            lines.append(line)
            line = "\t\t\t"
            separator = ""
        line += separator + comparison + suffix
    lines.append(line)
    return "\n".join(lines) + "\n"


def render_model(proto_file: ProtoFile, messages: list[Message]) -> tuple[str, str]:
    def ref(item: Message | Enum) -> str:
        return item.name if item.pkg == proto_file.pkg else f"{item.pkg}::{item.name}"

    def field_type(item: Field) -> str:
        if item.shape == "scalar":
            return SCALARS[item.scalar]
        if item.shape == "optional":
            return f"std::optional<{SCALARS[item.scalar]}>"
        if item.shape == "list-scalar":
            return f"std::vector<{SCALARS[item.scalar]}>"
        if item.shape == "map":
            return "std::map<std::string, std::string>"
        if item.shape == "list-message":
            return f"std::vector<{ref(item.ref)}>"
        if item.shape == "message":
            return f"std::optional<{ref(item.ref)}>"
        return ref(item.ref)

    def initializer(item: Field) -> str:
        if item.shape == "enum":
            return f" = {ref(item.ref)}::k{pascal(item.ref.zero.short)}"
        if item.shape == "scalar" and item.scalar == "bool":
            return " = false"
        if item.shape == "scalar" and item.scalar != "string":
            return " = 0"
        return ""

    out = f"// {HEADER}\n#pragma once\n\n"
    includes = render_includes(proto_file)
    if includes:
        out += f"{includes}\n"
    namespace = f"{NAMESPACE}::{proto_file.pkg}"
    out += f"namespace {namespace} {{\n"
    for item in proto_file.enums:
        out += f"{slashes(item.comment, INDENT)}\tenum class {item.name} : std::int32_t {{\n"
        for value in item.values:
            out += f"{slashes(value.comment, INDENT * 2)}\t\tk{pascal(value.short)} = {value.number},\n"
        out += "\t};\n\n"
    for message in messages:
        out += f"{slashes(message.comment, INDENT)}\tstruct {message.name} {{\n"
        for item in message.fields:
            out += f"{slashes(item.comment, INDENT * 2)}\t\t{field_type(item)} {item.name}{initializer(item)};\n"
        out += "\t};\n\n"
        # C++17 has no defaulted comparison operators.
        signature = f"(const {message.name}& a, const {message.name}& b)"
        out += f"\tinline bool operator=={signature} {{\n{render_comparison(message)}\t}}\n\n"
        out += f"\tinline bool operator!={signature} {{\n\t\treturn !(a == b);\n\t}}\n\n"
    out = out.rstrip() + f"\n}} // namespace {namespace}\n"
    return (posixpath.join("include", header_name(proto_file.name)), out)


def render_version(version: str) -> tuple[str, str]:
    out = f"// {HEADER}\n#pragma once\n\nnamespace {NAMESPACE} {{\n"
    out += f'\tinline constexpr const char* SCHEMA_VERSION = "{version}";\n'
    out += f"}} // namespace {NAMESPACE}\n"
    return (posixpath.join("include", header_name("version")), out)


def checked(call: str, indent: str, condition: str = "") -> str:
    test = f"{condition} && !{call}" if condition else f"!{call}"
    return f"{indent}if ({test}) {{\n{indent}\treturn false;\n{indent}}}\n"


def render_encode(item: Field) -> str:
    name = f"value.{item.name}"
    tag = item.tag
    if item.shape == "map":
        return checked(f"w.stringMap({tag}, {name})", "\t\t")
    if item.shape == "enum":
        number = f"static_cast<std::int32_t>({name})"
        return checked(f"w.int32({tag}, {number})", "\t\t", f"{number} != 0")
    if item.shape in ("message", "list-message"):
        encode = function_name("encode", item.ref)
        if item.shape == "message":
            return checked(f"w.message({tag}, *{name}, {encode})", "\t\t", name)
        call = f"w.message({tag}, element, {encode})"
    else:
        method = WIRE_METHODS[item.scalar]
        if item.shape == "scalar":
            condition = {
                "string": f"!{name}.empty()",
                "bool": name,
                "uint32": f"{name} != 0",
                "sint32": f"{name} != 0",
            }[item.scalar]
            return checked(f"w.{method}({tag}, {name})", "\t\t", condition)
        if item.shape == "optional":
            return checked(f"w.{method}({tag}, *{name})", "\t\t", name)
        call = f"w.{method}({tag}, element)"
    return f"\t\tfor (const auto& element : {name}) {{\n{checked(call, INDENT * 3)}\t\t}}\n"


def render_decode(item: Field) -> str:
    name = f"value.{item.name}"
    tag = item.tag
    if item.shape == "map":
        call = f"r.stringMapEntry({name})"
    elif item.shape == "enum":
        call = f"r.enumValue({name})"
    elif item.shape in ("message", "list-message"):
        decode = function_name("decode", item.ref)
        target = f"{name}.emplace_back()" if item.shape == "list-message" else name
        call = f"r.message({target}, {decode})"
    else:
        method = WIRE_METHODS[item.scalar]
        if item.shape == "list-scalar":
            out = f"\t\t\tcase {tag}: {{\n\t\t\t\t{SCALARS[item.scalar]} element;\n"
            out += checked(f"r.{method}(element)", "\t\t\t\t")
            return out + f"\t\t\t\t{name}.push_back(std::move(element));\n\t\t\t\tbreak;\n\t\t\t}}\n"
        target = f"{name}.emplace()" if item.shape == "optional" else name
        call = f"r.{method}({target})"
    return f"\t\t\tcase {tag}:\n{checked(call, INDENT * 4)}\t\t\t\tbreak;\n"


def codec_signatures(message: Message) -> tuple[str, str]:
    type_name = f"{message.pkg}::{message.name}"
    encode = function_name("encode", message)
    decode = function_name("decode", message)
    return (
        f"bool {encode}(Writer& w, const {type_name}& value)",
        f"bool {decode}(Reader& r, {type_name}& value)",
    )


def render_codec(model: Schema) -> tuple[str, str]:
    out = f"// {HEADER}\n\n#include <cstdint>\n#include <utility>\n\n"
    out += "".join(f"#include <{header_name(file.name)}>\n" for file in sorted(model.files, key=lambda file: file.name))
    out += f'\n#include "detail.gen.hpp"\n#include "utils/wire.hpp"\n\nnamespace {GENERATED_NAMESPACE} {{\n'
    for message in model.messages:
        linkage = "" if (message.pkg, message.name) in WIRE_ROOTS else "static "
        encode, decode = codec_signatures(message)

        out += f"\t{linkage}{encode} {{\n"
        out += "".join(render_encode(item) for item in message.by_number)
        out += "\t\treturn true;\n\t}\n\n"

        out += f"\t{linkage}{decode} {{\n"
        out += "\t\twhile (!r.empty()) {\n\t\t\tstd::uint32_t tag;\n"
        out += checked("r.tag(tag)", "\t\t\t")
        out += "\t\t\tswitch (tag) {\n"
        out += "".join(render_decode(item) for item in message.by_number)
        out += f"\t\t\tdefault:\n{checked('r.skip(tag)', INDENT * 4)}"
        out += "\t\t\t}\n\t\t}\n\t\treturn true;\n\t}\n\n"
    out = out.rstrip() + f"\n}} // namespace {GENERATED_NAMESPACE}\n"
    return (posixpath.join(CODEC_DIR, "codec.gen.cpp"), out)


def render_detail(model: Schema) -> tuple[str, str]:
    roots = [message for message in model.messages if (message.pkg, message.name) in WIRE_ROOTS]
    out = f"// {HEADER}\n#pragma once\n\n"
    for message in roots:
        namespace = f"{NAMESPACE}::{message.pkg}"
        out += f"namespace {namespace} {{\n\tstruct {message.name};\n}} // namespace {namespace}\n\n"
    out += f"namespace {UTILS_NAMESPACE} {{\n\tclass Reader;\n\tclass Writer;\n"
    out += f"}} // namespace {UTILS_NAMESPACE}\n\n"
    out += f"namespace {GENERATED_NAMESPACE} {{\n"
    for message in roots:
        encode, decode = codec_signatures(message)
        out += f"\t{encode};\n\t{decode};\n\n"
    out = out.rstrip() + f"\n}} // namespace {GENERATED_NAMESPACE}\n"
    return (posixpath.join(CODEC_DIR, "detail.gen.hpp"), out)


def generate(model: Schema, options: dict[str, str]) -> list[tuple[str, str]]:
    messages_by_file: dict[str, list[Message]] = {}
    for message in model.messages:
        messages_by_file.setdefault(message.file, []).append(message)
    return [
        *(render_model(proto_file, messages_by_file.get(proto_file.name, [])) for proto_file in model.files),
        render_version(option(options, "version")),
        render_codec(model),
        render_detail(model),
    ]
