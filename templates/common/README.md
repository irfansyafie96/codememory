# Engineering Memory & Knowledge Base

Welcome to your project's **CodeMemory** repository.

This directory serves as the persistent, local-first engineering memory for your team and your AI coding assistants (Antigravity, Cursor, Claude Code, GitHub Copilot).

---

## 📂 Structure Overview

Depending on your configured mode (`ticket`, `project`, or `hybrid`), this memory repository contains:

* **`tickets/`**: 3-part incident records capturing root causes, code fixes, and key realizations.
* **`patches/`**: Production-tested SQL patches with strict 3-step verification (`PRE-CHECK`, `EXECUTE`, `POST-CHECK`).
* **`features/`**: Feature documentation covering goals, implementations, architecture flows, and trade-offs.
* **`adr/`**: Architecture Decision Records capturing the context and trade-offs of key design choices.
* **`playbooks/` & `runbooks/`**: Standard operating procedures for recurring incidents and onboarding.
* **`errors.md`**: Dictionary of server log exceptions and verified remediation steps.
* **`gotchas.md`**: Living catalog of architectural traps, concurrency bugs, and edge cases.
* **`relationships.md` / `architecture.md`**: Entity relationship diagrams, multi-table synchronization rules, and system flows.

---

## 📖 Viewing as an Interactive Book

You can browse your entire knowledge base in an interactive, searchable documentation reader:

```bash
# On Windows:
open-book.bat

# Or manually:
cd .viewer
python sync.py
python -m mkdocs serve
```
Then open `http://localhost:8000` in your browser.

---

## 🤖 AI Assistant Integration (MCP)

To connect your AI assistant directly to this engineering memory, register the MCP server:

### For Cursor / Antigravity / Claude Desktop:
```json
{
  "mcpServers": {
    "codememory": {
      "command": "npx",
      "args": ["-y", "@irfansyafie/codememory", "--dir", "."]
    }
  }
}
```

### For OpenCode:
```json
{
  "codememory": {
    "type": "local",
    "command": ["npx", "-y", "@irfansyafie/codememory", "--dir", "."],
    "enabled": true
  }
}
```

When debugging, ask your AI:
> *"Check memory for duplicate sequence errors"*
> *"Look up error ORA-00001"*
> *"Log this ticket/feature into memory"*
