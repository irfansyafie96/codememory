# CodeMemory Instructions for Claude Code

This project utilizes **CodeMemory** as its persistent engineering memory and knowledge base.

## Workflow Rules
- **Look up past incidents:** If the user provides an error trace or bug description, check `errors.md` and `tickets/` before re-investigating.
- **Consult architecture decisions:** Review `adr/` and `architecture.md` before altering database schemas or core service patterns.
- **Adhere to formatting standards:**
  - In Markdown notes, always indent sub-bullets under parent items or numbered steps with **at least 4 spaces** (`    * `). Never use 2 or 3 spaces (causes Markdown to squish text into a continuous line with literal `*` characters).
  - Format "Files changed" as 4-space indented sub-bullets with clean backticked file names:
    ```markdown
    * **Files changed:**
        * `FileName.ext`
    ```
  - For SQL patches, adhere strictly to the 3-step verification model (`STEP 1: PRE-CHECK`, `STEP 2: EXECUTE`, `STEP 3: POST-CHECK`).
- **Prompt to log upon resolution:** Always ask the user if they would like the completed task logged into CodeMemory.
