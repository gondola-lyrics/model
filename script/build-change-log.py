"""
Builds the changelog section of one binding release.

Usage:
  python script/build-change-log.py <node|kotlin|cpp> <version> [--dry-run]
  python script/build-change-log.py <node|kotlin|cpp> <version> --extract
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

TARGETS = ("node", "kotlin", "cpp")

SHARED_PATHS = ("proto/", "script/")

CHANGE_LOG_FILE = "CHANGELOG.md"

SCHEMA_VERSION_FILE = os.path.join("proto", "VERSION.txt")

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


def previous_tag(target: str, version: str) -> str | None:
    versions = [tag.removeprefix(f"{target}/v") for tag in git("tag", "--list", f"{target}/v*").split()]
    lower = [found for found in versions if SEMVER_PATTERN.match(found) and version_key(found) < version_key(version)]
    return f"{target}/v{max(lower, key=version_key)}" if lower else None


def collect_commits(since: str | None, paths: list[str]) -> list[Commit]:
    revision = f"{since}..HEAD" if since else "HEAD"
    output = git("log", revision, "--format=%H%x1f%h%x1f%s%x1f%b%x1e", "--", *paths)
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


def build_section(target: str, version: str, schema: str, commits: list[Commit], url: str | None, day: date) -> str:
    lines = [f"## v{version} ({day.isoformat()})", "", f"Schema: proto {schema}"]

    breaking = [text for commit in commits for text in commit.breaking]
    if breaking:
        lines += ["", "### Breaking", ""]
        lines += [f"- {text}" for text in breaking]

    for kind, title in TYPE_TITLES.items():
        group = [commit for commit in commits if commit.kind == kind]
        if not group:
            continue
        lines += ["", f"### {title}", ""]
        lines += [f"- {format_commit(commit, url)}" for commit in group if commit.scope in (None, target)]
        for scope in sorted({commit.scope for commit in group} - {None, target}):
            lines.append(f"- `{scope}`")
            lines += [f"  - {format_commit(commit, url)}" for commit in group if commit.scope == scope]

    if not commits:
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


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Build the changelog section of one binding release.")
    parser.add_argument("target", choices=TARGETS)
    parser.add_argument("version")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--dry-run", action="store_true", help="print the section without writing it")
    modes.add_argument("--extract", action="store_true", help="print the version's existing section, for release notes")
    args = parser.parse_args()

    if not os.path.isdir(os.path.join(ROOT, args.target)):
        fail(f"{args.target}/ does not exist")
    version_key(args.version)

    relative = f"{args.target}/{CHANGE_LOG_FILE}"
    existing = read_file(relative)

    if args.extract:
        section = extract_section(existing, args.version) if existing is not None else None
        if section is None:
            fail(f"{relative} has no section for v{args.version}")
        print(section, end="")
        return

    since = previous_tag(args.target, args.version)
    schema = (read_file(SCHEMA_VERSION_FILE) or "").strip() or "unknown"
    commits = collect_commits(since, [f"{args.target}/", *SHARED_PATHS])
    section = build_section(args.target, args.version, schema, commits, repo_url(), date.today())

    if args.dry_run:
        print(section, end="")
        return

    write_file(relative, f"{section}\n{existing}" if existing else section)
    print(f"wrote {relative} for v{args.version}")


if __name__ == "__main__":
    main()
