# Engineering Memory & Knowledge Base

Welcome to your **CodeMemory** notes. This folder is the persistent, local-first memory for you and your AI coding assistants. Everything is plain Markdown, so it works with Git, any editor, and any AI tool.

---

## Structure

* **`issues/`**: one note per bug, feature, or decision (`1.md`, `2.md`, ... or your tracker id such as `286705.md`). Every note has three sections: *What was the issue? / How did I fix it? / What did I realize?*
* **`INDEX.md`**: the master table of all logged issues.
* **`playbooks/`**: repeatable step-by-step guides (setup, releases, recurring fixes).
* **`patches/`**: verified SQL or migration patches with a 3-step check (`PRE-CHECK`, `EXECUTE`, `POST-CHECK`). Created when you log your first patch.
* **`queries/`**: verified diagnostic queries you reuse. Created when you add your first one.
* **`architecture.md`**: system flows, ER diagrams, and screen-to-service-to-table code map.
* **`errors.md`**: recurring errors and stack traces with verified fixes.
* **`gotchas.md`**: traps, quirks, and the reasons behind key design decisions.

---

## Reading It as a Book

```bash
# Windows: double-click
open-book.bat

# macOS / Linux
./open-book.sh
```

The Book Reader opens on the port stored as `viewerPort` in `codememory.config.json` (default `8000`). Change that number to run several books side by side.

---

## Connecting Your AI (MCP)

Add the server to your assistant's MCP settings and point `--dir` at this folder:

```json
{
  "mcpServers": {
    "codememory": {
      "command": "npx",
      "args": ["-y", "@irfansyafie/codememory@latest", "--dir", "<path to this folder>"]
    }
  }
}
```

---

## How Logging Works

1. You fix a bug or build a feature with your AI.
2. When it is verified, your AI **proposes** what is worth saving (an issue, a gotcha, an error, a playbook...).
3. You approve, and only the approved items are written.

**Numbering:** with no ticket system, entries are numbered `1, 2, 3...` automatically. If you use a tracker (GitHub Issues, Jira, Redmine), your AI passes the real id (`12`, `#286705`, `PROJ-42`) instead.

Try asking: *"Check CodeMemory before I fix this"*, *"Look up this error"*, or *"What did we learn from issue 3?"*
