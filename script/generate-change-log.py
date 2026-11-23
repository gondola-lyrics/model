"""
Builds or replaces the changelog section of one module release.

Usage:
    python script/generate-change-log.py <proto|node|kotlin|cpp> <version> [--dry-run]
    python script/generate-change-log.py <proto|node|kotlin|cpp> <version> --extract
    python script/generate-change-log.py <proto|node|kotlin|cpp> <version> --check-bump
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

SCHEMA = "proto"

BINDINGS = ("node", "kotlin", "cpp")

BINDING_START_COMMITS = {
    "node": "6376feffce2de330d8fce1f4e47cb18975f21287",
    "kotlin": "1b7c90ca4e5d4b2f99e2d823951df9e4168633fc",
    "cpp": "4edebe57b955f0a31b9f978c9335ae5e61261198",
}

TARGETS = (SCHEMA, *BINDINGS)

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
RECORDED_PATTERN = re.compile(r"^## v(?P<version>\S+)", re.MULTILINE)
SCHEMA_LINE_PATTERN = re.compile(r"^> Proto Version:(?P<reference>[^\r\n]*)", re.MULTILINE)
SCHEMA_LINK_PATTERN = re.compile(r"\[(?P<version>[^\]]+)\]\([^\s()]+\)")
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
    result = subprocess.run(
        ["git", "--no-optional-locks", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8"
    )
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


def require_ancestor(reference: str, until: str) -> str:
    try:
        commit = git("rev-parse", "--verify", "--end-of-options", f"{reference}^{{commit}}").strip()
        ancestor = git("merge-base", commit, until).strip()
    except SystemExit:
        fail(f"cannot verify {reference} in {until}'s history; fetch the complete repository history")
    if ancestor != commit:
        fail(f"{reference} is not in {until}'s history")
    return commit


def binding_start_commit(target: str, until: str) -> str | None:
    if target == SCHEMA:
        return None
    start = BINDING_START_COMMITS.get(target)
    if not start:
        fail(f"{target} has no start commit in BINDING_START_COMMITS")
    if git("rev-parse", "--is-shallow-repository").strip() == "true":
        fail("changelog generation requires complete repository history; fetch the complete history first")
    return require_ancestor(start, until)


def release_history(target: str, version: str) -> tuple[str | None, str, bool]:
    tag = f"{target}/v{version}"
    until = f"refs/tags/{tag}" if git("tag", "--list", tag).strip() else "HEAD"
    require_ancestor(until, "HEAD")
    start = binding_start_commit(target, until)
    previous = previous_tag(target, version)
    if previous is not None:
        since = require_ancestor(f"refs/tags/{previous}", until)
        if start is not None:
            require_ancestor(start, since)
        return since, until, False
    return start, until, start is not None


def collect_commits(since: str | None, until: str = "HEAD", include_start: bool = False) -> list[Commit]:
    revisions = [until]
    if since is not None:
        # Excluding the start's parents includes its own changes, including a root or merge commit.
        excluded = git("rev-list", "--parents", "-n", "1", since).split()[1:] if include_start else [since]
        revisions += [f"^{commit}" for commit in excluded]
    output = git("log", *revisions, "--format=%H%x1f%h%x1f%s%x1f%b%x1e")
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


# The link is absolute, since a relative one resolves against a different base in the file and in a release body.
def schema_reference(schema: str, url: str | None) -> str:
    if url is None:
        return schema
    return f"[{schema}]({url}/blob/{SCHEMA}/v{schema}/{SCHEMA}/{CHANGE_LOG_FILE})"


def build_section(
    target: str, version: str, schema: str | None, commits: list[Commit], url: str | None, day: date
) -> str:
    # A binding records its own changes and the global ones; the schema's changes stay in the schema's own changelog.
    selected = [commit for commit in commits if commit.scope == target or commit.scope not in TARGETS]
    # A schema break warns here anyway, since it leaves a binding consumer with work to do
    # even though the schema keeps its own entries.
    reached = [commit for commit in commits if commit.scope == target or commit.scope not in BINDINGS]
    lines = [f"## v{version} ({day.isoformat()})"]

    if schema:
        lines += ["", f"> Proto Version: {schema_reference(schema, url)}"]

    breaking = [text for commit in reached for text in commit.breaking]
    if breaking:
        lines += ["", "### Breaking", ""]
        lines += [f"- {text}" for text in breaking]

    for kind, title in TYPE_TITLES.items():
        group = [commit for commit in selected if commit.kind == kind]
        if not group:
            continue
        lines += ["", f"### {title}", ""]
        lines += [f"- {format_commit(commit, url)}" for commit in group]

    if not breaking and not selected:
        lines += ["", "No notable changes."]
    return "\n".join(lines) + "\n"


def section_span(text: str, version: str) -> tuple[int, int] | None:
    headings = list(RECORDED_PATTERN.finditer(text))
    matches = [index for index, heading in enumerate(headings) if heading["version"] == version]
    if not matches:
        return None
    if len(matches) != 1:
        fail(f"{CHANGE_LOG_FILE} has multiple sections for v{version}")
    index = matches[0]
    end = headings[index + 1].start() if index + 1 < len(headings) else len(text)
    return headings[index].start(), end


def extract_section(text: str, version: str) -> str | None:
    span = section_span(text, version)
    if span is None:
        return None
    lines = text[span[0] : span[1]].splitlines()
    return "\n".join(lines[1:]).strip() + "\n"


# Sections are prepended, so the first heading is the newest release.
def previous_release(text: str) -> tuple[str, str | None] | None:
    for line in text.splitlines():
        match = RECORDED_PATTERN.match(line)
        if not match:
            continue
        if not SEMVER_PATTERN.match(match["version"]):
            fail(f"{CHANGE_LOG_FILE} records a heading that is not a semantic version: {match['version']!r}")
        found = SCHEMA_LINE_PATTERN.search(extract_section(text, match["version"]) or "")
        if found is None:
            return match["version"], None
        reference = found["reference"].strip()
        # Older releases recorded bare versions; newer ones link to the schema's changelog.
        link = SCHEMA_LINK_PATTERN.fullmatch(reference)
        schema = link["version"] if link else reference
        if not SEMVER_PATTERN.fullmatch(schema):
            fail(f"{CHANGE_LOG_FILE} records a Proto version that is not a semantic version: {reference!r}")
        return match["version"], schema
    return None


def recorded_metadata(section: str, target: str) -> tuple[str | None, date]:
    heading = re.fullmatch(r"## v\S+ \((\d{4}-\d{2}-\d{2})\)[ \t]*", section.splitlines()[0])
    if heading is None:
        fail(f"{target}/{CHANGE_LOG_FILE} has an invalid release date")
    try:
        day = date.fromisoformat(heading[1])
    except ValueError:
        fail(f"{target}/{CHANGE_LOG_FILE} has an invalid release date")
    schema = previous_release(section)[1]
    if target != SCHEMA and schema is None:
        fail(f"{target}/{CHANGE_LOG_FILE} has no Proto version for this release")
    return schema, day


def replace_section(text: str, version: str, section: str) -> str:
    span = section_span(text, version)
    if span is None:
        return f"{section}\n{text}" if text else section
    suffix = text[span[1] :]
    return text[: span[0]] + section + ("\n" if suffix else "") + suffix


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
    parser = argparse.ArgumentParser(description="Build or replace the changelog section of one module release.")
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
    span = section_span(existing, args.version) if existing is not None else None
    recorded = existing[span[0] : span[1]] if span is not None else None

    if args.extract:
        if recorded is None:
            fail(f"{relative} has no section for v{args.version}")
        print(extract_section(existing, args.version), end="")
        return

    since, until, include_start = release_history(args.target, args.version)

    # A caller asks for this before writing anything of its own, so nothing is half done when the
    # version turns out to be too small.
    if args.check_bump:
        schema = read_schema_version() if args.target in BINDINGS else None
        check_bump(args.target, args.version, schema, existing)
        return

    day = date.today()
    if recorded is not None:
        if until == "HEAD" and version_key(RECORDED_PATTERN.search(existing)["version"]) > version_key(args.version):
            fail(f"cannot rebuild an older release without tag {args.target}/v{args.version}")
        schema, day = recorded_metadata(recorded, args.target)
    else:
        schema = read_schema_version() if args.target in BINDINGS else None
        if not args.dry_run:
            check_bump(args.target, args.version, schema, existing)

    commits = collect_commits(since, until, include_start)
    section = build_section(args.target, args.version, schema, commits, repo_url(), day)

    if args.dry_run:
        print(section, end="")
        return

    updated = replace_section(existing or "", args.version, section)
    if updated == existing:
        print(f"{relative} already matches v{args.version}")
        return
    write_file(relative, updated)
    print(f"wrote {relative} for v{args.version}")


if __name__ == "__main__":
    main()
