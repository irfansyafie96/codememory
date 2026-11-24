# AGENTS.md — CodeMemory Repository Rules

## Project Context
- Package: `@irfansyafie/codememory` (ESM Node.js CLI + MCP server + Python MkDocs viewer)
- Repo root uses `"type": "module"` — always use ESM `import`/`export` (never `require()`).
- Must stay cross-OS compatible (Windows, macOS, Linux) and work on Node 20+ and Python 3.12+ (including Python 3.15 SafeLoader — never add `!!python/name:` tags to `viewer/mkdocs.base.yml`).

## Branching & Issue Workflow
- **Issue numbering:** Always use the GitHub Issue number (`#1`, `#2`, etc.).
- **Never** develop bug fixes or features directly on `main` (`main` always matches the latest published npm release).
- Always branch each issue off an up-to-date `main`:
  - Bug fix: `fix/issue-<N>-<short-slug>` (e.g. `fix/issue-1-cursorrules-path`)
  - Feature: `feat/issue-<N>-<short-slug>` (e.g. `feat/issue-2-custom-queries`)
  - Docs / Chore: `docs/<short-slug>` or `chore/<short-slug>`
- **Commits:** Use Conventional Commits (`fix:`, `feat:`, `docs:`, `test:`, `chore:`). Include `closes #<N>` in the commit/PR when resolving a GitHub Issue.

## Verification Checklist (Required Before Pushing)
1. Add or update a regression test in `test/codememory.test.js` reproducing the bug/feature.
2. Run `npm test` — all tests must pass (`0` failures).
3. If `viewer/` or `templates/` changed, run a local `mkdocs build` smoke test in a temp folder outside the repo and delete it afterward.
4. Run `npm pack --dry-run` to confirm no dev/test/hidden files leaked into the npm tarball (controlled by `"files"` in `package.json`).

## Versioned Release Workflow (`release/vX.Y.Z` -> `main`)
1. Decide the next SemVer version (`MAJOR.MINOR.PATCH`):
   - Bug fixes only -> bump **PATCH** (e.g. `1.0.10` -> `1.0.11`, branch `release/v1.0.11`)
   - Includes any new feature -> bump **MINOR** (e.g. `1.0.10` -> `1.1.0`, branch `release/v1.1.0`)
   - Breaking change -> bump **MAJOR** (e.g. `1.1.0` -> `2.0.0`, branch `release/v2.0.0`)
   - Urgent crash hotfixes may ship immediately as a single-issue patch release (`release/vX.Y.Z`); normal fixes/features bundle weekly.
2. Create `release/vX.Y.Z` from `main` and merge only the ready `fix/issue-*` / `feat/issue-*` branches into it.
3. Push `release/vX.Y.Z` and verify GitHub Actions CI passes across Ubuntu, Windows, and macOS.
4. Bump `package.json` to `X.Y.Z` (e.g. `npm version patch --no-git-tag-version` or `npm version minor --no-git-tag-version`), commit, and merge `release/vX.Y.Z` into `main` (via PR).
5. On `main`, tag the release and publish to npm (only when user requests publish):
   - `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
   - `git push origin main --tags`
   - `npm publish --access public`
6. Delete the merged `release/vX.Y.Z` branch (local and remote) so the next release starts clean from `main`.
