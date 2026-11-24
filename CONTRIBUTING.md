# Contributing to CodeMemory

Thanks for helping test and improve **CodeMemory**!

## Reporting Bugs or Requesting Features
Please [open an Issue](https://github.com/irfansyafie96/codememory/issues/new/choose) using the **Bug Report** or **Feature Request** template so we have your OS, AI client, and reproduction steps.

## Local Development
```bash
git clone https://github.com/irfansyafie96/codememory.git
cd codememory
npm install
npm test
```

## Pull Request Workflow
1. Branch off `main` using:
   - `fix/issue-<N>-<short-slug>` for bug fixes
   - `feat/issue-<N>-<short-slug>` for new features
2. Add or update tests in `test/codememory.test.js` and make sure `npm test` passes.
3. Open a Pull Request referencing the issue (e.g. `Closes #1`). GitHub Actions will automatically verify Ubuntu, Windows, and macOS builds.
