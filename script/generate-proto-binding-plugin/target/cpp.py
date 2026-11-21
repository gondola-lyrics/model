"""
Renders the C++ models and schema version into cpp/include.
"""

import posixpath

from schema import Enum, Field, Message, ProtoFile, Schema

from .common import HEADER, option, pascal, slashes

SCALARS = {"string": "std::string", "bool": "bool", "uint32": "std::uint32_t", "sint32": "std::int32_t"}
NAMESPACE = "gondola::lyrics::model"
INCLUDE_DIR = posixpath.join(NAMESPACE.replace("::", "/"), "generated")


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
    out += f"namespace {namespace} {{\n\n"
    for item in proto_file.enums:
        out += f"{slashes(item.comment)}enum class {item.name} : std::int32_t {{\n"
        for value in item.values:
            out += f"{slashes(value.comment, '  ')}  k{pascal(value.short)} = {value.number},\n"
        out += "};\n\n"
    for message in messages:
        out += f"{slashes(message.comment)}struct {message.name} {{\n"
        for item in message.fields:
            out += f"{slashes(item.comment, '  ')}  {field_type(item)} {item.name}{initializer(item)};\n"
        out += "};\n\n"
        # C++17 has no defaulted comparison operators.
        compare = " &&\n         ".join(f"a.{item.name} == b.{item.name}" for item in message.fields)
        signature = f"(const {message.name}& a, const {message.name}& b)"
        out += f"inline bool operator=={signature} {{\n  return {compare};\n}}\n\n"
        out += f"inline bool operator!={signature} {{ return !(a == b); }}\n\n"
    out += f"}}  // namespace {namespace}\n"
    return (header_name(proto_file.name), out)


def render_version(version: str) -> tuple[str, str]:
    out = f"// {HEADER}\n#pragma once\n\nnamespace {NAMESPACE} {{\n\n"
    out += f'inline constexpr const char* SCHEMA_VERSION = "{version}";\n\n'
    out += f"}}  // namespace {NAMESPACE}\n"
    return (header_name("version"), out)


def generate(model: Schema, options: dict[str, str]) -> list[tuple[str, str]]:
    messages_by_file: dict[str, list[Message]] = {}
    for message in model.messages:
        messages_by_file.setdefault(message.file, []).append(message)
    # The codec and detail headers are populated during the C++ binding migration.
    internal = [(header_name(name), f"// {HEADER}\n#pragma once\n") for name in ("codec", "detail")]
    return [
        *(render_model(proto_file, messages_by_file.get(proto_file.name, [])) for proto_file in model.files),
        render_version(option(options, "version")),
        *internal,
    ]
