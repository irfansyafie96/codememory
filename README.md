# 🧠 CodeMemory

[![npm version](https://img.shields.io/npm/v/@irfansyafie/codememory.svg)](https://www.npmjs.com/package/@irfansyafie/codememory)
[![CI](https://github.com/irfansyafie96/codememory/actions/workflows/ci.yml/badge.svg)](https://github.com/irfansyafie96/codememory/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Protocol%201.0-blue)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)
[![Zensical Ready](https://img.shields.io/badge/Zensical-Ready%20(2027+)-purple)](https://zensical.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/irfansyafie96/codememory/pulls)

**Local-first, AI-native engineering memory & Universal Model Context Protocol (MCP) server.**

Stop solving the same bugs twice. Give your AI coding assistants (Antigravity, Cursor, Claude Code, OpenAI Codex CLI, OpenCode) a persistent, local engineering second brain for bugs, features, design decisions, and safe SQL patches.

---

## ⚡ The Problem

1. **AI Context Amnesia:** Every time you start a new chat with an AI assistant, it forgets the subtle race condition you diagnosed last week, database quirks, and why a library or pattern was chosen.
2. **Buried Engineering Truths:** Critical fixes, diagnostic queries, and design trade-offs get lost in closed tickets, chat logs, or developer heads.
3. **Dangerous Production Patches:** Rushed SQL scripts run against production without pre-verification or explicit transaction controls cause avoidable outages.

---

## 💡 The Solution: CodeMemory

`codememory` bridges the gap between your repository and AI coding assistants:

* 🎯 **One Unified Layout:** Clean skeleton by default — works for both bug fixing and building features. Empty optional sections (`patches/`, `queries/`) stay hidden in the Book Reader until you use them.
* 🤝 **Propose-First Logging:** After fixing a bug or finishing a feature, the AI proposes what should be saved and waits for your approval instead of writing files on its own instinct.
* 🔢 **Auto-Numbering or Real Tracker IDs:** Omit `id` and entries auto-number sequentially (`1`, `2`, `3`...), or pass your real issue/ticket ID (`#12`, `286705`, `PROJ-42`).
* 🧩 **Multi-Client Skill Installer:** Detects and installs the unified `SKILL.md` into official paths for **Antigravity**, **Claude Code**, **Cursor**, and **OpenAI Codex CLI** (plus delivers rules automatically over MCP `instructions`).
* 🛡️ **3-Step SQL Patch Standard:** Enforces `PRE-CHECK`, `EXECUTE`, and `POST-CHECK` verification on all database scripts.
* 📖 **Interactive Book Reader:** Turns your Markdown notes and Mermaid diagrams into a searchable local web book (MkDocs Material, forward-compatible with Zensical 2027+) with a configurable `viewerPort`.
* 🔒 **100% Local & Private:** Zero cloud tracking, zero external telemetry. Everything stays plain Markdown inside your folder.

---

## 🚀 Quick Start

Initialize CodeMemory in seconds using `npx`:

```bash
# Interactive setup (asks folder, port, sample notes, and AI tools):
npx @irfansyafie/codememory@latest init

# Non-interactive examples:
npx @irfansyafie/codememory@latest init --dir ./codememory
npx @irfansyafie/codememory@latest init --dir ./codememory --port 8003 --examples
npx @irfansyafie/codememory@latest init --dir ./codememory --clients claude,cursor,codex,antigravity --scope project

# Or direct from GitHub:
npx -y github:irfansyafie96/codememory init
```

---

## 📁 What Gets Created?

One clean unified folder layout (sample content is omitted by default unless `--examples` is passed):

```text
codememory/
├── codememory.config.json    # Name, viewerPort (default 8000), and auto-number counter
├── issues/                   # Bugs, features & decisions (3-part layout: Issue -> Fix -> Realized)
├── playbooks/                # Repeatable step-by-step guides (setup, releases, recurring fixes)
├── patches/                  # Verified 3-step SQL patches (created when first patch is saved)
├── queries/                  # Verified diagnostic SELECT queries (created when added)
├── architecture.md           # System flows, ER diagrams & screen-to-service-to-table code map
├── errors.md                 # Recurring exceptions, stack traces & verified fixes
├── gotchas.md                # Subtle traps, environment quirks & key design decisions
├── INDEX.md                  # Master searchable index table
├── README.md                 # Local overview ("How to use" page in the Book Reader)
├── open-book.bat             # Windows Book Reader launcher
└── open-book.sh              # macOS / Linux Book Reader launcher
```

---

## 🤖 Connecting Your AI Assistant (MCP)

Add CodeMemory to your AI assistant configuration:

### Google Antigravity & Claude Desktop
Add this to your `mcp_config.json`:
```json
{
  "mcpServers": {
    "codememory": {
      "command": "npx",
      "args": ["-y", "@irfansyafie/codememory@latest", "--dir", "/absolute/path/to/codememory"]
    }
  }
}
```

### Cursor IDE
1. Open Cursor Settings -> **Features** -> **MCP Servers**.
2. Click **+ Add New MCP Server**.
3. Name: `codememory` | Type: `command` | Command: `npx -y @irfansyafie/codememory@latest --dir /absolute/path/to/codememory`

### OpenCode
Add this to your OpenCode configuration (`opencode.json`):
```json
{
  "mcp": {
    "codememory": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "@irfansyafie/codememory@latest",
        "--dir",
        "/absolute/path/to/codememory"
      ],
      "enabled": true
    }
  }
}
```
*(On Windows, if needed, you can use `"npx.cmd"` instead of `"npx"`).*

---

## 🛠️ MCP Tools Reference

| Tool | Description |
| :--- | :--- |
| `search_memory(query, category)` | Keyword search across `all`, `issues`, `playbooks`, `patches`, `queries`, `errors`, `gotchas`, or `architecture`. |
| `lookup_error(error_query)` | Searches error signatures, stack traces, and error codes across `errors.md`, `gotchas.md`, and `issues/`. |
| `get_entry(id)` | Retrieves a logged issue (`1`, `12`, `#286705`, `PROJ-42`) plus any attached SQL patch, or finds playbooks/queries by name. |
| `log_entry(...)` | Logs an approved `bug`, `feature`, or `decision` into `issues/<id>.md` (auto-numbers `1, 2, 3...` if `id` is omitted), updates `INDEX.md`, cleans file badges, and syncs the Book Reader. |
| `get_relationships(keyword)` | Returns system flows, ER diagrams, and multi-table synchronization rules from `architecture.md`. |
| `get_codemap(keyword)` | Searches screen-to-service, controller-to-database, and API mappings. |

---

## 📐 The Standards

### 1. The 3-Part Note Layout
Bugs, features, and decisions all share one concise 3-part layout:
```markdown
# 1 - Null Pointer Exception in Coupon Calculation
**Type:** Bug | **Env/Status:** PROD | **Branch:** `fix/issue-1-coupon-npe`

### 1. What was the issue?
Zero-dollar coupons returned an empty rate object from the upstream service, causing an NPE.

### 2. How did I fix it?
Added null-safe defensive fallback in `OrderCalculationService.java`.

* **Files changed:**
    * `OrderCalculationService.java`
    * `CouponValidator.java`

### 3. What did I realize?
* **Missing payload field:** Third-party coupon microservice omits the float rate attribute when promo is 100% off.
```

### 2. The 3-Step SQL Patch Standard
Every database modification script in `patches/` must include 3 explicit phases:
```sql
-- STEP 1: PRE-CHECK (Verify target rows before any changes)
SELECT id, status FROM orders WHERE id = 'ORD-100234';
-- Expected: 1 row returned with status = 'PENDING'

-- STEP 2: EXECUTE (Run inside explicit transaction with PK filter)
BEGIN;
UPDATE orders SET status = 'PAID' WHERE id = 'ORD-100234' AND status = 'PENDING';
-- Expected: 1 row updated
COMMIT;

-- STEP 3: POST-CHECK (Confirm final persisted values)
SELECT id, status FROM orders WHERE id = 'ORD-100234';
-- Expected: 1 row returned with status = 'PAID'
```

---

## 📖 Interactive Book Viewer

CodeMemory comes with an interactive, searchable documentation reader. The launcher automatically installs `mkdocs-material` on its first run if it isn't already installed!

```bash
# On Windows (double-click or run):
open-book.bat

# On macOS / Linux:
chmod +x open-book.sh && ./open-book.sh

# Or manually:
cd .viewer
python sync.py
python -m mkdocs serve
```
The port is configured via `--port` during `init` or `"viewerPort"` in `codememory.config.json` (default `8000`), so you can run multiple CodeMemory books side by side on different ports.

---

## 🗑️ Uninstalling

CodeMemory runs via `npx` and installs nothing globally unless you installed it with `npm install -g`. To remove it cleanly:

1. **Disconnect the MCP server:** Remove the `"codememory"` entry from your AI assistant's config (`mcp_config.json`, Cursor MCP Settings, or `opencode.json`).
2. **Remove installed skills & rules** *(only if you installed them via `--clients` during `init`)*:
   - **Project scope:** Delete `.agents/skills/codememory/`, `.claude/skills/codememory/`, `.cursor/skills/codememory/`, and `.cursor/rules/codememory.mdc`. In `AGENTS.md` / `CLAUDE.md`, remove the block between `<!-- codememory:start -->` and `<!-- codememory:end -->`.
   - **Global scope:** Delete the `codememory/` folder from `~/.gemini/config/skills/`, `~/.claude/skills/`, `~/.cursor/skills/`, or `~/.codex/skills/`.
3. **Notes folder (optional):** Your `./codememory` folder is plain Markdown — keep it for reference, or delete it if you no longer need the notes.
4. **Book Reader (optional):** If you opened the Book Reader and don't use MkDocs elsewhere, run `pip uninstall mkdocs-material`.

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are warmly welcome!

Found a bug or have an idea? [Open an Issue](https://github.com/irfansyafie96/codememory/issues/new/choose) using the Bug Report or Feature Request form! See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, branch naming, and PR guidelines.

1. Fork the Project
2. Create your Branch (`git checkout -b fix/issue-1-short-description` or `git checkout -b feat/issue-2-short-description`)
3. Commit your Changes (`git commit -m 'feat: add amazing feature (closes #2)'`)
4. Push to the Branch (`git push origin feat/issue-2-short-description`)
5. Open a Pull Request

---

## 👤 Author

**Irfan Syafie**

* GitHub: [@irfansyafie96](https://github.com/irfansyafie96)
* Email: [irfansyafie96@gmail.com](mailto:irfansyafie96@gmail.com)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
