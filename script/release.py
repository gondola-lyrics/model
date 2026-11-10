"""
Records a release, optionally updates its version, then commits and tags it locally.

Usage:
    python script/release.py <proto|node|kotlin> <version> [--update-version] [--dry-run]
"""

import argparse
import json
import os
import re
import subprocess
import sys

sys.dont_write_bytecode = True

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHANGE_LOG_GENERATOR = os.path.join(ROOT, "script", "generate-change-log.py")
BINDING_GENERATOR = os.path.join(ROOT, "script", "generate-proto-binding.py")

# The scopes whose generated files are committed, so a tag has to carry exactly what the generator writes from proto/.
GENERATED_SCOPES = ("node",)

VERSION_FILES = {
    "proto": "proto/VERSION.txt",
    "node": "node/package.json",
    "kotlin": "kotlin/build.gradle.kts",
}
NODE_LOCK_FILE = "node/package-lock.json"

SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$",
    re.ASCII,
)
KOTLIN_VERSION_PATTERN = re.compile(r'^version\s*=\s*"([^"\r\n]+)"\s*$', re.MULTILINE)


def fail(message: str) -> None:
    raise SystemExit(f"release: {message}")


def command(*args: str, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(args, cwd=ROOT, capture_output=capture, text=True, encoding="utf-8")
    if check and result.returncode != 0:
        reason = result.stderr.strip() if capture else "see the output above"
        fail(f"{' '.join(args)} failed: {reason}")
    return result


def git(*args: str) -> str:
    return command("git", *args, capture=True).stdout


def read_file(path: str) -> str:
    try:
        with open(os.path.join(ROOT, path), encoding="utf-8") as file:
            return file.read()
    except OSError as error:
        fail(f"cannot read {path}: {error}")


def write_file(path: str, content: str) -> None:
    with open(os.path.join(ROOT, path), "w", encoding="utf-8", newline="\n") as file:
        file.write(content)


def version_fields(path: str, text: str) -> tuple[list[str], object]:
    if path == VERSION_FILES["proto"]:
        version = text.strip()
        if not SEMVER_PATTERN.fullmatch(version):
            fail(f"{path} must contain a semantic version")
        return [version], None

    if path == VERSION_FILES["kotlin"]:
        matches = list(KOTLIN_VERSION_PATTERN.finditer(text))
        if len(matches) != 1:
            fail(f'{path} must contain exactly one top-level version = "..." declaration')
        match = matches[0]
        return [match[1]], text[: match.start(1)] + text[match.end(1) :]

    try:
        data = json.loads(text)
        versions = [data.pop("version")]
        if path == NODE_LOCK_FILE:
            versions.append(data["packages"][""].pop("version"))
        if not all(isinstance(value, str) for value in versions):
            raise ValueError("version fields must be strings")
        return versions, data
    except (ValueError, KeyError, TypeError, AttributeError) as error:
        fail(f"cannot read version fields in {path}: {error}")


def changed_paths(*args: str) -> set[str]:
    return set(filter(None, git(*args).split("\0")))


def render_version(path: str, text: str, version: str) -> str:
    version_fields(path, text)
    if path == VERSION_FILES["proto"]:
        return f"{version}\n"
    if path == VERSION_FILES["kotlin"]:
        match = KOTLIN_VERSION_PATTERN.search(text)
        return text[: match.start(1)] + version + text[match.end(1) :]
    data = json.loads(text)
    data["version"] = version
    if path == NODE_LOCK_FILE:
        data["packages"][""]["version"] = version
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def check_worktree(scope: str, version: str, update_version: bool = False) -> list[str]:
    paths = changed_paths("diff", "--name-only", "--no-renames", "-z", "HEAD", "--")
    paths |= changed_paths("diff", "--cached", "--name-only", "--no-renames", "-z", "HEAD", "--")

    allowed = {VERSION_FILES[scope]}
    if scope == "node":
        allowed.add(NODE_LOCK_FILE)

    # Untracked files have no committed baseline from which a version-only edit can be established.
    status = git("status", "--porcelain=v1", "-z", "--untracked-files=all")
    if paths - allowed or any(entry.startswith("?? ") for entry in status.split("\0")):
        fail("commit unrelated changes first; only this scope's version files may have pending edits")

    for path in sorted(paths | (allowed if update_version else set())):
        expected_mode = "100644"
        tree = git("ls-tree", "HEAD", "--", path)
        index = git("ls-files", "--stage", "--", path)
        if not tree.startswith(expected_mode + " ") or not index.startswith(expected_mode + " "):
            fail(f"{path} must be an existing regular version file without mode changes or conflicts")
        if not os.path.isfile(os.path.join(ROOT, path)) or os.path.islink(os.path.join(ROOT, path)):
            fail(f"{path} must remain a regular file")
        if git("diff", "--summary", "HEAD", "--", path).strip():
            fail(f"{path} has changes beyond its version fields")
        original = git("show", f"HEAD:{path}")
        staged = git("show", f":{path}")
        working = read_file(path)
        if staged != original and working == original:
            fail(f"{path} has staged version changes absent from the working tree; resolve them first")
        _, baseline = version_fields(path, original)
        # Check both snapshots so staging cannot conceal an unrelated edit or replace it silently.
        for text in (staged, working):
            versions, remainder = version_fields(path, text)
            if remainder != baseline:
                fail(f"{path} has changes beyond its version fields; commit them separately")
            if text != original and any(value != version for value in versions):
                fail(f"pending version fields in {path} must all equal {version}")
    return sorted(paths)


def prepare_release(
    scope: str, version: str, update_version: bool = False
) -> tuple[str, str, list[str], dict[str, str]]:
    if not SEMVER_PATTERN.fullmatch(version):
        fail(f"not a semantic version: {version!r}")
    if version == "0.0.0":
        fail("0.0.0 is the placeholder, not a release version")
    if command("git", "symbolic-ref", "--quiet", "HEAD", capture=True, check=False).returncode != 0:
        fail("check out a branch before preparing a release")
    version_file = VERSION_FILES[scope]
    declared, _ = version_fields(version_file, read_file(version_file))
    if not update_version and declared != [version]:
        fail(f"{version_file} declares {declared[0]}, expected {version}; update it manually or pass --update-version")

    tag = f"{scope}/v{version}"
    if git("tag", "--list", tag).strip():
        fail(f"tag {tag} already exists")
    changelog = f"{scope}/CHANGELOG.md"
    existing = read_file(changelog) if os.path.exists(os.path.join(ROOT, changelog)) else ""
    if any(line.startswith(f"## v{version} (") for line in existing.splitlines()):
        fail(f"{changelog} already has a section for v{version}")
    changed = check_worktree(scope, version, update_version)
    if scope in GENERATED_SCOPES:
        command(sys.executable, BINDING_GENERATOR, scope, "--check")
    # The shared generator owns schema propagation and release ordering, including during a dry run.
    command(sys.executable, CHANGE_LOG_GENERATOR, scope, version, "--check-bump")
    section = command(sys.executable, CHANGE_LOG_GENERATOR, scope, version, "--dry-run", capture=True).stdout
    updates = {}
    if update_version:
        version_paths = [version_file, NODE_LOCK_FILE] if scope == "node" else [version_file]
        for path in version_paths:
            original = read_file(path)
            updated = render_version(path, original, version)
            if updated != original:
                updates[path] = updated
    return section + ("\n" + existing if existing else ""), tag, changed, updates


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Build a changelog, commit, and tag a release locally.")
    parser.add_argument("scope", choices=VERSION_FILES)
    parser.add_argument("version")
    parser.add_argument(
        "--update-version", action="store_true", help="update the scope's version files before committing"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="run all checks and preview the changelog without writing"
    )
    args = parser.parse_args()

    changelog = f"{args.scope}/CHANGELOG.md"
    original_head = git("rev-parse", "HEAD").strip()
    content, tag, changed, updates = prepare_release(args.scope, args.version, args.update_version)
    version_paths = sorted(set(changed) | updates.keys())
    if args.dry_run:
        for path in updates:
            print(f"release: would update {path} to {args.version}")
        print(content, end="")
        print(
            f"release: ready to commit {', '.join([*version_paths, changelog])} and tag {tag}; no files or refs changed"
        )
        return

    if git("rev-parse", "HEAD").strip() != original_head:
        fail("HEAD changed during release checks; run the command again")

    # Recheck pending edits before staging to avoid collecting unrelated changes made during preflight.
    if check_worktree(args.scope, args.version, args.update_version) != changed:
        fail("version files changed during release checks; run the command again")
    for path, updated in updates.items():
        write_file(path, updated)
    write_file(changelog, content)

    command("git", "add", "--", *version_paths, changelog)
    staged = changed_paths("diff", "--cached", "--name-only", "-z", "--")
    if staged != {*version_paths, changelog}:
        fail("unexpected staged files; inspect the index before committing")

    command("git", "diff", "--cached", "--check")
    command("git", "log", "-5", "--format=%s")
    command("git", "commit", "-m", f"release({args.scope}): v{args.version}")

    commit = git("rev-parse", "HEAD").strip()
    result = command("git", "tag", tag, commit, check=False)
    if result.returncode != 0:
        fail(
            f"release commit {commit} exists but tag creation failed; resolve the error, then run git tag {tag} {commit}"
        )
    print(f"release: tagged {tag} at {commit[:7]}; push the commit and tag when ready to publish")


if __name__ == "__main__":
    try:
        main()
    except OSError as error:
        fail(str(error))
