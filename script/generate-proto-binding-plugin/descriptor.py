"""
Decodes the descriptor messages the plugin reads and encodes its response, using only the standard library.

Field numbers come from google/protobuf/descriptor.proto and google/protobuf/compiler/plugin.proto.
"""

from dataclasses import dataclass

TYPE_BOOL = 8
TYPE_STRING = 9
TYPE_MESSAGE = 11
TYPE_UINT32 = 13
TYPE_ENUM = 14
TYPE_SINT32 = 17

LABEL_REPEATED = 3

FEATURE_PROTO3_OPTIONAL = 1

Fields = dict[int, list[int | bytes]]


@dataclass
class Field:
    name: str
    number: int
    label: int
    type: int
    type_name: str
    # Descriptors are proto2, so an unset oneof_index must stay distinct from index 0.
    oneof_index: int | None
    proto3_optional: bool


@dataclass
class Message:
    name: str
    fields: list[Field]
    nested: list["Message"]
    enum_count: int
    extension_count: int
    oneof_count: int
    map_entry: bool


@dataclass
class EnumValue:
    name: str
    number: int


@dataclass
class Enum:
    name: str
    values: list[EnumValue]


@dataclass
class File:
    name: str
    package: str
    syntax: str
    messages: list[Message]
    enums: list[Enum]
    service_count: int
    extension_count: int
    comments: dict[tuple[int, ...], str]


@dataclass
class Request:
    files_to_generate: list[str]
    parameter: str
    files: list[File]


def read_varint(data: bytes, pos: int) -> tuple[int, int]:
    value = 0
    for shift in range(0, 70, 7):
        if pos >= len(data):
            raise ValueError("truncated varint")
        byte = data[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if byte < 0x80:
            return value, pos
    raise ValueError("varint is too long")


def parse(data: bytes) -> Fields:
    fields: Fields = {}
    pos = 0
    while pos < len(data):
        key, pos = read_varint(data, pos)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, pos = read_varint(data, pos)
        elif wire in (1, 2, 5):
            if wire == 2:
                size, pos = read_varint(data, pos)
            else:
                size = 8 if wire == 1 else 4
            if pos + size > len(data):
                raise ValueError("truncated field")
            value, pos = data[pos : pos + size], pos + size
        else:
            raise ValueError(f"unsupported wire type {wire}")
        fields.setdefault(number, []).append(value)
    return fields


def has(fields: Fields, number: int) -> bool:
    return number in fields


def integer(fields: Fields, number: int, default: int = 0) -> int:
    value = fields.get(number, [default])[-1]
    if not isinstance(value, int):
        raise ValueError(f"field {number} is not a varint")
    return value


def int32(fields: Fields, number: int) -> int:
    value = integer(fields, number) & 0xFFFFFFFF
    return value - (1 << 32) if value >= 1 << 31 else value


def text(fields: Fields, number: int) -> str:
    return blob(fields, number).decode("utf-8")


def blob(fields: Fields, number: int) -> bytes:
    value = fields.get(number, [b""])[-1]
    if not isinstance(value, bytes):
        raise ValueError(f"field {number} is not length-delimited")
    return value


def texts(fields: Fields, number: int) -> list[str]:
    return [value.decode("utf-8") for value in fields.get(number, []) if isinstance(value, bytes)]


def children(fields: Fields, number: int) -> list[Fields]:
    return [parse(value) for value in fields.get(number, []) if isinstance(value, bytes)]


def packed(fields: Fields, number: int) -> list[int]:
    values: list[int] = []
    for value in fields.get(number, []):
        if isinstance(value, int):
            values.append(value)
            continue
        pos = 0
        while pos < len(value):
            item, pos = read_varint(value, pos)
            values.append(item)
    return values


def decode_field(fields: Fields) -> Field:
    return Field(
        name=text(fields, 1),
        number=int32(fields, 3),
        label=integer(fields, 4),
        type=integer(fields, 5),
        type_name=text(fields, 6),
        oneof_index=int32(fields, 9) if has(fields, 9) else None,
        proto3_optional=bool(integer(fields, 17)),
    )


def decode_message(fields: Fields) -> Message:
    options = children(fields, 7)
    return Message(
        name=text(fields, 1),
        fields=[decode_field(item) for item in children(fields, 2)],
        nested=[decode_message(item) for item in children(fields, 3)],
        enum_count=len(fields.get(4, [])),
        extension_count=len(fields.get(6, [])),
        oneof_count=len(fields.get(8, [])),
        map_entry=bool(options and integer(options[-1], 7)),
    )


def decode_enum(fields: Fields) -> Enum:
    values = [EnumValue(name=text(item, 1), number=int32(item, 2)) for item in children(fields, 2)]
    return Enum(name=text(fields, 1), values=values)


def decode_comments(fields: Fields) -> dict[tuple[int, ...], str]:
    comments: dict[tuple[int, ...], str] = {}
    for info in children(fields, 9):
        for location in children(info, 1):
            if has(location, 3):
                comments[tuple(packed(location, 1))] = text(location, 3)
    return comments


def decode_file(fields: Fields) -> File:
    return File(
        name=text(fields, 1),
        package=text(fields, 2),
        # protoc leaves syntax unset for proto2 files.
        syntax=text(fields, 12) or "proto2",
        messages=[decode_message(item) for item in children(fields, 4)],
        enums=[decode_enum(item) for item in children(fields, 5)],
        service_count=len(fields.get(6, [])),
        extension_count=len(fields.get(7, [])),
        comments=decode_comments(fields),
    )


def decode_request(data: bytes) -> Request:
    fields = parse(data)
    return Request(
        files_to_generate=texts(fields, 1),
        parameter=text(fields, 2),
        files=[decode_file(item) for item in children(fields, 15)],
    )


def write_varint(value: int) -> bytes:
    out = bytearray()
    while value >= 0x80:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    out.append(value)
    return bytes(out)


def write_bytes(number: int, value: bytes) -> bytes:
    return write_varint(number << 3 | 2) + write_varint(len(value)) + value


def encode_response(files: list[tuple[str, str]], error: str | None = None) -> bytes:
    out = bytearray()
    if error is not None:
        out += write_bytes(1, error.encode("utf-8"))
    out += write_varint(2 << 3) + write_varint(FEATURE_PROTO3_OPTIONAL)
    for name, content in files:
        out += write_bytes(15, write_bytes(1, name.encode("utf-8")) + write_bytes(15, content.encode("utf-8")))
    return bytes(out)
