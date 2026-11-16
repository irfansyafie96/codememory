# 🧠 CodeMemory

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Protocol%201.0-blue)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)
[![Zensical Ready](https://img.shields.io/badge/Zensical-Ready%20(2027+)-purple)](https://zensical.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/irfansyafie96/codememory/pulls)

**Local-first, AI-native engineering memory & Universal Model Context Protocol (MCP) server.**

Stop solving the same bugs twice. Give your AI coding assistants (Antigravity, Cursor, Claude Code, Windsurf) a persistent, local engineering second brain for tickets, architectural decisions (ADRs), and safe production patches.

---

## ⚡ The Problem

1. **AI Context Amnesia:** Every time you start a new chat with an AI assistant, it forgets the subtle race condition you diagnosed last week, the database connection quirks, and why a certain library was chosen.
2. **Buried Engineering Truths:** Critical architectural decisions and incident post-mortems get lost in closed tickets, Slack channels, or developer heads.
3. **Dangerous Production Patches:** Rushed SQL scripts run against production without pre-verification or explicit transaction controls cause avoidable outages.

---

## 💡 The Solution: CodeMemory

`codememory` bridges the gap between your repository and AI coding assistants:

* 🎯 **Dual Mode Setup:** Tailored specifically for **maintenance & bug-fixing teams** (`ticket` mode) or **greenfield product builders** (`project` mode), or both (`hybrid`).
* 🔌 **Universal MCP Server:** Exposes 6 purpose-built tools (`search_memory`, `lookup_error`, `get_entry`, `log_entry`, `get_relationships`, `get_codemap`) directly to any MCP-compliant AI assistant.
* 🛡️ **3-Step SQL Patch Standard:** Enforces mandatory `PRE-CHECK`, `EXECUTE`, and `POST-CHECK` verification steps on all database scripts.
* 📖 **Interactive Book Reader:** Includes a local, searchable web documentation reader powered by MkDocs and forward-compatible with Zensical (2027+).
* 🔒 **100% Local & Private:** Zero cloud tracking, zero external telemetry. All notes remain plain Markdown files inside your repository.

---

## 🚀 Quick Start

Initialize CodeMemory in your repository in seconds using `npx`:

```bash
# Direct from GitHub (no installation needed):
npx -y github:irfansyafie96/codememory init --type ticket

# Or once installed/published via NPM:
npx codememory init --type ticket    # For maintenance & bug-fixing projects
npx codememory init --type project   # For greenfield feature development
npx codememory init --type hybrid    # Full suite
```

---

## 📁 What Gets Created?

### 🎟️ Ticket Mode (`--type ticket`)
Designed for operational excellence, bug fixing, and incident resolution:
```text
your-repo/
├── codememory.config.json    # Project configuration
├── tickets/                  # 3-part incident records (Issue, Fix, Learnings)
├── patches/                  # 3-step verification SQL patches
├── playbooks/                # Step-by-step incident resolution recipes
├── relationships.md          # Database ER diagrams & synchronization rules
├── errors.md                 # Server exception signatures & root causes
├── gotchas.md                # Concurrency traps & architectural edge cases
└── INDEX.md                  # Quick lookup index table
```

### 🏗️ Project Mode (`--type project`)
Designed for greenfield development, feature architecture, and system design:
```text
your-repo/
├── codememory.config.json    # Project configuration
├── features/                 # 3-part feature docs (Goal, Implementation, Trade-offs)
├── adr/                      # Architecture Decision Records (Context, Outcome, Consequences)
├── runbooks/                 # Developer setup, migrations & local workflows
├── architecture.md           # System topology, data flow sequences & invariants
├── errors.md                 # Runtime error dictionary
├── gotchas.md                # Anti-patterns & library traps
└── INDEX.md                  # Features and ADR index table
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
      "args": ["-y", "codememory", "--dir", "."]
    }
  }
}
```

### Cursor IDE
1. Open Cursor Settings -> **Features** -> **MCP Servers**.
2. Click **+ Add New MCP Server**.
3. Name: `codememory`
4. Type: `command`
5. Command: `npx -y codememory --dir .`

---

## 🛠️ MCP Tools Reference

| Tool | Description |
| :--- | :--- |
| `lookup_error(error_query)` | Instantly searches error signatures, stack traces, and exception logs across `errors.md` and past incident notes. |
| `search_memory(query, category)` | Keyword and semantic search across all tickets, features, ADRs, playbooks, and runbooks. |
| `get_entry(id)` | Retrieves the complete note and attached SQL patch for a specific ticket (`001`), feature (`FEAT-001`), or ADR (`ADR-001`). |
| `log_entry(...)` | Programmatically creates a note, formats files changed with clean backticked badges, updates `INDEX.md`, and syncs the documentation book. |
| `get_relationships(keyword)` | Returns domain entity models, ER diagrams, and multi-table synchronization rules. |
| `get_codemap(keyword)` | Searches screen-to-service, controller-to-database, and API mappings. |

---

## 📐 The Standards

### 1. The 3-Part Note Architecture
Every ticket or feature record follows an intuitive 3-part layout:
```markdown
# 001 - Null Pointer Exception in Coupon Calculation
**Environment:** PROD | **Branch:** `fix/coupon-npe`

### 1. What was the issue? (or Goal)
Zero-dollar coupons returned an empty rate object from the upstream service, causing an NPE.

### 2. How did I fix it? (or Built)
Added null-safe defensive fallback in `OrderCalculationService.java`.

* **Files changed:**
    * `OrderCalculationService.java`
    * `CouponValidator.java`
* **Patch / Migration:** None (code fix only).

### 3. What did I realize & trade-offs?
* Third-party coupon microservice omits the float rate attribute when promo is 100% off.
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

CodeMemory comes with an interactive, searchable documentation reader (requires `pip install mkdocs-material`):

```bash
# On Windows:
open-book.bat

# On macOS / Linux:
chmod +x open-book.sh && ./open-book.sh

# Or manually:
cd .viewer
python sync.py
python -m mkdocs serve
```
Open `http://localhost:8000` to browse your engineering knowledge base with dark/light themes and Mermaid diagram rendering.

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are warmly welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👤 Author

**Irfan Syafie**
* GitHub: [@irfansyafie96](https://github.com/irfansyafie96)
* Email: [irfansyafie96@gmail.com](mailto:irfansyafie96@gmail.com)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
