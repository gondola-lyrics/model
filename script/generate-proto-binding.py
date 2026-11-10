"""
Generates the native models and wire codecs of the bindings from proto/ through buf and generate-proto-binding-plugin.

Usage:
    python script/generate-proto-binding.py [node|kotlin|go|cpp ...] [--check] [--out <dir>]
"""

import argparse
import glob
import json
import os
import posixpath
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass

sys.dont_write_bytecode = True

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLUGIN = os.path.join(ROOT, "script", "generate-proto-binding-plugin", "main.py")
PROTO = os.path.join(ROOT, "proto")
VERSION_FILE = os.path.join(ROOT, "proto", "VERSION.txt")
CLANG_FORMAT_STYLE = os.path.join(ROOT, "cpp", ".clang-format")

# Pinned so that regenerating on another machine yields the same files.
BUF_VERSION = "1.72.0"
CLANG_FORMAT_MAJOR = 22


@dataclass(frozen=True)
class Binding:
    out: tuple[str, ...]
    pattern: tuple[str, ...]
    options: tuple[str, ...] = ()


BINDINGS = {
    "node": Binding(("node", "src", "generated"), ("**", "*.gen.ts")),
    "kotlin": Binding(("kotlin", "src", "generated", "kotlin"), ("**", "*.gen.kt"), ("package=gondola.lyrics.model",)),
    "go": Binding(("go",), ("**", "*.gen.go"), ("module=github.com/gondola-lyrics/model/go",)),
    "cpp": Binding(("cpp", "include"), ("**", "*.gen.hpp")),
}


def fail(message: str) -> None:
    raise SystemExit(f"generate-proto-binding: {message}")


def command(*args: str, cwd: str = ROOT, capture: bool = False) -> str:
    try:
        result = subprocess.run(args, cwd=cwd, capture_output=capture, text=True, encoding="utf-8")
    except OSError as error:
        fail(f"cannot run {args[0]}: {error}")
    if result.returncode != 0:
        reason = result.stderr.strip() if capture else "see the output above"
        fail(f"{' '.join(args[:2])} failed: {reason}")
    return result.stdout if capture else ""


def read_version() -> str:
    try:
        with open(VERSION_FILE, encoding="utf-8") as file:
            version = file.read().strip()
    except OSError as error:
        fail(f"cannot read proto/VERSION.txt: {error}")
    if not version:
        fail("proto/VERSION.txt is empty")
    return version


def check_buf() -> None:
    version = command("buf", "--version", capture=True).strip()
    if version != BUF_VERSION:
        fail(f"buf {BUF_VERSION} is required, found {version}")


def check_clang_format() -> None:
    match = re.search(r"version (\d+)\.", command("clang-format", "--version", capture=True))
    if not match or int(match[1]) != CLANG_FORMAT_MAJOR:
        fail(f"clang-format {CLANG_FORMAT_MAJOR} is required")
    if not os.path.isfile(CLANG_FORMAT_STYLE):
        fail("cpp/.clang-format is missing")


def run_buf(names: list[str], out: str, version: str) -> None:
    plugins = []
    for name in names:
        binding = BINDINGS[name]
        plugins.append(
            {
                # The interpreter running this script also runs the plugin, whatever python is called on this machine.
                "local": [sys.executable, PLUGIN],
                "strategy": "all",
                "out": os.path.join(out, *binding.out),
                "opt": [f"target={name}", f"version={version}", *binding.options],
            }
        )
    template = {"version": "v2", "inputs": [{"directory": PROTO}], "plugins": plugins}
    command("buf", "generate", "--template", json.dumps(template))


def generated_files(root: str, binding: Binding) -> list[str]:
    return sorted(glob.glob(os.path.join(root, *binding.out, *binding.pattern), recursive=True))


def install(binding: Binding, staging: str) -> list[str]:
    target = os.path.join(ROOT, *binding.out)
    # Removing every generated file first keeps a renamed or deleted .proto from leaving an orphan behind.
    for path in generated_files(ROOT, binding):
        os.remove(path)

    installed = []
    source = os.path.join(staging, *binding.out)
    for directory, _, names in os.walk(source):
        for name in names:
            path = os.path.join(target, os.path.relpath(os.path.join(directory, name), source))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            shutil.copyfile(os.path.join(directory, name), path)
            installed.append(path)
    return sorted(installed)


def format_files(name: str, files: list[str]) -> None:
    # The Node files stay exactly as the plugin wrote them, and node/.prettierignore keeps them out of formatting.
    if name == "node":
        return
    if name == "kotlin":
        gradlew = os.path.join(ROOT, "kotlin", "gradlew.bat" if os.name == "nt" else "gradlew")
        command(gradlew, "--quiet", "spotlessKotlinGeneratedApply", cwd=os.path.join(ROOT, "kotlin"))
    elif name == "go":
        command("gofmt", "-w", *files)
    else:
        command("clang-format", "-i", f"--style=file:{CLANG_FORMAT_STYLE}", *files)


def check_committed(names: list[str]) -> None:
    pathspecs = [f":(glob){posixpath.join(*BINDINGS[name].out, *BINDINGS[name].pattern)}" for name in names]
    status = command("git", "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", *pathspecs, capture=True)
    changed = [entry[3:] for entry in status.split("\0") if entry]
    if changed:
        fail("regenerated files differ from the committed ones; commit them first:\n  " + "\n  ".join(changed))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the native models and wire codecs from proto/.")
    parser.add_argument("bindings", nargs="*", metavar="binding", help=f"one of {', '.join(BINDINGS)}; all by default")
    parser.add_argument("--check", action="store_true", help="fail when the regenerated files are not committed")
    parser.add_argument("--out", help="write the raw plugin output into this empty directory instead")
    args = parser.parse_args()

    names = list(dict.fromkeys(args.bindings)) or list(BINDINGS)
    unknown = [name for name in names if name not in BINDINGS]
    if unknown:
        fail(f"unknown binding {', '.join(unknown)}; expected {', '.join(BINDINGS)}")
    if args.check and args.out:
        fail("--check compares the bindings in place and cannot be combined with --out")

    check_buf()
    version = read_version()

    if args.out:
        out = os.path.abspath(args.out)
        if os.path.exists(out) and os.listdir(out):
            fail(f"{out} is not empty")
        run_buf(names, out, version)
        print(f"generate-proto-binding: wrote raw output for {', '.join(names)} to {out}")
        return

    if "cpp" in names:
        check_clang_format()
    temporary = os.path.join(ROOT, ".claude", "temp")
    os.makedirs(temporary, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temporary) as staging:
        run_buf(names, staging, version)
        for name in names:
            files = install(BINDINGS[name], staging)
            format_files(name, files)
            print(f"generate-proto-binding: {name} -> {posixpath.join(*BINDINGS[name].out)} ({len(files)} files)")

    if args.check:
        check_committed(names)


if __name__ == "__main__":
    main()
