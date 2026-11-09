"""
Renders the C++ models and schema version into cpp/include.
"""

import posixpath

from schema import Field, Message, Package, Schema

from .common import HEADER, option, outside_refs, pascal, slashes

SCALARS = {"string": "std::string", "bool": "bool", "uint32": "std::uint32_t", "sint32": "std::int32_t"}
NAMESPACE = "gondola::lyrics::model"
INCLUDE_DIR = posixpath.join("gondola", "model")


def header_name(pkg: str) -> str:
    return posixpath.join(INCLUDE_DIR, f"{pkg}.gen.hpp")


def render_model(group: Package, version: str) -> tuple[str, str]:
    def ref(item: Message) -> str:
        return item.name if item.pkg == group.name else f"{item.pkg}::{item.name}"

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
    out += "".join(f"#include <{name}>\n" for name in ("cstdint", "map", "optional", "string", "vector"))
    outside = list(outside_refs(group))
    if outside:
        out += "\n" + "".join(f"#include <{header_name(pkg)}>\n" for pkg in outside)
    out += "\n"
    if group.name == "common":
        out += (
            f"namespace {NAMESPACE} {{\n\n"
            f'inline constexpr const char* SCHEMA_VERSION = "{version}";\n\n'
            f"}}  // namespace {NAMESPACE}\n\n"
        )

    out += f"namespace {NAMESPACE}::{group.name} {{\n\n"
    for item in group.enums:
        out += f"{slashes(item.comment)}enum class {item.name} : std::int32_t {{\n"
        for value in item.values:
            out += f"{slashes(value.comment, '  ')}  k{pascal(value.short)} = {value.number},\n"
        out += "};\n\n"
    for message in group.messages:
        out += f"{slashes(message.comment)}struct {message.name} {{\n"
        for item in message.fields:
            out += f"{slashes(item.comment, '  ')}  {field_type(item)} {item.name}{initializer(item)};\n"
        out += "};\n\n"
        # C++17 has no defaulted comparison operators.
        compare = " &&\n         ".join(f"a.{item.name} == b.{item.name}" for item in message.fields)
        signature = f"(const {message.name}& a, const {message.name}& b)"
        out += f"inline bool operator=={signature} {{\n  return {compare};\n}}\n\n"
        out += f"inline bool operator!={signature} {{ return !(a == b); }}\n\n"
    out += f"}}  // namespace {NAMESPACE}::{group.name}\n"
    return (header_name(group.name), out)


def generate(model: Schema, options: dict[str, str]) -> list[tuple[str, str]]:
    version = option(options, "version")
    return [render_model(group, version) for group in model.packages]
