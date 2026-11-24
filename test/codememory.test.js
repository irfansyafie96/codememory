import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const CLI_PATH = path.join(ROOT_DIR, "bin", "cli.js");
const SERVER_PATH = path.join(ROOT_DIR, "src", "index.js");

/** Detect a working Python interpreter across Linux, macOS, and Windows. */
function detectPython() {
  for (const cmd of ["python3", "python", "py"]) {
    try {
      execFileSync(cmd, ["-c", "import sys; assert sys.version_info[0] >= 3"], {
        stdio: "ignore",
      });
      return cmd;
    } catch {
      // Try next candidate
    }
  }
  return null;
}

describe("CodeMemory end-to-end suite", () => {
  let tmpRoot;
  let hybridDir;

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codememory-test-"));
    hybridDir = path.join(tmpRoot, "hybrid-repo");
  });

  after(() => {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("initializes hybrid, ticket, and project modes cleanly via CLI", () => {
    const modes = ["hybrid", "ticket", "project"];
    const commonFiles = [
      "codememory.config.json",
      "INDEX.md",
      "README.md",
      "errors.md",
      "gotchas.md",
      ".cursorrules",
      "CLAUDE.md",
      path.join("skills", "codememory", "SKILL.md"),
      path.join(".viewer", "sync.py"),
      path.join(".viewer", "mkdocs.base.yml"),
      "open-book.bat",
      "open-book.sh",
    ];

    for (const mode of modes) {
      const targetDir = mode === "hybrid" ? hybridDir : path.join(tmpRoot, `${mode}-repo`);
      execFileSync(process.execPath, [CLI_PATH, "init", "--dir", targetDir, "--type", mode], {
        stdio: "pipe",
      });

      const cfg = JSON.parse(
        fs.readFileSync(path.join(targetDir, "codememory.config.json"), "utf-8")
      );
      assert.equal(cfg.type, mode);

      for (const rel of commonFiles) {
        assert.ok(fs.existsSync(path.join(targetDir, rel)), `Missing ${rel} in ${mode} mode`);
      }

      if (mode === "ticket" || mode === "hybrid") {
        assert.ok(fs.existsSync(path.join(targetDir, "tickets", "001-example.md")));
        assert.ok(fs.existsSync(path.join(targetDir, "patches", "001_example_patch.sql")));
        assert.ok(fs.existsSync(path.join(targetDir, "relationships.md")));
      }

      if (mode === "project" || mode === "hybrid") {
        assert.ok(fs.existsSync(path.join(targetDir, "features", "FEAT-001-auth.md")));
        assert.ok(fs.existsSync(path.join(targetDir, "adr", "ADR-001-database-selection.md")));
        assert.ok(fs.existsSync(path.join(targetDir, "runbooks", "local-setup.md")));
        assert.ok(fs.existsSync(path.join(targetDir, "architecture.md")));
      }
    }
  });

  it("exposes MCP tools over stdio and executes search, lookup, relationships, and log_entry", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_PATH, "--dir", hybridDir],
    });
    const client = new Client(
      { name: "codememory-test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    try {
      await client.connect(transport);

      const instructions = client.getInstructions();
      assert.ok(
        typeof instructions === "string" &&
          instructions.includes("CodeMemory") &&
          instructions.includes("lookup_error"),
        "MCP server should expose instructions with CodeMemory workflow rules"
      );

      const { tools } = await client.listTools();
      const toolNames = tools.map((t) => t.name);
      for (const expected of [
        "search_memory",
        "lookup_error",
        "get_entry",
        "get_relationships",
        "get_codemap",
        "log_entry",
      ]) {
        assert.ok(toolNames.includes(expected), `Missing MCP tool: ${expected}`);
      }

      const searchRes = await client.callTool({
        name: "search_memory",
        arguments: { query: "CodeMemory" },
      });
      assert.ok(searchRes.content[0].text.includes("Found"));

      const errRes = await client.callTool({
        name: "lookup_error",
        arguments: { error_query: "Error" },
      });
      assert.ok(errRes.content[0].text.length > 0);

      const relRes = await client.callTool({
        name: "get_relationships",
        arguments: {},
      });
      assert.ok(relRes.content[0].text.includes("erDiagram"));

      await client.callTool({
        name: "log_entry",
        arguments: {
          type: "ticket",
          id: "999",
          title: "Test Race Condition",
          status_or_env: "STG",
          summary_issue: "Test issue\n  * sub item",
          solution: "Fixed cleanly",
          files_changed: ["src/service/OrderService.java"],
          sql_patch: "SELECT 1;",
          learnings: ["Port note: Viewer runs on http://localhost:8003 cleanly"],
        },
      });

      const loggedNotePath = path.join(hybridDir, "tickets", "999.md");
      assert.ok(fs.existsSync(loggedNotePath), "tickets/999.md should exist");
      const loggedNote = fs.readFileSync(loggedNotePath, "utf-8");
      assert.ok(loggedNote.includes("`OrderService.java`"), "Should clean path to basename badge");
      assert.ok(loggedNote.includes("    * sub item"), "Should sanitize 2-space indent to 4 spaces");
      assert.ok(
        loggedNote.includes("http://localhost:8003 cleanly"),
        "Should preserve colons inside learnings text"
      );

      assert.ok(
        fs.existsSync(path.join(hybridDir, "patches", "999_patch.sql")),
        "patches/999_patch.sql should exist"
      );

      const indexContent = fs.readFileSync(path.join(hybridDir, "INDEX.md"), "utf-8");
      assert.ok(indexContent.includes("`999`"), "INDEX.md should contain entry 999");
    } finally {
      await client.close();
    }
  });

  it("syncs viewer docs, generates mkdocs.yml, and converts Mermaid blocks", (t) => {
    const pythonCmd = detectPython();
    if (!pythonCmd) {
      t.skip("Python 3 interpreter not available in PATH");
      return;
    }

    execFileSync(pythonCmd, [path.join(hybridDir, ".viewer", "sync.py")], {
      stdio: "pipe",
    });

    assert.ok(fs.existsSync(path.join(hybridDir, ".viewer", "mkdocs.yml")));
    assert.ok(fs.existsSync(path.join(hybridDir, ".viewer", "docs", "index.md")));

    const syncedRelPath = path.join(hybridDir, ".viewer", "docs", "relationships.md");
    assert.ok(fs.existsSync(syncedRelPath));
    const syncedRel = fs.readFileSync(syncedRelPath, "utf-8");
    assert.ok(syncedRel.includes('<pre class="mermaid"><code>'));
    assert.ok(!syncedRel.includes("```mermaid"));
  });
});
