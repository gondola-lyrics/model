"""
Turns the decoded request into the intermediate schema every target renders, rejecting forms the targets do not support.
"""

import re
from dataclasses import dataclass, field

import descriptor

SCALARS = {
    descriptor.TYPE_STRING: "string",
    descriptor.TYPE_BOOL: "bool",
    descriptor.TYPE_UINT32: "uint32",
    descriptor.TYPE_SINT32: "sint32",
}

# Path components of SourceCodeInfo locations, from descriptor.proto.
MESSAGE_PATH = 4
ENUM_PATH = 5
FIELD_PATH = 2
ENUM_VALUE_PATH = 2


class GenerateError(Exception):
    pass


@dataclass(eq=False)
class EnumValue:
    name: str
    short: str
    number: int
    comment: list[str]


@dataclass(eq=False)
class Enum:
    pkg: str
    name: str
    full: str
    file: str
    comment: list[str]
    values: list[EnumValue]

    @property
    def zero(self) -> EnumValue:
        return next(value for value in self.values if value.number == 0)


@dataclass(eq=False)
class Field:
    name: str
    number: int
    comment: list[str]
    shape: str
    scalar: str | None = None
    ref: "Message | Enum | None" = None

    @property
    def tag(self) -> int:
        delimited = self.shape in ("message", "list-message", "map") or self.scalar == "string"
        return self.number << 3 | (2 if delimited else 0)


@dataclass(eq=False)
class Message:
    pkg: str
    name: str
    full: str
    file: str
    comment: list[str]
    fields: list[Field] = field(default_factory=list)

    @property
    def by_number(self) -> list[Field]:
        return sorted(self.fields, key=lambda item: item.number)


@dataclass(eq=False)
class Package:
    name: str
    enums: list[Enum] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)


@dataclass(eq=False)
class ProtoFile:
    name: str
    pkg: str
    enums: list[Enum] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)


@dataclass
class Schema:
    packages: list[Package]
    # Every message, ordered so that each one follows the messages it contains.
    messages: list[Message]
    enums: list[Enum]
    # Every .proto file, each listing its enums and messages in declaration order.
    files: list[ProtoFile]


def words(name: str) -> list[str]:
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name).lower().split("_")


def comment_at(file: descriptor.File, path: tuple[int, ...]) -> list[str]:
    return [line.strip() for line in file.comments.get(path, "").split("\n") if line.strip()]


def build(request: descriptor.Request) -> Schema:
    files = [file for file in request.files if file.name in request.files_to_generate]
    packages: dict[str, Package] = {}
    enums: dict[str, Enum] = {}
    messages: dict[str, Message] = {}
    sources = []
    proto_files: list[ProtoFile] = []

    for file in files:
        if file.syntax != "proto3":
            raise GenerateError(f"{file.name} is not proto3")
        if file.service_count or file.extension_count:
            raise GenerateError(f"{file.name} declares services or extensions")
        name = file.package.split(".")[-1]
        group = packages.setdefault(name, Package(name))
        proto_file = ProtoFile(file.name, name)
        proto_files.append(proto_file)

        for index, item in enumerate(file.enums):
            prefix = "_".join(words(item.name)).upper() + "_"
            values = []
            for value_index, entry in enumerate(item.values):
                if not entry.name.startswith(prefix):
                    raise GenerateError(f"{entry.name} does not start with {prefix}")
                comment = comment_at(file, (ENUM_PATH, index, ENUM_VALUE_PATH, value_index))
                values.append(EnumValue(entry.name, entry.name[len(prefix) :], entry.number, comment))
            if not any(value.number == 0 for value in values):
                raise GenerateError(f"{item.name} has no zero value")
            full = f".{file.package}.{item.name}"
            enums[full] = Enum(name, item.name, full, file.name, comment_at(file, (ENUM_PATH, index)), values)
            group.enums.append(enums[full])
            proto_file.enums.append(enums[full])

        for index, item in enumerate(file.messages):
            if item.enum_count or item.extension_count or any(not nested.map_entry for nested in item.nested):
                raise GenerateError(f"{item.name} has nested types or extensions")
            full = f".{file.package}.{item.name}"
            messages[full] = Message(name, item.name, full, file.name, comment_at(file, (MESSAGE_PATH, index)))
            sources.append((messages[full], item, file, index))
            proto_file.messages.append(messages[full])

    for message, source, file, index in sources:
        for field_index, item in enumerate(source.fields):
            comment = comment_at(file, (MESSAGE_PATH, index, FIELD_PATH, field_index))
            message.fields.append(build_field(message, source, item, comment, messages, enums))

    ordered = order(list(messages.values()))
    for group in packages.values():
        group.messages = [message for message in ordered if message.pkg == group.name]
    return Schema(list(packages.values()), ordered, list(enums.values()), proto_files)


def build_field(
    message: Message,
    source: descriptor.Message,
    item: descriptor.Field,
    comment: list[str],
    messages: dict[str, Message],
    enums: dict[str, Enum],
) -> Field:
    where = f"{message.name}.{item.name}"
    if item.oneof_index is not None and not item.proto3_optional:
        raise GenerateError(f"{where} is in a real oneof")
    repeated = item.label == descriptor.LABEL_REPEATED

    if item.type == descriptor.TYPE_MESSAGE:
        entry = next((nested for nested in source.nested if item.type_name == f"{message.full}.{nested.name}"), None)
        if entry is not None:
            if any(part.type != descriptor.TYPE_STRING for part in entry.fields):
                raise GenerateError(f"{where} is not a string map")
            return Field(item.name, item.number, comment, "map")
        if item.type_name not in messages:
            raise GenerateError(f"{where} refers to unknown message {item.type_name}")
        shape = "list-message" if repeated else "message"
        return Field(item.name, item.number, comment, shape, ref=messages[item.type_name])

    if item.type == descriptor.TYPE_ENUM:
        if item.type_name not in enums:
            raise GenerateError(f"{where} refers to unknown enum {item.type_name}")
        if repeated or item.proto3_optional:
            raise GenerateError(f"{where} has an unsupported enum form")
        return Field(item.name, item.number, comment, "enum", ref=enums[item.type_name])

    if item.type not in SCALARS:
        raise GenerateError(f"{where} has unsupported type {item.type}")
    shape = "list-scalar" if repeated else "optional" if item.proto3_optional else "scalar"
    return Field(item.name, item.number, comment, shape, scalar=SCALARS[item.type])


def order(messages: list[Message]) -> list[Message]:
    ordered: list[Message] = []
    state: dict[int, str] = {}

    def visit(message: Message) -> None:
        if state.get(id(message)) == "done":
            return
        if state.get(id(message)) == "active":
            raise GenerateError(f"{message.name} is recursive")
        state[id(message)] = "active"
        for item in message.fields:
            if isinstance(item.ref, Message):
                visit(item.ref)
        state[id(message)] = "done"
        ordered.append(message)

    for message in messages:
        visit(message)
    return ordered
