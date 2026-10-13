"""
Updates the declared schema version, then cuts the release commit and tag together.

Usage:
    python script/update-proto-version.py <version> [--dry-run]
"""

import os
import re
import sys
import argparse
import subprocess

sys.dont_write_bytecode = True

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

VERSION_FILE = "proto/VERSION.txt"

CHANGE_LOG_FILE = "proto/CHANGELOG.md"

CHANGE_LOG_BUILDER = "script/build-change-log.py"

TAG_PREFIX = "proto/v"

SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)


def fail(message: str) -> None:
    raise SystemExit(f"error: {message}")


def read_file(relative: str) -> str | None:
    path = os.path.join(ROOT, relative)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as file:
        return file.read()


def write_file(relative: str, content: str) -> None:
    with open(os.path.join(ROOT, relative), "w", encoding="utf-8", newline="\n") as file:
        file.write(content)


def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        raise SystemExit(f'error: git {" ".join(args)} failed: {result.stderr.strip()}')
    return result.stdout


def run(*args: str) -> None:
    if subprocess.run(args, cwd=ROOT).returncode != 0:
        raise SystemExit(f'error: {" ".join(args)} failed')


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Update the declared schema version and release it.")
    parser.add_argument("version")
    parser.add_argument("--dry-run", action="store_true", help="run every check without writing or committing")
    args = parser.parse_args()
    version = args.version

    if not SEMVER_PATTERN.match(version):
        fail(f"not a semantic version: {version}")
    if version == "0.0.0":
        fail("0.0.0 is the placeholder, not a release version")

    tag = f"{TAG_PREFIX}{version}"
    if git("tag", "--list", tag).strip():
        fail(f"tag {tag} already exists")

    if (read_file(VERSION_FILE) or "").strip() == version:
        fail(f"{VERSION_FILE} is already {version}")

    # The builder refuses to write a version twice, so the section is checked here to leave nothing half written.
    existing = read_file(CHANGE_LOG_FILE)
    if existing is not None and f"## v{version} (" in existing:
        fail(f"{CHANGE_LOG_FILE} already has a section for v{version}")

    status = git("status", "--porcelain").strip()
    if status != "":
        fail(f"the worktree has uncommitted changes:\n{status}")

    if args.dry_run:
        print(f"update-proto-version: {version} is ready; stopped before writing")
        return

    write_file(VERSION_FILE, f"{version}\n")
    run(sys.executable, os.path.join(ROOT, CHANGE_LOG_BUILDER), "proto", version)

    run("git", "add", VERSION_FILE, CHANGE_LOG_FILE)
    run("git", "commit", "-m", f"release(proto): v{version}")
    run("git", "tag", tag)
    print(f"update-proto-version: tagged {tag}; every binding still has to regenerate its own schema version")


if __name__ == "__main__":
    main()
