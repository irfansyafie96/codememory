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

function runInit(cliArgs, env = {}) {
  return execFileSync(process.execPath, [CLI_PATH, "init", ...cliArgs], {
    stdio: "pipe",
    env: { ...process.env, ...env },
  });
}

function read(...parts) {
  return fs.readFileSync(path.join(...parts), "utf-8");
}

function exists(...parts) {
  return fs.existsSync(path.join(...parts));
}

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

describe("CodeMemory v2 end-to-end suite", () => {
  let tmpRoot;
  let notesDir;
  let demoDir;

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codememory-test-"));
    notesDir = path.join(tmpRoot, "notes");
    demoDir = path.join(tmpRoot, "demo");
  });

  after(() => {
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("scaffolds one clean unified layout (legacy --type ignored, nothing installed outside)", () => {
    runInit(["--dir", notesDir, "--type", "hybrid"]);

    const cfg = JSON.parse(read(notesDir, "codememory.config.json"));
    assert.equal(cfg.viewerPort, 8000);
    assert.equal(cfg.lastAutoId, 0);
    assert.equal(cfg.type, undefined);

    for (const rel of [
      "INDEX.md",
      "README.md",
      "errors.md",
      "gotchas.md",
      "architecture.md",
      path.join("issues", ".gitkeep"),
      path.join("playbooks", ".gitkeep"),
      path.join(".viewer", "sync.py"),
      path.join(".viewer", "mkdocs.base.yml"),
      "open-book.bat",
      "open-book.sh",
    ]) {
      assert.ok(exists(notesDir, rel), `Missing ${rel}`);
    }

    // No v1 folders, no AI rule files inside the notes folder, optional folders hidden until used
    for (const rel of ["tickets", "features", "adr", "runbooks", "relationships.md", "skills", ".cursorrules", "CLAUDE.md", "patches", "queries"]) {
      assert.ok(!exists(notesDir, rel), `Unexpected ${rel}`);
    }
    assert.ok(!read(notesDir, "INDEX.md").includes("`1`"), "Clean INDEX should have no sample rows");
    assert.ok(!read(notesDir, "errors.md").includes("ORA-00001"), "Clean errors.md should have no sample content");
    assert.ok(read(notesDir, "open-book.bat").includes("port.txt"));

    // Custom port
    const portDir = path.join(tmpRoot, "port-notes");
    runInit(["--dir", portDir, "--port", "8003"]);
    assert.equal(JSON.parse(read(portDir, "codememory.config.json")).viewerPort, 8003);

    // Sample notes are opt-in
    runInit(["--dir", demoDir, "--examples"]);
    for (const rel of [
      path.join("issues", "1.md"),
      path.join("patches", "1_patch.sql"),
      path.join("playbooks", "example-playbook.md"),
      path.join("queries", "example-queries.md"),
    ]) {
      assert.ok(exists(demoDir, rel), `Missing sample ${rel}`);
    }
    assert.ok(read(demoDir, "architecture.md").includes("mermaid"));
    assert.equal(JSON.parse(read(demoDir, "codememory.config.json")).lastAutoId, 1);
  });

  it("installs the skill for chosen AI clients (project and global scope)", () => {
    const projectRoot = path.join(tmpRoot, "project");
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(path.join(projectRoot, "CLAUDE.md"), "# My Claude rules\n", "utf-8");

    const clientNotes = path.join(tmpRoot, "client-notes");
    const projectArgs = [
      "--dir", clientNotes,
      "--clients", "claude,cursor,codex,antigravity",
      "--scope", "project",
      "--project-root", projectRoot,
    ];
    runInit(projectArgs);

    for (const rel of [
      path.join(".claude", "skills", "codememory", "SKILL.md"),
      path.join(".cursor", "skills", "codememory", "SKILL.md"),
      path.join(".agents", "skills", "codememory", "SKILL.md"),
      path.join(".cursor", "rules", "codememory.mdc"),
      "AGENTS.md",
    ]) {
      assert.ok(exists(projectRoot, rel), `Missing ${rel}`);
    }
    assert.ok(read(projectRoot, ".cursor", "rules", "codememory.mdc").includes("alwaysApply: true"));
    assert.ok(read(projectRoot, ".claude", "skills", "codememory", "SKILL.md").includes("name: codememory"));

    const claudeMd = read(projectRoot, "CLAUDE.md");
    assert.ok(claudeMd.includes("# My Claude rules"), "Existing CLAUDE.md content must be preserved");
    assert.ok(claudeMd.includes("codememory:start"));

    // Re-running must not duplicate pointer blocks
    runInit(projectArgs);
    assert.equal(read(projectRoot, "CLAUDE.md").split("codememory:start").length - 1, 1);
    assert.equal(read(projectRoot, "AGENTS.md").split("codememory:start").length - 1, 1);

    // Global scope writes into the (fake) home folder only, and never touches global rule files
    const fakeHome = path.join(tmpRoot, "home");
    runInit(["--dir", path.join(tmpRoot, "global-notes"), "--clients", "all", "--scope", "global"], {
      CODEMEMORY_HOME: fakeHome,
    });
    for (const rel of [
      path.join(".gemini", "config", "skills", "codememory", "SKILL.md"),
      path.join(".claude", "skills", "codememory", "SKILL.md"),
      path.join(".cursor", "skills", "codememory", "SKILL.md"),
      path.join(".codex", "skills", "codememory", "SKILL.md"),
    ]) {
      assert.ok(exists(fakeHome, rel), `Missing global ${rel}`);
    }
    assert.ok(!exists(fakeHome, "CLAUDE.md"));
  });

  it("serves MCP tools, auto-numbers entries, and protects existing notes", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER_PATH, "--dir", notesDir],
    });
    const client = new Client({ name: "codememory-test-client", version: "1.0.0" }, { capabilities: {} });

    const call = (name, args) => client.callTool({ name, arguments: args });
    const text = (res) => res.content[0].text;

    try {
      await client.connect(transport);

      const instructions = client.getInstructions();
      assert.ok(
        typeof instructions === "string" &&
          instructions.includes("CodeMemory") &&
          instructions.includes("lookup_error") &&
          instructions.includes("approved"),
        "MCP instructions should carry the propose-then-approve workflow"
      );

      const { tools } = await client.listTools();
      const toolNames = tools.map((t) => t.name);
      for (const expected of ["search_memory", "lookup_error", "get_entry", "get_relationships", "get_codemap", "log_entry"]) {
        assert.ok(toolNames.includes(expected), `Missing MCP tool: ${expected}`);
      }

      // 1. No id -> auto-number 1
      const first = await call("log_entry", {
        type: "bug",
        title: "First fix",
        summary_issue: "Test issue\n  * sub item",
        solution: "Fixed cleanly",
        files_changed: ["src/service/OrderService.java"],
        sql_patch: "SELECT 1;",
        learnings: ["Port note: Viewer runs on http://localhost:8003 cleanly"],
      });
      assert.ok(!first.isError, text(first));
      const note1 = read(notesDir, "issues", "1.md");
      assert.ok(note1.includes("**Type:** Bug"));
      assert.ok(note1.includes("`OrderService.java`"), "Should clean path to basename badge");
      assert.ok(note1.includes("    * sub item"), "Should sanitize 2-space indent to 4 spaces");
      assert.ok(note1.includes("http://localhost:8003 cleanly"), "Should preserve colons inside learnings");
      assert.ok(note1.includes("patches/1_patch.sql"));
      assert.ok(exists(notesDir, "patches", "1_patch.sql"));
      assert.equal(JSON.parse(read(notesDir, "codememory.config.json")).lastAutoId, 1);

      // 2. Next auto-number is 2 (pipes in titles are sanitized for the INDEX table)
      await call("log_entry", {
        type: "feature",
        title: "Second | piped",
        summary_issue: "Goal",
        solution: "Built",
      });
      assert.ok(exists(notesDir, "issues", "2.md"));

      // 3. Real tracker ids are used as-is (leading # stripped)
      await call("log_entry", {
        type: "decision",
        id: "#286705",
        title: "Pick the queue library",
        summary_issue: "Which library?",
        solution: "Chose the simplest one",
      });
      assert.ok(exists(notesDir, "issues", "286705.md"));

      // 4. Auto-numbering continues from the counter, not from the tracker id
      await call("log_entry", { type: "bug", title: "Third", summary_issue: "x", solution: "y" });
      assert.ok(exists(notesDir, "issues", "3.md"));
      assert.ok(!exists(notesDir, "issues", "286706.md"));

      // 5. Existing entries are protected unless overwrite=true
      const clash = await call("log_entry", { type: "bug", id: "2", title: "Clash", summary_issue: "x", solution: "y" });
      assert.equal(clash.isError, true);
      assert.ok(read(notesDir, "issues", "2.md").includes("Second / piped"));
      await call("log_entry", { type: "bug", id: "2", title: "Replaced", summary_issue: "x", solution: "y", overwrite: true });
      assert.ok(read(notesDir, "issues", "2.md").includes("Replaced"));

      // 6. Ids cannot escape the issues folder
      await call("log_entry", { type: "bug", id: "../../evil", title: "Evil", summary_issue: "x", solution: "y" });
      assert.ok(!exists(tmpRoot, "evil.md"));
      assert.ok(exists(notesDir, "issues", "evil.md"));

      // INDEX.md has one row per entry
      const index = read(notesDir, "INDEX.md");
      for (const id of ["1", "2", "3", "286705"]) {
        assert.ok(index.includes(`| \`${id}\` |`), `INDEX missing ${id}`);
      }
      assert.equal(index.split("| `2` |").length - 1, 1, "overwrite must not duplicate the INDEX row");
      assert.ok(index.includes("| Decision |"));

      // Reading it back
      const entry1 = text(await call("get_entry", { id: "1" }));
      assert.ok(entry1.includes("First fix") && entry1.includes("Attached SQL Patch"));
      assert.ok(text(await call("get_entry", { id: "#286705" })).includes("Pick the queue library"));
      assert.ok(text(await call("search_memory", { query: "Fixed cleanly", category: "issues" })).includes("1.md"));
      assert.ok(text(await call("search_memory", { query: "SELECT 1", category: "patches" })).includes("1_patch.sql"));
      assert.ok(text(await call("lookup_error", { error_query: "Stack Traces" })).includes("errors.md"));
      assert.ok(text(await call("get_relationships", {})).includes("System Architecture"));
    } finally {
      await client.close();
    }
  });

  it("builds the Book Reader home, issue tables, nav, and Mermaid blocks", (t) => {
    const py = detectPython();
    if (!py) {
      t.skip("Python 3 interpreter not available in PATH");
      return;
    }

    execFileSync(py, [path.join(notesDir, ".viewer", "sync.py")], { stdio: "pipe" });

    const docs = path.join(notesDir, ".viewer", "docs");
    const home = read(docs, "index.md");
    assert.ok(home.includes("## Logged Entries"));
    assert.ok(home.includes('=== "All (5)"'), "home should list all 5 entries in tabs");
    assert.ok(home.includes('=== "Decision (1)"'));
    assert.ok(home.includes("[1](issues/1.md)"));
    assert.ok(home.indexOf("[1](issues/1.md)") < home.indexOf("[286705](issues/286705.md)"), "ids sorted numerically");

    assert.ok(exists(docs, "issues", "1.md"));
    assert.ok(exists(docs, "issues", "index.md"));
    assert.ok(read(docs, "patches", "index.md").includes("1_patch.sql"));
    assert.ok(exists(docs, "how-to-use.md"));
    assert.ok(read(docs, "issues", "1.md").includes("../patches/1_patch.sql.md"), "patch link points at the book page");

    const mkdocsYml = read(notesDir, ".viewer", "mkdocs.yml");
    assert.ok(mkdocsYml.includes("dev_addr: 127.0.0.1:8000"));
    assert.ok(mkdocsYml.includes("Issues: issues/index.md"));
    assert.ok(!mkdocsYml.includes("INDEX.md"));
    assert.equal(read(notesDir, ".viewer", "port.txt"), "8000");

    // Sample notes: Mermaid fences become <pre class="mermaid">, queries and playbooks get nav entries
    execFileSync(py, [path.join(demoDir, ".viewer", "sync.py")], { stdio: "pipe" });
    const demoDocs = path.join(demoDir, ".viewer", "docs");
    const arch = read(demoDocs, "architecture.md");
    assert.ok(arch.includes('<pre class="mermaid"><code>'));
    assert.ok(!arch.includes("```mermaid"));
    const demoYml = read(demoDir, ".viewer", "mkdocs.yml");
    assert.ok(demoYml.includes("Queries:") && demoYml.includes("Playbooks:") && demoYml.includes("Patches: patches/index.md"));

    // UTF-8 BOM in codememory.config.json (e.g. PowerShell Set-Content -Encoding utf8)
    const bomDir = path.join(tmpRoot, "bom-notes");
    runInit(["--dir", bomDir, "--clients", "none"]);
    fs.writeFileSync(
      path.join(bomDir, "codememory.config.json"),
      "\uFEFF" + JSON.stringify({ name: "bom-test", viewerPort: 8004, lastAutoId: 7 }, null, 2),
      "utf-8"
    );
    execFileSync(py, [path.join(bomDir, ".viewer", "sync.py")], { stdio: "pipe" });
    assert.equal(read(bomDir, ".viewer", "port.txt"), "8004");
    assert.match(read(bomDir, ".viewer", "mkdocs.yml"), /site_name:\s*['"]?bom-test['"]?/);
    runInit(["--dir", bomDir, "--clients", "none"]);
    const bomCfg = JSON.parse(read(bomDir, "codememory.config.json").replace(/^\uFEFF/, ""));
    assert.equal(bomCfg.viewerPort, 8004);
    assert.equal(bomCfg.lastAutoId, 7);
  });
});
