"""
Buf plugin that renders native models and wire codecs from the schema.

Run it through script/generate-proto-binding.py, which passes the target, schema version and package options.
"""

import sys

# Set before importing the sibling modules so that no __pycache__ appears under script/.
sys.dont_write_bytecode = True

import descriptor  # noqa: E402
import schema  # noqa: E402
from target import cpp, go, kotlin, node  # noqa: E402

TARGETS = {"node": node.generate, "kotlin": kotlin.generate, "go": go.generate, "cpp": cpp.generate}


def main() -> None:
    request = descriptor.decode_request(sys.stdin.buffer.read())
    options = dict(item.split("=", 1) for item in request.parameter.split(",") if "=" in item)
    try:
        if options.get("target") not in TARGETS:
            raise schema.GenerateError(f"unknown target {options.get('target')}; expected one of {', '.join(TARGETS)}")
        files = TARGETS[options["target"]](schema.build(request), options)
        response = descriptor.encode_response(files)
    except schema.GenerateError as error:
        # Problems with the schema or the options go back through the response so buf reports them as plugin errors.
        response = descriptor.encode_response([], f"generate-proto-binding-plugin: {error}")
    sys.stdout.buffer.write(response)


if __name__ == "__main__":
    main()
