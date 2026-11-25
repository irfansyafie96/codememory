import fs from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";

// 1. Resolve root notes directory
function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

const dirArg = parseArg("--dir");
const BASE_DIR = path.resolve(dirArg || process.env.CODEMEMORY_DIR || process.cwd());

// 2. Load codememory.config.json if present
let config = { name: "CodeMemory", type: "hybrid" };
const configPath = path.join(BASE_DIR, "codememory.config.json");
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err) {
    console.error("Warning: Failed to parse codememory.config.json:", err.message);
  }
}

// 3. Helper: Clean filename to badge
function cleanFileBadge(f) {
  let name = f.trim();
  if (name.startsWith("`") && name.endsWith("`")) {
    name = name.slice(1, -1).trim();
  }
  name = path.basename(name);
  return `\`${name}\``;
}

// 3b. Helper: Auto-correct 1-3 space indented bullets to 4 spaces
function sanitizeMarkdownLists(text) {
  if (!text || typeof text !== "string") return text;
  return text
    .split("\n")
    .map((line) => {
      if (/^[ ]{1,3}[\*\-]\s/.test(line)) {
        return "    " + line.trimStart();
      }
      return line;
    })
    .join("\n");
}

// 4. Helper: Recursively search text in markdown files
function searchFiles(dir, query, ext = ".md") {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const qLower = query.toLowerCase();

  function scan(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== "node_modules" && ent.name !== ".git" && ent.name !== ".viewer") {
          scan(full);
        }
      } else if (ent.isFile() && ent.name.endsWith(ext)) {
        try {
          const content = fs.readFileSync(full, "utf-8");
          if (content.toLowerCase().includes(qLower)) {
            const rel = path.relative(BASE_DIR, full);
            const lines = content.split("\n");
            const matches = [];
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(qLower)) {
                matches.push({ line: i + 1, text: lines[i].trim() });
                if (matches.length >= 5) break;
              }
            }
            results.push({
              file: rel,
              path: full,
              matches,
            });
          }
        } catch {}
      }
    }
  }

  scan(dir);
  return results;
}

// 5. Initialize MCP Server
const server = new Server(
  {
    name: "codememory",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 6. Define ListTools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_memory",
        description:
          "Fast keyword and semantic search across all engineering memory (tickets, features, ADRs, playbooks, runbooks, errors, gotchas).",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search keyword, function name, table name, or phrase.",
            },
            category: {
              type: "string",
              enum: ["all", "tickets", "features", "playbooks", "adr", "runbooks", "errors", "gotchas"],
              description: "Optional folder/category filter. Defaults to 'all'.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "lookup_error",
        description:
          "Search error signatures, exception logs, stack traces, and error codes in errors.md and past incidents.",
        inputSchema: {
          type: "object",
          properties: {
            error_query: {
              type: "string",
              description: "Error message, exception class (e.g. NullPointerException, ORA-00001), or stack trace.",
            },
          },
          required: ["error_query"],
        },
      },
      {
        name: "get_entry",
        description:
          "Retrieve a complete ticket, feature, ADR, or playbook note and any associated SQL patches by ID or filename.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Ticket ID (e.g. '001', '281735'), feature ID ('FEAT-001'), or ADR ID ('ADR-001').",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "get_relationships",
        description:
          "Retrieve domain entity models, ER diagrams, foreign key relationships, and synchronization rules.",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Optional table or entity name to filter.",
            },
          },
        },
      },
      {
        name: "get_codemap",
        description:
          "Find mappings between UI screens, services, controllers, database tables, and external integrations.",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Class name, screen, API endpoint, or service to map.",
            },
          },
          required: ["keyword"],
        },
      },
      {
        name: "log_entry",
        description:
          "Programmatically log a resolved ticket or completed feature into CodeMemory, update INDEX.md, format files changed cleanly with backticks, and save patches.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["ticket", "feature", "adr"],
              description: "Entry type.",
            },
            id: {
              type: "string",
              description: "ID (e.g. '002', 'FEAT-002', 'ADR-002').",
            },
            title: {
              type: "string",
              description: "Short, descriptive title in plain words.",
            },
            status_or_env: {
              type: "string",
              description: "Environment (e.g. 'PROD', 'STG') or Status (e.g. 'Completed', 'Accepted').",
            },
            summary_issue: {
              type: "string",
              description: "What was the issue or what was the feature goal?",
            },
            solution: {
              type: "string",
              description: "How was it fixed or built?",
            },
            files_changed: {
              type: "array",
              items: { type: "string" },
              description: "List of modified file names. Full paths are automatically stripped to clean backticked badges.",
            },
            sql_patch: {
              type: "string",
              description:
                "Optional SQL patch statements saved into patches/. Must follow 3-step verification: STEP 1: PRE-CHECK (SELECT with expected count), STEP 2: EXECUTE (BEGIN...COMMIT with explicit PK), and STEP 3: POST-CHECK (verification SELECT).",
            },
            learnings: {
              type: "array",
              items: { type: "string" },
              description: "Key realizations, trade-offs, or gotchas learned.",
            },
            branch: {
              type: "string",
              description: "Optional Git branch name.",
            },
          },
          required: ["type", "id", "title", "summary_issue", "solution"],
        },
      },
    ],
  };
});

// 7. Handle CallTool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_memory") {
      const query = args.query;
      const cat = args.category || "all";
      let searchDir = BASE_DIR;

      if (cat !== "all") {
        const candidate = path.join(BASE_DIR, cat);
        if (fs.existsSync(candidate)) searchDir = candidate;
      }

      const results = searchFiles(searchDir, query);
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No results found for "${query}" in category: ${cat}.` }],
        };
      }

      let text = `Found ${results.length} file(s) matching "${query}":\n\n`;
      for (const res of results.slice(0, 15)) {
        text += `### [${res.file}]\n`;
        for (const m of res.matches) {
          text += `- Line ${m.line}: ${m.text}\n`;
        }
        text += `\n`;
      }
      return { content: [{ type: "text", text }] };
    }

    if (name === "lookup_error") {
      const q = args.error_query;
      const errorsFile = path.join(BASE_DIR, "errors.md");
      const gotchasFile = path.join(BASE_DIR, "gotchas.md");

      let hits = [];
      if (fs.existsSync(errorsFile)) {
        const hitsErrors = searchFiles(path.dirname(errorsFile), q);
        hits.push(...hitsErrors.filter((h) => h.file === "errors.md" || h.file === "gotchas.md"));
      }

      // Also search past tickets
      const ticketDir = path.join(BASE_DIR, "tickets");
      if (fs.existsSync(ticketDir)) {
        const ticketHits = searchFiles(ticketDir, q);
        hits.push(...ticketHits);
      }

      if (hits.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No recorded solutions found in errors.md or past tickets for: "${q}". Consider adding this error to errors.md once resolved!`,
            },
          ],
        };
      }

      let text = `Found error records matching "${q}":\n\n`;
      for (const h of hits.slice(0, 5)) {
        const content = fs.readFileSync(h.path, "utf-8");
        text += `--- [${h.file}] ---\n${content.slice(0, 1500)}\n\n`;
      }
      return { content: [{ type: "text", text }] };
    }

    if (name === "get_entry") {
      const id = String(args.id).trim();
      const searchDirs = ["tickets", "features", "adr", "playbooks", "runbooks"];
      let foundPath = null;

      for (const d of searchDirs) {
        const targetDir = path.join(BASE_DIR, d);
        if (fs.existsSync(targetDir)) {
          const files = fs.readdirSync(targetDir);
          const match = files.find(
            (f) =>
              f.toLowerCase().startsWith(id.toLowerCase()) ||
              f.toLowerCase().includes(id.toLowerCase())
          );
          if (match) {
            foundPath = path.join(targetDir, match);
            break;
          }
        }
      }

      if (!foundPath) {
        return {
          content: [{ type: "text", text: `Entry with ID "${id}" was not found in CodeMemory.` }],
        };
      }

      let content = fs.readFileSync(foundPath, "utf-8");

      // Check for attached patch
      const patchDir = path.join(BASE_DIR, "patches");
      if (fs.existsSync(patchDir)) {
        const patchFiles = fs.readdirSync(patchDir, { recursive: true });
        const patchMatch = patchFiles.find((p) => typeof p === "string" && p.includes(id));
        if (patchMatch) {
          const fullPatch = path.join(patchDir, patchMatch);
          if (fs.existsSync(fullPatch) && fs.statSync(fullPatch).isFile()) {
            content += `\n\n---\n### Attached SQL Patch (${patchMatch}):\n\`\`\`sql\n${fs.readFileSync(
              fullPatch,
              "utf-8"
            )}\n\`\`\``;
          }
        }
      }

      return { content: [{ type: "text", text: content }] };
    }

    if (name === "get_relationships") {
      const relPath = path.join(BASE_DIR, "relationships.md");
      const archPath = path.join(BASE_DIR, "architecture.md");

      let content = "";
      if (fs.existsSync(relPath)) content += fs.readFileSync(relPath, "utf-8") + "\n\n";
      if (fs.existsSync(archPath)) content += fs.readFileSync(archPath, "utf-8") + "\n\n";

      if (!content) {
        return {
          content: [
            {
              type: "text",
              text: "No relationships.md or architecture.md file found in this CodeMemory repository.",
            },
          ],
        };
      }

      if (args.keyword) {
        const q = args.keyword.toLowerCase();
        const sections = content.split("##");
        const matching = sections.filter((s) => s.toLowerCase().includes(q));
        if (matching.length > 0) {
          return { content: [{ type: "text", text: "## " + matching.join("\n## ") }] };
        }
      }

      return { content: [{ type: "text", text: content }] };
    }

    if (name === "get_codemap") {
      const q = args.keyword;
      const results = searchFiles(BASE_DIR, q);
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No codemap references found for "${q}".` }],
        };
      }

      let text = `Codemap references for "${q}":\n\n`;
      for (const res of results.slice(0, 10)) {
        text += `- **${res.file}**:\n`;
        for (const m of res.matches) {
          text += `    - Line ${m.line}: \`${m.text}\`\n`;
        }
      }
      return { content: [{ type: "text", text }] };
    }

    if (name === "log_entry") {
      const {
        type,
        id,
        title,
        status_or_env = "PROD",
        summary_issue,
        solution,
        files_changed = [],
        sql_patch,
        learnings = [],
        branch = "main",
      } = args;

      // 1. Sanitize files changed: clean basename wrapped in backticks, 4 spaces indent
      const filesList = Array.isArray(files_changed) ? files_changed : [files_changed];
      const cleanedFiles = filesList.map(cleanFileBadge);

      let filesBlock = "";
      if (cleanedFiles.length > 0) {
        filesBlock = `* **Files changed:**\n` + cleanedFiles.map((f) => `    * ${f}`).join("\n");
      } else {
        filesBlock = `* **Files changed:** None (configuration or patch only).`;
      }

      // 2. Handle patch
      let patchRef = "None (code fix only).";
      if (sql_patch && sql_patch.trim().length > 0) {
        const patchesDir = path.join(BASE_DIR, "patches");
        fs.mkdirSync(patchesDir, { recursive: true });
        const patchFileName = `${id}_patch.sql`;
        const patchFilePath = path.join(patchesDir, patchFileName);
        fs.writeFileSync(patchFilePath, sql_patch.trim() + "\n", "utf-8");
        patchRef = `[\`patches/${patchFileName}\`](../patches/${patchFileName})`;
      }

      // 3. Format learnings
      const learnList = Array.isArray(learnings) ? learnings : [learnings];
      const learnBlock =
        learnList.length > 0
          ? learnList.map((l) => `* **${l.split(":")[0] || "Learning"}:** ${l.split(":")[1] || l}`).join("\n")
          : `* Documented fix for future reference.`;

      // 4. Build note content
      let noteContent = "";
      let targetSubdir = "tickets";
      let headerLabel = type === "ticket" ? "Environment" : "Status";

      const cleanIssue = sanitizeMarkdownLists(summary_issue);
      const cleanSolution = sanitizeMarkdownLists(solution);

      if (type === "feature") {
        targetSubdir = "features";
        noteContent = `# ${id} - ${title}
**${headerLabel}:** ${status_or_env} | **Branch:** \`${branch}\`

### 1. What was the goal?
${cleanIssue}

### 2. How did we build it?
${cleanSolution}

${filesBlock}
* **Patch / Migration:** ${patchRef}

### 3. What did we realize & trade-offs?
${learnBlock}
`;
      } else if (type === "adr") {
        targetSubdir = "adr";
        noteContent = `# ${id}: ${title}

* **Status:** ${status_or_env}
* **Date:** ${new Date().toISOString().split("T")[0]}

## Context and Problem Statement
${cleanIssue}

## Decision Outcome
${cleanSolution}

### Consequences & Trade-offs
${learnBlock}
`;
      } else {
        // Ticket mode (default)
        targetSubdir = "tickets";
        noteContent = `# ${id} - ${title}
**${headerLabel}:** ${status_or_env} | **Branch:** \`${branch}\`

### 1. What was the issue?
${cleanIssue}

### 2. How did I fix it?
${cleanSolution}

${filesBlock}
* **SQL Patch:** ${patchRef}

### 3. What did I realize?
${learnBlock}
`;
      }

      // 5. Write note file
      const dirPath = path.join(BASE_DIR, targetSubdir);
      fs.mkdirSync(dirPath, { recursive: true });
      const notePath = path.join(dirPath, `${id}.md`);
      fs.writeFileSync(notePath, noteContent, "utf-8");

      // 6. Update INDEX.md
      const indexPath = path.join(BASE_DIR, "INDEX.md");
      if (fs.existsSync(indexPath)) {
        const today = new Date().toISOString().split("T")[0];
        const keyFilesDisplay = cleanedFiles.slice(0, 2).join(", ") || "N/A";
        const catName = type.charAt(0).toUpperCase() + type.slice(1);
        const indexRow = `| \`${id}\` | ${title} | ${catName} | ${status_or_env} | ${keyFilesDisplay} | ${today} |\n`;
        fs.appendFileSync(indexPath, indexRow, "utf-8");
      }

      // 7. Auto-sync viewer if present
      const syncScript = path.join(BASE_DIR, ".viewer", "sync.py");
      if (fs.existsSync(syncScript)) {
        try {
          execSync(`python "${syncScript}"`, { stdio: "ignore" });
        } catch {}
      }

      return {
        content: [
          {
            type: "text",
            text: `[OK] Successfully logged ${type} note "${id}" into: ${notePath}\n- Updated INDEX.md\n- Formatted files changed cleanly with backticks and 4-space indentation.\n${
              sql_patch ? `- Saved SQL patch into patches/${id}_patch.sql` : ""
            }`,
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error executing ${name}: ${err.message}` }],
    };
  }
});

// 8. Start server over stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`CodeMemory MCP Server running on stdio (base dir: ${BASE_DIR})`);
}

main().catch((err) => {
  console.error("Fatal error starting CodeMemory MCP Server:", err);
  process.exit(1);
});
