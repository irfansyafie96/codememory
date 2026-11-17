---
name: codememory
description: Connects AI agents to CodeMemory, a local-first engineering memory for tickets, architecture decisions, and safe production patches. Always consult memory before fixing bugs or designing new features, and prompt to log resolved work.
---

# CodeMemory Agent Skill

This skill guides your AI assistant on how to consult, navigate, and contribute to **CodeMemory**.

---

## 1. When Starting Work (Check Memory First)

Whenever a user mentions a bug, ticket ID, error message, feature requirement, or architectural question:

1. **Check Errors & Incidents First:**
    * If an exception or stack trace is provided, invoke `lookup_error` or inspect `errors.md` and past incident notes.
    * If a ticket ID or feature code is mentioned, invoke `get_entry` to load historical context and previous attempts.
2. **Review Architectural Constraints & Gotchas:**
    * Inspect `gotchas.md` to avoid known concurrency traps, transaction boundaries, or cache invalidation pitfalls.
    * Inspect `relationships.md` or `architecture.md` before altering database schemas or core service calls.
3. **Verify Playbooks & Runbooks:**
    * Review `playbooks/` or `runbooks/` to follow established team procedures rather than inventing new operational steps.

---

## 2. Formatting & Safety Rules

When generating notes, SQL patches, or documentation:

1. **Clean Filenames with Backticks in "Files changed":**
    * **Always** wrap file names in backticks (e.g. `` `OrderCalculationService.java` ``) so they render as distinct code badges.
    * **Never** include long full repository file paths (e.g. avoid `src/main/java/com/example/...`). Use only clean class/file names.
    * **Always** indent nested file sub-bullets with **at least 4 spaces** (`    * `). Never use 2 or 3 spaces (which breaks Markdown list rendering in MkDocs/Zensical).

2. **Strict 4-Space Indentation for All Sub-Lists & Steps (Prevents Literal `*` Squishing):**
    * **Always** indent nested sub-bullets under numbered steps (`1. Step`) or parent bullets with **at least 4 spaces** (`    * `).
    * **Never** use 2 or 3 spaces: Python-Markdown treats 2 or 3 spaces under an ordered list as a continuous inline paragraph, squishing all items together and printing raw literal `*` characters.

3. **Strict 3-Step SQL Patch Structure:**
    Every database modification patch must follow the 3-step verification model:
    * **`STEP 1: PRE-CHECK`**: Explicit `SELECT` query with expected row counts before modification.
    * **`STEP 2: EXECUTE`**: Explicit transaction block (`BEGIN; ... COMMIT;`), targeting exact primary key IDs.
    * **`STEP 3: POST-CHECK`**: Explicit verification `SELECT` query confirming final state after execution.

---

## 3. Concluding Work (Logging into Memory)

Once a bug fix, feature, or ADR is completed and tested:

1. Prompt the user:
   > *"Work on #[ID] is complete. Would you like me to log this into CodeMemory?"*
2. Upon approval, invoke `log_entry` or format the note using the standard 3-part layout:
    * **Part 1:** What was the issue / goal?
    * **Part 2:** How did we fix it / build it? (Files changed with 4-space indent and backticks)
    * **Part 3:** What did we realize & trade-offs?

---

## 4. Knowledge Base Expansion Checklist (Beyond Single Notes)

A healthy engineering memory compounds across both individual notes and shared knowledge base files. Whenever concluding work, evaluate if any reusable truths should be updated:

1. **`errors.md` (Common Errors):** If this resolved a stack trace, runtime exception, or database error, add the signature, root cause, and verified fix so teammates avoid duplicate investigations.
2. **`gotchas.md` (Gotchas & Traps):** If you uncovered a subtle framework trap, concurrency race condition, silent failure, or deployment quirk, add a concise rule of thumb.
3. **`relationships.md` / `architecture.md`:** If you clarified multi-table join rules, schema constraints, or service boundaries, update the architectural reference.
4. **`playbooks/` / `runbooks/`:** If this operational or patching procedure is a recurring pattern, formalize it into a repeatable step-by-step playbook.
