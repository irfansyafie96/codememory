---
name: codememory
description: Use when fixing a bug, building a feature, or making a technical decision in a project that has the CodeMemory MCP server. Consult past issues, errors and gotchas before starting; after the work is verified, PROPOSE what to save and only log what the user approves.
---

# CodeMemory Skill

CodeMemory is this project's local engineering memory. It is exposed through the `codememory` MCP server (`search_memory`, `lookup_error`, `get_entry`, `get_relationships`, `get_codemap`, `log_entry`) and stored as plain Markdown.

---

## 1. Before You Start (Check Memory First)

When the user mentions a bug, error message, ticket id, feature, or design question:

1. **Errors and stack traces:** call `lookup_error` with the message or exception name.
2. **Past work:** call `search_memory` with the key terms, or `get_entry` when an id is mentioned (for example `12`, `#286705`, `PROJ-42`).
3. **Architecture:** call `get_relationships` (or read `architecture.md`) before changing schemas, joins, or service boundaries.
4. **Traps and decisions:** check `gotchas.md` for known pitfalls and earlier design choices.
5. **Procedures:** check `playbooks/` for an existing step-by-step recipe, and `queries/` for verified diagnostic queries, before writing new ones.

---

## 2. Formatting Rules

When writing notes, patches, or documentation:

1. **File names:** wrap file names in backticks (`` `OrderService.java` ``) and never use long paths. Nest them under `* **Files changed:**` with 4 spaces.
2. **4-space indentation:** indent nested sub-bullets and sub-steps with at least 4 spaces. Two or three spaces make Markdown squash items into one line with literal `*` characters.
3. **Blank line before lists:** always leave an empty line before a bullet or numbered list, including inside blockquotes (`>` line first).
4. **SQL patches use 3 steps:**
    * `STEP 1: PRE-CHECK` - a `SELECT` with the expected row count.
    * `STEP 2: EXECUTE` - an explicit transaction (`BEGIN; ... COMMIT;`) filtering by exact primary keys.
    * `STEP 3: POST-CHECK` - a `SELECT` confirming the final state.
5. **No secrets:** never write passwords, tokens, connection strings, or personal data into notes.

---

## 3. After the Work Is Verified: Propose First, Then Log

**Never write to CodeMemory on your own initiative.** When a fix, feature, or decision is finished and verified:

1. **Stop and present a numbered proposal** of what could be saved, for example:

    > The work is verified. Would you like me to save any of these to CodeMemory?
    >
    > 1. **Issue (Bug):** "Port clash when two Book Readers run" - files `cli.js`, `sync.py`
    > 2. **Gotcha:** Windows Store dummy `python` alias breaks the launcher
    > 3. **Error:** `E404` on `npm publish` when the token expired
    >
    > Tell me which items to save, or what to change.

2. Only suggest items that are genuinely reusable. Typical homes: an issue entry, `errors.md`, `gotchas.md`, `architecture.md`, a playbook, a verified query.
3. **Wait for the user's answer.** Save only what they approved, in the wording they accepted.

### Logging an issue (`log_entry`)

* **`type`:** `bug`, `feature`, or `decision`. All three use the same three sections:
    1. *What was the issue?* (the goal for a feature, the question for a decision)
    2. *How did I fix it?* (how it was built, or what was chosen)
    3. *What did I realize?* (lessons, trade-offs, gotchas as `Label: detail`)
* **`id`:** if the user has a tracker, pass its real id (`12`, `#286705`, `PROJ-42`). If not, **omit `id`** and CodeMemory auto-numbers 1, 2, 3.
* **`sql_patch`:** include only when a database change was made, in the 3-step format above.
* Existing ids are never overwritten unless the user asks for it.

`errors.md`, `gotchas.md`, `architecture.md`, playbooks, and queries have no logging tool: after approval, edit those files directly following the formatting rules.

---

## 4. Where Things Live

| What | Where |
| :--- | :--- |
| Bugs, features, decisions | `issues/<id>.md` + a row in `INDEX.md` |
| SQL / migration patches | `patches/<id>_patch.sql` |
| Repeatable procedures | `playbooks/` |
| Verified diagnostic queries | `queries/` |
| Flows, ER diagrams, code map | `architecture.md` |
| Recurring errors | `errors.md` |
| Traps and key decisions | `gotchas.md` |
