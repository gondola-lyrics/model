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

# Pinned so that regenerating on another machine yields the same files.
BUF_VERSION = "1.72.0"


@dataclass(frozen=True)
class Binding:
    out: tuple[str, ...]
    pattern: tuple[str, ...]
    options: tuple[str, ...] = ()


BINDINGS = {
    "node": Binding(("node", "src", "generated"), ("**", "*.gen.ts")),
    "kotlin": Binding(
        ("kotlin", "src", "generated", "kotlin"),
        ("**", "*.gen.kt"),
        ("package=gondola.lyrics.model",),
    ),
    "go": Binding(("go",), ("**", "*.gen.go"), ("module=github.com/gondola-lyrics/model/go",)),
    "cpp": Binding(("cpp", "generated"), ("**", "*.gen.*")),
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


def format_files(name: str, files: list[str], root: str) -> None:
    # Node and C++ templates own their formatting, and generated files are excluded from routine formatters.
    if name in ("node", "cpp"):
        return
    if name == "kotlin":
        # Spotless requires its targets to stay within the Gradle project directory.
        project = os.path.join(root, "kotlin")
        for path in ("build.gradle.kts", "settings.gradle.kts", "gradle.properties", ".editorconfig", "gradle/libs.versions.toml"):
            target = os.path.join(project, path)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copyfile(os.path.join(ROOT, "kotlin", path), target)
        gradlew = os.path.join(ROOT, "kotlin", "gradlew.bat" if os.name == "nt" else "gradlew")
        gradle_command = [gradlew] if os.name == "nt" else ["bash", gradlew]
        command(
            *gradle_command,
            "--project-dir",
            project,
            "--no-daemon",
            "--console=plain",
            "--stacktrace",
            "spotlessKotlinGeneratedApply",
            cwd=os.path.join(ROOT, "kotlin"),
        )
    elif name == "go":
        command("gofmt", "-w", *files)


def check_committed(names: list[str]) -> None:
    pathspecs = [f":(glob){posixpath.join(*BINDINGS[name].out, *BINDINGS[name].pattern)}" for name in names]
    status = command(
        "git",
        "--no-optional-locks",
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--",
        *pathspecs,
        capture=True,
    )
    changed = [entry[3:] for entry in status.split("\0") if entry]
    if changed:
        fail("generated files have uncommitted changes; commit them before checking:\n  " + "\n  ".join(changed))


def check_generated(names: list[str], staging: str) -> None:
    expected = {os.path.relpath(path, staging).replace(os.sep, "/"): path for name in names for path in generated_files(staging, BINDINGS[name])}
    current = {os.path.relpath(path, ROOT).replace(os.sep, "/"): path for name in names for path in generated_files(ROOT, BINDINGS[name])}
    differences = []
    for path in sorted(expected.keys() | current.keys()):
        if path not in current:
            differences.append(f"missing: {path}")
        elif path not in expected:
            differences.append(f"extra: {path}")
        else:
            with open(expected[path], "rb") as generated, open(current[path], "rb") as existing:
                if generated.read() != existing.read():
                    differences.append(f"changed: {path}")
    if differences:
        fail("generated files are out of date; regenerate and commit them:\n  " + "\n  ".join(differences))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the native models and wire codecs from proto/.")
    parser.add_argument(
        "bindings",
        nargs="*",
        metavar="binding",
        help=f"one of {', '.join(BINDINGS)}; all by default",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify committed generated files without modifying them",
    )
    parser.add_argument("--out", help="write the raw plugin output into this empty directory instead")
    args = parser.parse_args()

    names = list(dict.fromkeys(args.bindings)) or list(BINDINGS)
    unknown = [name for name in names if name not in BINDINGS]
    if unknown:
        fail(f"unknown binding {', '.join(unknown)}; expected {', '.join(BINDINGS)}")
    if args.check and args.out:
        fail("--check cannot be combined with --out")

    if args.check:
        check_committed(names)

    check_buf()
    version = read_version()

    if args.out:
        out = os.path.abspath(args.out)
        if os.path.exists(out) and os.listdir(out):
            fail(f"{out} is not empty")
        run_buf(names, out, version)
        print(f"generate-proto-binding: wrote raw output for {', '.join(names)} to {out}")
        return

    with tempfile.TemporaryDirectory() as staging:
        run_buf(names, staging, version)
        for name in names:
            format_files(name, generated_files(staging, BINDINGS[name]), staging)

        if args.check:
            check_generated(names, staging)
            check_committed(names)
            print(f"generate-proto-binding: verified committed output for {', '.join(names)}")
            return

        for name in names:
            files = install(BINDINGS[name], staging)
            print(f"generate-proto-binding: {name} -> {posixpath.join(*BINDINGS[name].out)} ({len(files)} files)")


if __name__ == "__main__":
    main()
