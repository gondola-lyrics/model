"""
Renders the Go models and internal wire codec functions into the go module.
"""

import posixpath
import re

from schema import Field, Message, Package, Schema

from .common import HEADER, function_name, option, outside_refs, pascal, slashes

TAB = "\t"
SCALARS = {"string": "string", "bool": "bool", "uint32": "uint32", "sint32": "int32"}
ZEROS = {"string": '""', "uint32": "0", "sint32": "0"}


def go_name(name: str) -> str:
    # Go spells initialisms in one case.
    return re.sub(r"^Ids$", "IDs", re.sub(r"^Id$", "ID", pascal(name)))


def render_imports(module: str, packages: list[str]) -> str:
    if not packages:
        return ""
    if len(packages) == 1:
        return f'import "{posixpath.join(module, packages[0])}"\n\n'
    lines = "".join(f'\t"{posixpath.join(module, pkg)}"\n' for pkg in packages)
    return f"import (\n{lines})\n\n"


def render_model(group: Package, module: str, version: str) -> tuple[str, str]:
    def ref(item: Message) -> str:
        return item.name if item.pkg == group.name else f"{item.pkg}.{item.name}"

    def field_type(item: Field) -> str:
        if item.shape == "scalar":
            return SCALARS[item.scalar]
        if item.shape == "optional":
            return f"*{SCALARS[item.scalar]}"
        if item.shape == "list-scalar":
            return f"[]{SCALARS[item.scalar]}"
        if item.shape == "map":
            return "map[string]string"
        if item.shape == "list-message":
            return f"[]{ref(item.ref)}"
        if item.shape == "message":
            return f"*{ref(item.ref)}"
        return ref(item.ref)

    out = f"// {HEADER}\n\npackage {group.name}\n\n"
    out += render_imports(module, list(outside_refs(group)))
    if group.name == "common":
        out += "// SchemaVersion is the schema version these types were generated from.\n"
        out += f'const SchemaVersion = "{version}"\n\n'
    for item in group.enums:
        out += f"{slashes(item.comment)}type {item.name} int32\n\nconst (\n"
        for value in item.values:
            out += f"{slashes(value.comment, TAB)}\t{item.name}{pascal(value.short)} {item.name} = {value.number}\n"
        out += ")\n\n"
    for message in group.messages:
        out += f"{slashes(message.comment)}type {message.name} struct {{\n"
        for item in message.fields:
            out += f"{slashes(item.comment, TAB)}\t{go_name(item.name)} {field_type(item)}\n"
        out += "}\n\n"
    return (posixpath.join(group.name, "model_gen.go"), out.rstrip() + "\n")


def render_encode(item: Field) -> str:
    name = f"v.{go_name(item.name)}"
    tag = item.tag
    if item.shape == "scalar":
        check = name if item.scalar == "bool" else f"{name} != {ZEROS[item.scalar]}"
        return f"\tif {check} {{\n\t\tw.tag({tag})\n\t\tw.{item.scalar}({name})\n\t}}\n"
    if item.shape == "enum":
        return f"\tif {name} != 0 {{\n\t\tw.tag({tag})\n\t\tw.int32(int32({name}))\n\t}}\n"
    if item.shape == "optional":
        return f"\tif {name} != nil {{\n\t\tw.tag({tag})\n\t\tw.{item.scalar}(*{name})\n\t}}\n"
    if item.shape == "list-scalar":
        return f"\tfor _, item := range {name} {{\n\t\tw.tag({tag})\n\t\tw.{item.scalar}(item)\n\t}}\n"
    if item.shape == "map":
        return f"\tw.stringMap({tag}, {name})\n"
    encode = function_name("encode", item.ref)
    if item.shape == "message":
        return f"\tif {name} != nil {{\n\t\tmessage(w, {tag}, {encode}, {name})\n\t}}\n"
    return f"\tfor i := range {name} {{\n\t\tmessage(w, {tag}, {encode}, &{name}[i])\n\t}}\n"


def render_decode(item: Field) -> str:
    name = f"m.{go_name(item.name)}"
    out = f"\t\tcase {item.tag}:\n"
    if item.shape == "scalar":
        return out + f"\t\t\t{name} = r.{item.scalar}()\n"
    if item.shape == "enum":
        return out + f"\t\t\t{name} = {item.ref.pkg}.{item.ref.name}(r.int32())\n"
    if item.shape == "optional":
        return out + f"\t\t\tvalue := r.{item.scalar}()\n\t\t\t{name} = &value\n"
    if item.shape == "list-scalar":
        return out + f"\t\t\t{name} = append({name}, r.{item.scalar}())\n"
    if item.shape == "map":
        return out + f"\t\t\t{name} = r.mapEntry({name})\n"
    ref = f"{item.ref.pkg}.{item.ref.name}"
    decode = function_name("decode", item.ref)
    if item.shape == "message":
        out += f"\t\t\tif {name} == nil {{\n\t\t\t\t{name} = new({ref})\n\t\t\t}}\n"
        return out + f"\t\t\tend := r.enter()\n\t\t\t{decode}(r, {name})\n\t\t\tr.leave(end)\n"
    out += f"\t\t\t{name} = append({name}, {ref}{{}})\n"
    return out + f"\t\t\tend := r.enter()\n\t\t\t{decode}(r, &{name}[len({name})-1])\n\t\t\tr.leave(end)\n"


def render_wire(model: Schema, module: str) -> tuple[str, str]:
    used = {message.pkg for message in model.messages}
    used |= {item.ref.pkg for message in model.messages for item in message.fields if item.shape == "enum"}
    out = f"// {HEADER}\n\npackage protobuf\n\n"
    out += render_imports(module, [group.name for group in model.packages if group.name in used])
    for message in model.messages:
        type_name = f"{message.pkg}.{message.name}"
        out += f"func {function_name('encode', message)}(w *writer, v *{type_name}) {{\n"
        out += "".join(render_encode(item) for item in message.by_number)
        out += "}\n\n"
        out += f"func {function_name('decode', message)}(r *reader, m *{type_name}) {{\n"
        out += "\tfor r.more() {\n\t\tswitch r.tag() {\n"
        out += "".join(render_decode(item) for item in message.by_number)
        out += "\t\tdefault:\n\t\t\tr.skip()\n\t\t}\n\t}\n}\n\n"
    return (posixpath.join("protobuf", "wire_gen.go"), out.rstrip() + "\n")


def generate(model: Schema, options: dict[str, str]) -> list[tuple[str, str]]:
    module = option(options, "module")
    version = option(options, "version")
    return [*(render_model(group, module, version) for group in model.packages), render_wire(model, module)]
