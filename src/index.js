import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const PKG_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf-8")).version;
  } catch {
    return "2.0.0";
  }
})();

// 1. Resolve root notes directory
function parseArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

const dirArg = parseArg("--dir");
const BASE_DIR = path.resolve(dirArg || process.env.CODEMEMORY_DIR || process.cwd());

// 2. Load codememory.config.json if present
const configPath = path.join(BASE_DIR, "codememory.config.json");
let config = { name: "CodeMemory" };
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8").replace(/^\uFEFF/, ""));
  } catch (err) {
    console.error("Warning: Failed to parse codememory.config.json:", err.message);
  }
}

function saveConfig(patch) {
  config = { ...config, ...patch };
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("Warning: Failed to save codememory.config.json:", err.message);
  }
}

// 3. Helpers
function cleanFileBadge(f) {
  let name = String(f).trim();
  if (name.startsWith("`") && name.endsWith("`")) {
    name = name.slice(1, -1).trim();
  }
  name = path.basename(name);
  return `\`${name}\``;
}

// Auto-correct 1-3 space indented bullets to 4 spaces
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

// Entry ids become file names, so keep them to a safe character set (no path traversal)
function sanitizeId(raw) {
  return String(raw)
    .trim()
    .replace(/^#+/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 64);
}

function sanitizeTitle(raw) {
  return String(raw).replace(/\s+/g, " ").replace(/\|/g, "/").trim();
}

function normalizeType(raw) {
  const map = {
    bug: "Bug",
    fix: "Bug",
    ticket: "Bug",
    incident: "Bug",
    feature: "Feature",
    feat: "Feature",
    decision: "Decision",
    adr: "Decision",
  };
  return map[String(raw || "bug").toLowerCase()] || "Bug";
}

// Recursively search text files; returns [{ file, path, matches }]
function searchFiles(dir, query, { exts = [".md"], filter } = {}) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const qLower = query.toLowerCase();

  function scan(current) {
    for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== "node_modules" && ent.name !== ".git" && ent.name !== ".viewer") scan(full);
      } else if (ent.isFile() && exts.some((e) => ent.name.toLowerCase().endsWith(e))) {
        if (filter && !filter(full)) continue;
        try {
          const content = fs.readFileSync(full, "utf-8");
          if (!content.toLowerCase().includes(qLower)) continue;
          const matches = [];
          const lines = content.split("\n");
          for (let i = 0; i < lines.length && matches.length < 5; i++) {
            if (lines[i].toLowerCase().includes(qLower)) matches.push({ line: i + 1, text: lines[i].trim() });
          }
          results.push({ file: path.relative(BASE_DIR, full), path: full, matches });
        } catch {}
      }
    }
  }

  scan(dir);
  return results;
}

// Show the lines around the first match instead of dumping a whole file
function excerpt(content, query, before = 2, after = 12) {
  const lines = content.split(/\r?\n/);
  const q = query.toLowerCase();
  const idx = lines.findIndex((l) => l.toLowerCase().includes(q));
  if (idx === -1) return lines.slice(0, 20).join("\n");
  return lines.slice(Math.max(0, idx - before), Math.min(lines.length, idx + after)).join("\n");
}

// Load MCP server instructions: user override in the notes folder, then the packaged skill, then a built-in fallback
function loadServerInstructions() {
  const candidates = [
    path.join(BASE_DIR, "skills", "codememory", "SKILL.md"),
    path.join(PKG_ROOT, "skills", "codememory", "SKILL.md"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = fs.readFileSync(candidate, "utf-8");
        const stripped = raw.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]*/, "").trim();
        if (stripped.length > 0) return stripped;
      } catch {}
    }
  }
  return [
    "CodeMemory Workflow Rules:",
    "1. Before fixing a bug or building a feature, consult search_memory, lookup_error, get_entry, or get_relationships.",
    "2. After the work is verified, PROPOSE what to log and wait for the user's approval. Never call log_entry on your own.",
    "3. Formatting & Safety: use 4-space indentation for nested sub-bullets, pass clean filenames in files_changed, and structure any sql_patch with STEP 1: PRE-CHECK, STEP 2: EXECUTE (explicit transaction + PK filter), and STEP 3: POST-CHECK.",
  ].join("\n");
}

// Pick the next entry id: a real tracker id when given, otherwise 1, 2, 3...
function resolveEntryId(rawId) {
  if (rawId !== undefined && rawId !== null && String(rawId).trim() !== "") {
    const id = sanitizeId(rawId);
    if (!id) throw new Error(`Invalid id "${rawId}". Use letters, numbers, dots, dashes or underscores.`);
    return { id, auto: false, n: 0 };
  }
  let n = Number(config.lastAutoId) || 0;
  do {
    n++;
  } while (fs.existsSync(path.join(BASE_DIR, "issues", `${n}.md`)));
  return { id: String(n), auto: true, n };
}

const INDEX_HEADER =
  "# Knowledge Base Index\n\n| ID | Title / Summary | Type | Status / Env | Key Files | Date |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n";

function upsertIndexRow(id, row) {
  const indexPath = path.join(BASE_DIR, "INDEX.md");
  const text = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf-8") : INDEX_HEADER;
  const lines = text.split(/\r?\n/);
  const marker = `| \`${id}\` |`;
  const idx = lines.findIndex((l) => l.startsWith(marker));
  if (idx >= 0) {
    lines[idx] = row;
  } else {
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    lines.push(row);
  }
  fs.writeFileSync(indexPath, lines.join("\n") + "\n", "utf-8");
}

function runViewerSync() {
  const syncScript = path.join(BASE_DIR, ".viewer", "sync.py");
  if (!fs.existsSync(syncScript)) return;
  for (const py of ["python3", "python", "py"]) {
    try {
      execFileSync(py, [syncScript], { stdio: "ignore", timeout: 60000 });
      return;
    } catch {}
  }
}

// 4. Initialize MCP Server
const server = new Server(
  {
    name: "codememory",
    version: PKG_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
    instructions: loadServerInstructions(),
  }
);

// 5. Define ListTools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_memory",
        description:
          "Fast keyword search across all engineering memory (issues, playbooks, patches, queries, errors, gotchas, architecture).",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search keyword, function name, table name, or phrase.",
            },
            category: {
              type: "string",
              enum: ["all", "issues", "playbooks", "patches", "queries", "errors", "gotchas", "architecture"],
              description: "Optional folder/category filter. Defaults to 'all'.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "lookup_error",
        description:
          "Search error signatures, exception logs, stack traces, and error codes in errors.md, gotchas.md and past issues.",
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
          "Retrieve a complete logged issue (bug, feature or decision) by its id, plus any attached SQL patch. Also finds playbooks and queries by name.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Entry id, e.g. '1', '12', '#286705' or 'PROJ-42'.",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "get_relationships",
        description:
          "Retrieve architecture notes: system flows, ER diagrams, foreign key relationships, and synchronization rules (architecture.md).",
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
          "Log a resolved bug, finished feature, or technical decision into CodeMemory (issues/<id>.md + INDEX.md). ONLY call this after the user has approved what to log. Omit id to auto-number (1, 2, 3...) or pass the real tracker id (#12, 286705, PROJ-42). Formatting rules: 4-space indentation for nested sub-bullets, clean filenames in files_changed (auto-stripped to backticked basenames), and any sql_patch must use STEP 1: PRE-CHECK, STEP 2: EXECUTE (transaction + explicit PK), STEP 3: POST-CHECK.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["bug", "feature", "decision"],
              description: "Entry type.",
            },
            id: {
              type: "string",
              description:
                "Optional. Real tracker id (e.g. '12', '#286705', 'PROJ-42'). Leave empty to auto-number 1, 2, 3...",
            },
            title: {
              type: "string",
              description: "Short, descriptive title in plain words.",
            },
            status_or_env: {
              type: "string",
              description: "Environment (e.g. 'PROD', 'STG') or status (e.g. 'Completed'). Optional.",
            },
            summary_issue: {
              type: "string",
              description: "Section 1: what was the issue (bug), the goal (feature), or the question (decision)?",
            },
            solution: {
              type: "string",
              description: "Section 2: how was it fixed or built, or what was chosen?",
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
              description: "Section 3: key realizations, trade-offs, or gotchas learned. Use 'Label: detail' format.",
            },
            branch: {
              type: "string",
              description: "Optional Git branch name.",
            },
            overwrite: {
              type: "boolean",
              description: "Set true only to replace an existing entry with the same id.",
            },
          },
          required: ["type", "title", "summary_issue", "solution"],
        },
      },
    ],
  };
});

// 6. Handle CallTool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_memory") {
      const query = args.query;
      const cat = args.category || "all";
      const fileCats = { errors: "errors.md", gotchas: "gotchas.md", architecture: "architecture.md" };
      let results;

      if (cat === "all") {
        results = searchFiles(BASE_DIR, query, { exts: [".md", ".sql"] });
      } else if (["issues", "playbooks", "queries"].includes(cat)) {
        results = searchFiles(path.join(BASE_DIR, cat), query);
      } else if (cat === "patches") {
        results = searchFiles(path.join(BASE_DIR, "patches"), query, { exts: [".sql", ".md"] });
      } else if (fileCats[cat]) {
        const target = path.join(BASE_DIR, fileCats[cat]);
        results = searchFiles(BASE_DIR, query, { filter: (full) => full === target });
      } else {
        results = [];
      }

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
      const hits = [];
      for (const f of ["errors.md", "gotchas.md"]) {
        const full = path.join(BASE_DIR, f);
        if (fs.existsSync(full)) hits.push(...searchFiles(BASE_DIR, q, { filter: (p) => p === full }));
      }
      hits.push(...searchFiles(path.join(BASE_DIR, "issues"), q));

      if (hits.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No recorded solutions found in errors.md, gotchas.md or past issues for: "${q}". Once this is resolved, propose adding it to errors.md.`,
            },
          ],
        };
      }

      let text = `Found error records matching "${q}":\n\n`;
      for (const h of hits.slice(0, 5)) {
        const content = fs.readFileSync(h.path, "utf-8");
        text += `--- [${h.file}] ---\n${excerpt(content, q)}\n\n`;
      }
      return { content: [{ type: "text", text }] };
    }

    if (name === "get_entry") {
      const id = sanitizeId(String(args.id));
      const lower = id.toLowerCase();
      let foundPath = null;

      for (const d of ["issues", "playbooks", "queries"]) {
        const targetDir = path.join(BASE_DIR, d);
        if (!id || !fs.existsSync(targetDir)) continue;
        const files = fs.readdirSync(targetDir).filter((f) => f.toLowerCase().endsWith(".md"));
        let match = files.find((f) => f.toLowerCase() === `${lower}.md`);
        if (!match) {
          match = files.find((f) => f.toLowerCase().startsWith(`${lower}-`) || f.toLowerCase().startsWith(`${lower}_`));
        }
        if (!match && d !== "issues") match = files.find((f) => f.toLowerCase().includes(lower));
        if (match) {
          foundPath = path.join(targetDir, match);
          break;
        }
      }

      if (!foundPath) {
        return {
          content: [{ type: "text", text: `Entry with ID "${args.id}" was not found in CodeMemory.` }],
        };
      }

      let content = fs.readFileSync(foundPath, "utf-8");

      const patchDir = path.join(BASE_DIR, "patches");
      if (fs.existsSync(patchDir)) {
        const patchFiles = fs.readdirSync(patchDir, { recursive: true });
        const patchMatch = patchFiles.find(
          (p) => typeof p === "string" && p.toLowerCase().endsWith(".sql") && path.basename(p).toLowerCase().startsWith(`${lower}_`)
        );
        if (patchMatch) {
          const fullPatch = path.join(patchDir, patchMatch);
          if (fs.existsSync(fullPatch) && fs.statSync(fullPatch).isFile()) {
            content += `\n\n---\n### Attached SQL Patch (${patchMatch}):\n\`\`\`sql\n${fs.readFileSync(fullPatch, "utf-8")}\n\`\`\``;
          }
        }
      }

      return { content: [{ type: "text", text: content }] };
    }

    if (name === "get_relationships") {
      let content = "";
      for (const f of ["architecture.md", "relationships.md"]) {
        const full = path.join(BASE_DIR, f);
        if (fs.existsSync(full)) content += fs.readFileSync(full, "utf-8") + "\n\n";
      }

      if (!content) {
        return {
          content: [{ type: "text", text: "No architecture.md file found in this CodeMemory folder." }],
        };
      }

      if (args.keyword) {
        const q = args.keyword.toLowerCase();
        const sections = content.split(/\r?\n(?=##\s)/);
        const matching = sections.filter((s) => s.toLowerCase().includes(q));
        if (matching.length > 0) {
          return { content: [{ type: "text", text: matching.join("\n\n") }] };
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
        title,
        status_or_env = "N/A",
        summary_issue,
        solution,
        files_changed = [],
        sql_patch,
        learnings = [],
        branch = "N/A",
        overwrite = false,
      } = args;

      const entryType = normalizeType(type);
      const cleanTitle = sanitizeTitle(title);
      const { id, auto, n } = resolveEntryId(args.id);

      const issuesDir = path.join(BASE_DIR, "issues");
      const notePath = path.join(issuesDir, `${id}.md`);
      if (fs.existsSync(notePath) && !overwrite) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Entry "${id}" already exists (${notePath}). Omit id to auto-number, pick another id, or pass overwrite=true to replace it.`,
            },
          ],
        };
      }

      // 1. Files changed: clean basename wrapped in backticks, 4 spaces indent
      const filesList = Array.isArray(files_changed) ? files_changed : [files_changed];
      const cleanedFiles = filesList.filter(Boolean).map(cleanFileBadge);
      const filesBlock =
        cleanedFiles.length > 0
          ? `* **Files changed:**\n` + cleanedFiles.map((f) => `    * ${f}`).join("\n")
          : `* **Files changed:** None (configuration or patch only).`;

      // 2. Optional SQL patch
      let patchLine = "";
      if (sql_patch && sql_patch.trim().length > 0) {
        const patchesDir = path.join(BASE_DIR, "patches");
        fs.mkdirSync(patchesDir, { recursive: true });
        const patchFileName = `${id}_patch.sql`;
        fs.writeFileSync(path.join(patchesDir, patchFileName), sql_patch.trim() + "\n", "utf-8");
        patchLine = `\n* **SQL Patch:** [\`patches/${patchFileName}\`](../patches/${patchFileName})`;
      }

      // 3. Learnings
      const learnList = (Array.isArray(learnings) ? learnings : [learnings]).filter(Boolean);
      const learnBlock =
        learnList.length > 0
          ? learnList
              .map((l) => {
                const idx = String(l).indexOf(":");
                if (idx === -1) return `* **Learning:** ${String(l).trim()}`;
                const label = String(l).slice(0, idx).trim() || "Learning";
                const detail = String(l).slice(idx + 1).trim();
                return `* **${label}:** ${detail}`;
              })
              .join("\n")
          : `* Documented for future reference.`;

      // 4. Note (same 3 sections for bugs, features and decisions)
      const noteContent = `# ${id} - ${cleanTitle}
**Type:** ${entryType} | **Env/Status:** ${status_or_env} | **Branch:** \`${branch}\`

### 1. What was the issue?
${sanitizeMarkdownLists(summary_issue)}

### 2. How did I fix it?
${sanitizeMarkdownLists(solution)}

${filesBlock}${patchLine}

### 3. What did I realize?
${learnBlock}
`;
      fs.mkdirSync(issuesDir, { recursive: true });
      fs.writeFileSync(notePath, noteContent, "utf-8");

      // 5. INDEX.md (insert or replace the row for this id)
      const today = new Date().toISOString().split("T")[0];
      const keyFiles = cleanedFiles.slice(0, 2).join(", ") || "N/A";
      upsertIndexRow(id, `| \`${id}\` | ${cleanTitle} | ${entryType} | ${status_or_env} | ${keyFiles} | ${today} |`);

      // 6. Remember the auto-number counter
      if (auto) saveConfig({ lastAutoId: n });

      // 7. Refresh the Book Reader docs if present
      runViewerSync();

      return {
        content: [
          {
            type: "text",
            text: `[OK] Logged ${entryType.toLowerCase()} "${id}"${auto ? " (auto-numbered)" : ""} into: ${notePath}\n- Updated INDEX.md\n- Formatted files changed cleanly with backticks and 4-space indentation.${
              sql_patch ? `\n- Saved SQL patch into patches/${id}_patch.sql` : ""
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

// 7. Start server over stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`CodeMemory MCP Server running on stdio (base dir: ${BASE_DIR})`);
}

main().catch((err) => {
  console.error("Fatal error starting CodeMemory MCP Server:", err);
  process.exit(1);
});
