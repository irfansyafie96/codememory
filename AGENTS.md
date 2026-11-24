# AGENTS.md — CodeMemory Repository Rules

## Project Context
- Package: `@irfansyafie/codememory` (ESM Node.js CLI + MCP server + Python MkDocs viewer)
- Repo root uses `"type": "module"` — always use ESM `import`/`export` (never `require()`).
- Must stay cross-OS compatible (Windows, macOS, Linux) and work on Node 20+ and Python 3.12+ (including Python 3.15 SafeLoader — never add `!!python/name:` tags to `viewer/mkdocs.base.yml`).

## Branching & Issue Workflow
- **Issue numbering:** Always use the GitHub Issue number (`#1`, `#2`, etc.).
- **Never** develop bug fixes or features directly on `main`. Always branch off an up-to-date `main`:
  - Bug fix: `fix/issue-<N>-<short-slug>` (e.g. `fix/issue-1-cursorrules-path`)
  - Feature: `feat/issue-<N>-<short-slug>` (e.g. `feat/issue-2-custom-queries`)
  - Docs / Chore: `docs/<short-slug>` or `chore/<short-slug>`
- **Commits:** Use Conventional Commits (`fix:`, `feat:`, `docs:`, `test:`, `chore:`). Include `closes #<N>` in the final commit/PR when resolving a GitHub Issue.

## Verification Checklist (Required Before Pushing)
1. Add or update a regression test in `test/codememory.test.js` reproducing the bug/feature.
2. Run `npm test` — all tests must pass (`0` failures).
3. If `viewer/` or `templates/` changed, run a local `mkdocs build` smoke test in a temp folder outside the repo and delete it afterward.
4. Run `npm pack --dry-run` to confirm no dev/test/hidden files leaked into the npm tarball (controlled by `"files"` in `package.json`).

## Releasing to npm (Only When Requested)
1. Merge the verified branch into `main` (prefer Squash and Merge for PRs) and ensure GitHub Actions CI is green across Ubuntu, Windows, and macOS.
2. Bump version on `main`:
   - Bug fix: `npm version patch`
   - New feature: `npm version minor`
3. Push code and tags: `git push origin main --tags`
4. Publish: `npm publish --access public`
