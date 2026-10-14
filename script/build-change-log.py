"""
Builds the changelog section of one module release.

Usage:
    python script/build-change-log.py <proto|node> <version> [--dry-run]
    python script/build-change-log.py <proto|node> <version> --extract
    python script/build-change-log.py <proto|node> <version> --check-bump
"""

import os
import re
import sys
import argparse
import subprocess

from dataclasses import dataclass
from datetime import date

sys.dont_write_bytecode = True

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BINDINGS = ("node",)

TARGETS = ("proto", *BINDINGS)

CHANGE_LOG_FILE = "CHANGELOG.md"

SCHEMA_VERSION_FILE = "proto/VERSION.txt"

TYPE_TITLES = {
    "feat": "Feature",
    "fix": "Fix",
    "perf": "Performance",
    "refactor": "Refactor",
    "revert": "Revert",
    "docs": "Document",
}

SUBJECT_PATTERN = re.compile(r"^(?P<kind>[a-z]+)(?:\((?P<scope>[\w-]+)\))?: (?P<message>.+)$")
BREAKING_PATTERN = re.compile(r"^breaking:\s*(?P<text>.+)$", re.IGNORECASE)
GITHUB_PATTERN = re.compile(r"github\.com[:/](?P<owner>[^/]+)/(?P<name>[^/]+?)(?:\.git)?/?$")
RECORDED_PATTERN = re.compile(r"^## v(?P<version>\S+) \(")
SCHEMA_LINE_PATTERN = re.compile(r"^> Proto Version:\s*(?P<version>\S+)\s*$", re.MULTILINE)
SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)


@dataclass
class Commit:
    full: str
    short: str
    kind: str
    scope: str | None
    message: str
    breaking: list[str]


def fail(message: str) -> None:
    raise SystemExit(f"error: {message}")


def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        raise SystemExit(f'error: git {" ".join(args)} failed: {result.stderr.strip()}')
    return result.stdout


def read_file(relative: str) -> str | None:
    path = os.path.join(ROOT, relative)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as file:
        return file.read()


def write_file(relative: str, content: str) -> None:
    with open(os.path.join(ROOT, relative), "w", encoding="utf-8", newline="\n") as file:
        file.write(content)


def version_key(version: str) -> tuple:
    match = SEMVER_PATTERN.match(version)
    if not match:
        fail(f"not a semantic version: {version}")
    core = tuple(int(match[i]) for i in (1, 2, 3))
    if match[4] is None:
        return (core, 1, ())
    identifiers = tuple((0, int(part), "") if part.isdigit() else (1, 0, part) for part in match[4].split("."))
    return (core, 0, identifiers)


def repo_url() -> str | None:
    result = subprocess.run(
        ["git", "remote", "get-url", "origin"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8"
    )
    match = GITHUB_PATTERN.search(result.stdout.strip()) if result.returncode == 0 else None
    return f'https://github.com/{match["owner"]}/{match["name"]}' if match else None


def read_schema_version() -> str:
    version = (read_file(SCHEMA_VERSION_FILE) or "").strip()
    if not SEMVER_PATTERN.match(version):
        fail(f"{SCHEMA_VERSION_FILE} does not hold a semantic version: {version!r}")
    return version


def previous_tag(target: str, version: str) -> str | None:
    versions = [tag.removeprefix(f"{target}/v") for tag in git("tag", "--list", f"{target}/v*").split()]
    lower = [found for found in versions if SEMVER_PATTERN.match(found) and version_key(found) < version_key(version)]
    return f"{target}/v{max(lower, key=version_key)}" if lower else None


def collect_commits(since: str | None) -> list[Commit]:
    revision = f"{since}..HEAD" if since else "HEAD"
    output = git("log", revision, "--format=%H%x1f%h%x1f%s%x1f%b%x1e")
    commits = []
    for record in output.split("\x1e"):
        record = record.strip("\n")
        if not record:
            continue
        full, short, subject, body = record.split("\x1f", 3)
        match = SUBJECT_PATTERN.match(subject)
        if not match or match["kind"] not in TYPE_TITLES:
            continue
        breaking = [
            found["text"].strip() for line in body.splitlines() if (found := BREAKING_PATTERN.match(line.strip()))
        ]
        commits.append(Commit(full, short, match["kind"], match["scope"], match["message"], breaking))
    return commits


def format_commit(commit: Commit, url: str | None) -> str:
    link = f"[{commit.short}]({url}/commit/{commit.full})" if url else commit.short
    return f"{commit.message} ({link})"


def build_section(
    target: str, version: str, schema: str | None, commits: list[Commit], url: str | None, day: date
) -> str:
    # A commit belongs here when its scope names this module, or when it names no single binding.
    selected = [commit for commit in commits if commit.scope == target or commit.scope not in BINDINGS]
    lines = [f"## v{version} ({day.isoformat()})"]

    if schema:
        lines += ["", f"> Proto Version: {schema}"]

    breaking = [text for commit in selected for text in commit.breaking]
    if breaking:
        lines += ["", "### Breaking", ""]
        lines += [f"- {text}" for text in breaking]

    for kind, title in TYPE_TITLES.items():
        group = [commit for commit in selected if commit.kind == kind]
        if not group:
            continue
        lines += ["", f"### {title}", ""]
        lines += [f"- {format_commit(commit, url)}" for commit in group]

    if not selected:
        lines += ["", "No notable changes."]
    return "\n".join(lines) + "\n"


def extract_section(text: str, version: str) -> str | None:
    lines = text.splitlines()
    heading = f"## v{version} ("
    start = next((i for i, line in enumerate(lines) if line.startswith(heading)), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## v")), len(lines))
    return "\n".join(lines[start + 1 : end]).strip() + "\n"


# Sections are prepended, so the first heading is the newest release.
def previous_release(text: str) -> tuple[str, str | None] | None:
    for line in text.splitlines():
        match = RECORDED_PATTERN.match(line)
        if not match:
            continue
        if not SEMVER_PATTERN.match(match["version"]):
            fail(f"{CHANGE_LOG_FILE} records a heading that is not a semantic version: {match['version']!r}")
        found = SCHEMA_LINE_PATTERN.search(extract_section(text, match["version"]) or "")
        return match["version"], found["version"] if found else None
    return None


def required_bump(schema: str, shipped: str) -> str:
    now, before = version_key(schema)[0], version_key(shipped)[0]
    if now[0] > before[0]:
        return "major"
    if now[1] > before[1]:
        return "minor"
    return "patch"


# The schema version a release shipped with is read back from the changelog, since the working tree
# only ever holds the current one.
def check_bump(target: str, version: str, schema: str | None, existing: str | None) -> None:
    previous = previous_release(existing) if existing else None
    if previous is None:
        return
    name, shipped = previous

    if version_key(version) <= version_key(name):
        fail(f"{version} does not come after {name}, the newest release {target}/{CHANGE_LOG_FILE} records")
    if schema is None or shipped is None:
        return
    if version_key(schema) < version_key(shipped):
        fail(f"{SCHEMA_VERSION_FILE} holds {schema}, behind the {shipped} that {name} shipped with")

    bump = required_bump(schema, shipped)
    core, before = version_key(version)[0], version_key(name)[0]
    moved = f"the schema went {shipped} -> {schema}"
    if bump == "major" and core[0] == before[0]:
        fail(f"{moved}, a breaking move, so {version} has to advance its major past {before[0]}")
    if bump == "minor" and core[:2] == before[:2]:
        fail(f"{moved}, a compatible move, so {version} has to advance at least its minor past {before[1]}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Build the changelog section of one binding release.")
    parser.add_argument("target", choices=TARGETS)
    parser.add_argument("version")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--dry-run", action="store_true", help="print the section without writing it")
    modes.add_argument("--extract", action="store_true", help="print the version's existing section, for release notes")
    modes.add_argument("--check-bump", action="store_true", help="run only the version check, for a caller's guard")
    args = parser.parse_args()

    if not os.path.isdir(os.path.join(ROOT, args.target)):
        fail(f"{args.target}/ does not exist")
    version_key(args.version)

    relative = f"{args.target}/{CHANGE_LOG_FILE}"
    existing = read_file(relative)
    recorded = extract_section(existing, args.version) if existing is not None else None

    if args.extract:
        if recorded is None:
            fail(f"{relative} has no section for v{args.version}")
        print(recorded, end="")
        return

    schema = read_schema_version() if args.target in BINDINGS else None

    # A caller asks for this before writing anything of its own, so nothing is half done when the
    # version turns out to be too small.
    if args.check_bump:
        check_bump(args.target, args.version, schema, existing)
        return

    # Writing a version twice would leave two sections, and extraction only ever reaches the first.
    if recorded is not None and not args.dry_run:
        fail(f"{relative} already has a section for v{args.version}")
    # A dry run previews rather than gates, so it is held to neither of these.
    if not args.dry_run:
        check_bump(args.target, args.version, schema, existing)

    since = previous_tag(args.target, args.version)
    commits = collect_commits(since)
    section = build_section(args.target, args.version, schema, commits, repo_url(), date.today())

    if args.dry_run:
        print(section, end="")
        return

    write_file(relative, f"{section}\n{existing}" if existing else section)
    print(f"wrote {relative} for v{args.version}")


if __name__ == "__main__":
    main()
