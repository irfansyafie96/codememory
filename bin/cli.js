#!/usr/bin/env node

import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const command = args[0];

// Home folder used for --scope global (overridable so tests never touch the real one)
const HOME_DIR = process.env.CODEMEMORY_HOME ? path.resolve(process.env.CODEMEMORY_HOME) : os.homedir();
const DEFAULT_PORT = 8000;
const MARK_START = "<!-- codememory:start -->";
const MARK_END = "<!-- codememory:end -->";

// Every client below supports the same SKILL.md "Agent Skills" format.
const CLIENTS = [
  {
    id: "antigravity",
    label: "Antigravity",
    projectSkill: [".agents", "skills", "codememory", "SKILL.md"],
    globalSkill: [".gemini", "config", "skills", "codememory", "SKILL.md"],
    pointer: { kind: "block", file: "AGENTS.md" },
  },
  {
    id: "claude",
    label: "Claude Code",
    projectSkill: [".claude", "skills", "codememory", "SKILL.md"],
    globalSkill: [".claude", "skills", "codememory", "SKILL.md"],
    pointer: { kind: "block", file: "CLAUDE.md" },
  },
  {
    id: "cursor",
    label: "Cursor",
    projectSkill: [".cursor", "skills", "codememory", "SKILL.md"],
    globalSkill: [".cursor", "skills", "codememory", "SKILL.md"],
    pointer: { kind: "mdc", file: ".cursor/rules/codememory.mdc" },
  },
  {
    id: "codex",
    label: "OpenAI Codex CLI",
    projectSkill: [".agents", "skills", "codememory", "SKILL.md"],
    globalSkill: [".codex", "skills", "codememory", "SKILL.md"],
    pointer: { kind: "block", file: "AGENTS.md" },
  },
];

const CLIENT_ALIASES = {
  gemini: "antigravity",
  "claude-code": "claude",
  claudecode: "claude",
  "codex-cli": "codex",
  openai: "codex",
};

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--") ? args[idx + 1] : null;
}

function hasFlag(flag) {
  return args.includes(flag);
}

function copyTemplate(src, dst) {
  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function writeIfMissing(dst, content) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, content, "utf-8");
  }
}

function ensureDirWithGitkeep(dir) {
  fs.mkdirSync(dir, { recursive: true });
  if (fs.readdirSync(dir).length === 0) {
    fs.writeFileSync(path.join(dir, ".gitkeep"), "", "utf-8");
  }
}

function parsePort(value) {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1024 && n <= 65535) return n;
  console.log(`⚠️  Invalid port "${value}" (use 1024-65535). Using ${DEFAULT_PORT}.`);
  return DEFAULT_PORT;
}

function parseClients(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "none") return [];
  if (raw === "all") return CLIENTS.map((c) => c.id);
  const ids = [];
  for (const token of raw.split(",").map((t) => t.trim()).filter(Boolean)) {
    const id = CLIENT_ALIASES[token] || token;
    if (CLIENTS.some((c) => c.id === id)) {
      if (!ids.includes(id)) ids.push(id);
    } else {
      console.log(`⚠️  Unknown AI client "${token}" (use: ${CLIENTS.map((c) => c.id).join(", ")}). Skipping.`);
    }
  }
  return ids;
}

function detectClients(projectRoot) {
  const has = (...p) => fs.existsSync(path.join(...p));
  return {
    antigravity: has(HOME_DIR, ".gemini") || has(projectRoot, ".agents") || has(projectRoot, "GEMINI.md"),
    claude: has(projectRoot, ".claude") || has(projectRoot, "CLAUDE.md") || has(HOME_DIR, ".claude"),
    cursor: has(projectRoot, ".cursor"),
    codex: has(projectRoot, "AGENTS.md") || has(HOME_DIR, ".codex"),
  };
}

function pointerBody(notesDir) {
  return [
    `This project keeps its engineering memory in CodeMemory (MCP server \`codememory\`, notes in \`${notesDir}\`).`,
    "",
    "* Before fixing a bug or building a feature, search it (`search_memory`, `lookup_error`).",
    "* After the work is verified, PROPOSE what to log and wait for the user's approval before calling `log_entry`.",
    "* Follow the `codememory` skill for formatting rules.",
  ].join("\n");
}

function upsertBlock(file, body) {
  const block = `${MARK_START}\n## CodeMemory\n\n${body}\n${MARK_END}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, block, "utf-8");
    return;
  }
  const text = fs.readFileSync(file, "utf-8");
  const start = text.indexOf(MARK_START);
  const end = text.indexOf(MARK_END);
  if (start !== -1 && end !== -1 && end > start) {
    const after = text.slice(end + MARK_END.length).replace(/^\r?\n/, "");
    fs.writeFileSync(file, text.slice(0, start) + block + after, "utf-8");
  } else {
    const sep = text.endsWith("\n") ? "\n" : "\n\n";
    fs.writeFileSync(file, text + sep + block, "utf-8");
  }
}

function installClients(ids, scope, projectRoot, notesDir) {
  const skillSrc = path.join(ROOT_DIR, "skills", "codememory", "SKILL.md");
  const done = new Set();
  const report = [];
  for (const id of ids) {
    const client = CLIENTS.find((c) => c.id === id);
    if (!client) continue;
    const base = scope === "global" ? HOME_DIR : projectRoot;
    const skillDst = path.join(base, ...(scope === "global" ? client.globalSkill : client.projectSkill));
    if (!done.has(skillDst)) {
      fs.mkdirSync(path.dirname(skillDst), { recursive: true });
      fs.copyFileSync(skillSrc, skillDst);
      done.add(skillDst);
      report.push(`${client.label}: skill -> ${skillDst}`);
    }
    if (scope === "project") {
      const pointerDst = path.join(projectRoot, ...client.pointer.file.split("/"));
      if (!done.has(pointerDst)) {
        if (client.pointer.kind === "mdc") {
          fs.mkdirSync(path.dirname(pointerDst), { recursive: true });
          fs.writeFileSync(
            pointerDst,
            `---\ndescription: CodeMemory workflow - consult memory before work, propose what to log after\nalwaysApply: true\n---\n\n${pointerBody(notesDir)}\n`,
            "utf-8"
          );
        } else {
          upsertBlock(pointerDst, pointerBody(notesDir));
        }
        done.add(pointerDst);
        report.push(`${client.label}: rules pointer -> ${pointerDst}`);
      }
    }
  }
  return report;
}

function printInitHelp() {
  console.log(`
Usage: codememory init [options]

  With no --dir the command asks questions interactively.
  With --dir it runs fully non-interactive using only the flags below.

  --dir <path>              Notes folder to create (default when non-interactive: ./codememory)
  --port <number>           Book Reader port, 1024-65535 (default ${DEFAULT_PORT})
  --examples                Include sample demo notes (default: clean skeleton)
  --clients <list>          antigravity,claude,cursor,codex | all | none (default: none)
  --scope <project|global>  Where to install the skill (default: project)
  --project-root <path>     Project root used by --scope project (default: current folder)
`);
}

function buildBatScript() {
  return `@echo off
cd /d "%~dp0\\.viewer"

:: 1. Detect Real Python (bypass Microsoft Store 0KB dummy alias)
set "PY_CMD="

:: Check 'py' launcher
py -c "import sys" >nul 2>&1
if %errorlevel% equ 0 set "PY_CMD=py"

:: Check 'python' (verify it can actually execute code, not the WindowsApps dummy)
if "%PY_CMD%"=="" (
    python -c "import sys" >nul 2>&1
    if %errorlevel% equ 0 set "PY_CMD=python"
)

:: Auto-detect common Python installation paths if PATH is missing
if "%PY_CMD%"=="" (
    for /d %%D in ("%LOCALAPPDATA%\\Python\\pythoncore*") do (
        if exist "%%D\\python.exe" set "PY_CMD=%%D\\python.exe"
    )
)
if "%PY_CMD%"=="" (
    for /d %%D in ("%LOCALAPPDATA%\\Programs\\Python\\Python*") do (
        if exist "%%D\\python.exe" set "PY_CMD=%%D\\python.exe"
    )
)
if "%PY_CMD%"=="" (
    for /d %%D in ("C:\\Python*") do (
        if exist "%%D\\python.exe" set "PY_CMD=%%D\\python.exe"
    )
)

if "%PY_CMD%"=="" (
    echo.
    echo ======================================================================
    echo [CodeMemory Error] Real Python was not found in your PATH.
    echo Windows is executing the dummy Microsoft Store shortcut.
    echo.
    echo HOW TO FIX:
    echo 1. Open Windows Settings -^> Apps -^> Advanced app settings -^> App execution aliases
    echo    Turn OFF "App Installer (python.exe)" and "App Installer (python3.exe)"
    echo 2. Re-open terminal or reinstall Python with "[x] Add python.exe to PATH"
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

:: 2. Check if mkdocs is installed, auto-install via "%PY_CMD% -m pip"
"%PY_CMD%" -m mkdocs --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [CodeMemory] 'mkdocs-material' is not installed.
    echo [CodeMemory] Installing documentation dependencies automatically via "%PY_CMD%" -m pip...
    echo.
    set "PYYAML_FORCE_LIBYAML=0"
    "%PY_CMD%" -m pip uninstall -y pyyaml-pure >nul 2>&1
    "%PY_CMD%" -m pip install mkdocs-material
)

:: 3. Sync notes (also writes port.txt + dev_addr from codememory.config.json) and launch viewer
"%PY_CMD%" sync.py
if %errorlevel% neq 0 (
    echo.
    echo [CodeMemory Error] Sync script failed.
    pause
    exit /b 1
)

set "PORT=${DEFAULT_PORT}"
if exist port.txt set /p PORT=<port.txt
start http://localhost:%PORT%
"%PY_CMD%" -m mkdocs serve
if %errorlevel% neq 0 (
    echo.
    echo ======================================================================
    echo [CodeMemory] Viewer encountered an error and stopped.
    echo ======================================================================
    echo.
    pause
)
`;
}

function buildShScript() {
  return `#!/usr/bin/env bash
cd "$(dirname "$0")/.viewer"

# 1. Detect Real Python (filter out WindowsApps dummy stub)
PYTHON_BIN=""

if command -v py > /dev/null 2>&1 && py -c "import sys" > /dev/null 2>&1; then
  PYTHON_BIN="py"
elif command -v python3 > /dev/null 2>&1 && python3 -c "import sys" > /dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python > /dev/null 2>&1 && python -c "import sys" > /dev/null 2>&1; then
  PYTHON_BIN="python"
else
  # Direct scan in Windows AppData (for Git Bash on Windows)
  for cand in "$LOCALAPPDATA/Python/pythoncore"*/python.exe "$LOCALAPPDATA/Programs/Python/Python"*/python.exe /c/Python*/python.exe; do
    if [ -f "$cand" ]; then
      PYTHON_BIN="$cand"
      break
    fi
  done
fi

if [ -z "$PYTHON_BIN" ]; then
  echo ""
  echo "======================================================================"
  echo "[CodeMemory Error] Real Python was not found in PATH."
  echo "Windows is intercepting with the dummy Microsoft Store shortcut."
  echo ""
  echo "HOW TO FIX:"
  echo "1. In Windows: Settings -> Apps -> Advanced app settings -> App execution aliases"
  echo "   Turn OFF 'python.exe' and 'python3.exe'."
  echo "2. Re-open terminal or reinstall Python with '[x] Add python.exe to PATH'."
  echo "======================================================================"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi

# 2. Check and auto-install mkdocs-material (force pure-Python mode)
export PYYAML_FORCE_LIBYAML=0
if ! "$PYTHON_BIN" -m mkdocs --version &> /dev/null; then
  echo "[CodeMemory] 'mkdocs-material' is not installed."
  echo "[CodeMemory] Installing documentation dependencies automatically via pip..."
  "$PYTHON_BIN" -m pip uninstall -y pyyaml-pure > /dev/null 2>&1
  "$PYTHON_BIN" -m pip install mkdocs-material
fi

# 3. Sync notes (also writes port.txt + dev_addr from codememory.config.json) and launch viewer
"$PYTHON_BIN" sync.py
PORT=${DEFAULT_PORT}
if [ -f port.txt ]; then PORT=$(cat port.txt); fi
if command -v xdg-open > /dev/null; then
  xdg-open "http://localhost:$PORT" &
elif command -v open > /dev/null; then
  open "http://localhost:$PORT" &
elif command -v start > /dev/null; then
  start "http://localhost:$PORT" &
fi
"$PYTHON_BIN" -m mkdocs serve
if [ $? -ne 0 ]; then
  echo ""
  echo "[CodeMemory] Viewer encountered an error and stopped."
  read -p "Press Enter to exit..."
fi
`;
}

function scaffoldNotes(targetDir, includeExamples) {
  const tpl = (name) => path.join(ROOT_DIR, "templates", name);

  if (includeExamples) {
    copyTemplate(tpl("issue-example.md"), path.join(targetDir, "issues", "1.md"));
    copyTemplate(tpl("playbook-example.md"), path.join(targetDir, "playbooks", "example-playbook.md"));
    copyTemplate(tpl("patch-example.sql"), path.join(targetDir, "patches", "1_patch.sql"));
    copyTemplate(tpl("query-example.md"), path.join(targetDir, "queries", "example-queries.md"));
    copyTemplate(tpl("architecture.md"), path.join(targetDir, "architecture.md"));
    copyTemplate(tpl("errors.md"), path.join(targetDir, "errors.md"));
    copyTemplate(tpl("gotchas.md"), path.join(targetDir, "gotchas.md"));
    copyTemplate(tpl("INDEX.md"), path.join(targetDir, "INDEX.md"));
  } else {
    ensureDirWithGitkeep(path.join(targetDir, "issues"));
    ensureDirWithGitkeep(path.join(targetDir, "playbooks"));
    writeIfMissing(
      path.join(targetDir, "architecture.md"),
      `# System Architecture & Code Map\n\n<!-- Document high-level topology, Mermaid flowcharts and ER diagrams, service boundaries, screen-to-service-to-table flows, and multi-table sync rules here. -->\n`
    );
    writeIfMissing(
      path.join(targetDir, "gotchas.md"),
      `# Gotchas & Key Decisions\n\n<!-- Record subtle bugs, environment quirks, rules of thumb, and the reasons behind important design choices here. -->\n`
    );
    writeIfMissing(
      path.join(targetDir, "errors.md"),
      `# Common Errors & Stack Traces\n\n<!-- Record recurring error messages, stack traces, root causes, and verified fixes here. -->\n`
    );
    writeIfMissing(
      path.join(targetDir, "INDEX.md"),
      `# Knowledge Base Index\n\n| ID | Title / Summary | Type | Status / Env | Key Files | Date |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n`
    );
  }

  copyTemplate(tpl("README.md"), path.join(targetDir, "README.md"));
}

async function runInit() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printInitHelp();
    process.exit(0);
  }

  const dirFlag = getArgValue("--dir");
  const interactive = !dirFlag && Boolean(process.stdin.isTTY);
  const projectRoot = path.resolve(getArgValue("--project-root") || process.cwd());
  const rl = interactive ? readline.createInterface({ input, output }) : null;

  console.log("\n=======================================================");
  console.log("   🧠 Welcome to CodeMemory Setup");
  console.log("   AI-Native Engineering Memory & Universal MCP Server");
  console.log("=======================================================\n");

  // 1. Notes folder
  let targetDir;
  if (dirFlag) {
    targetDir = path.resolve(dirFlag);
  } else if (interactive) {
    const currentDir = process.cwd();
    const isHome = path.resolve(currentDir) === path.resolve(os.homedir());

    console.log(`Current directory: ${currentDir}`);
    const folderAnswer = await rl.question(
      `\n📁 Where should we put CodeMemory?\n   (Enter a folder name like "notes" or "codememory", or "." for current folder)\n   [default: ./codememory]: `
    );
    const folderChoice = folderAnswer.trim();

    if (!folderChoice) {
      targetDir = path.resolve(currentDir, "codememory");
    } else if (folderChoice === ".") {
      if (isHome) {
        console.log(`\n⚠️  WARNING: You are in your user home folder (${currentDir}).`);
        const confirmHome = await rl.question(
          `   Initializing here will create notes folders directly in your home directory.\n   Are you sure? (y/N): `
        );
        if (confirmHome.trim().toLowerCase() !== "y") {
          console.log(`   Safe choice! Defaulting to dedicated folder: ./codememory`);
          targetDir = path.resolve(currentDir, "codememory");
        } else {
          targetDir = currentDir;
        }
      } else {
        targetDir = currentDir;
      }
    } else {
      targetDir = path.resolve(currentDir, folderChoice);
    }
  } else {
    targetDir = path.resolve(process.cwd(), "codememory");
  }

  if (getArgValue("--type")) {
    console.log("ℹ️  --type is no longer needed (CodeMemory v2 uses one unified layout). Ignoring it.");
  }

  // Existing config (re-running init keeps your port and numbering)
  const cfgPath = path.join(targetDir, "codememory.config.json");
  let prevConfig = {};
  try {
    prevConfig = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
  } catch {}

  // 2. Book Reader port
  let port = Number.isInteger(prevConfig.viewerPort) ? prevConfig.viewerPort : DEFAULT_PORT;
  const portFlag = getArgValue("--port");
  if (portFlag) {
    port = parsePort(portFlag);
  } else if (interactive) {
    const portAnswer = (await rl.question(`\n🌐 Book Reader port [${port}]: `)).trim();
    if (portAnswer) port = parsePort(portAnswer);
  }

  // 3. Sample notes
  let includeExamples = hasFlag("--examples");
  if (interactive && !hasFlag("--examples") && !hasFlag("--no-examples")) {
    const exAnswer = await rl.question("\n📦 Include sample demo notes to preview the Book Reader? (y/N): ");
    includeExamples = exAnswer.trim().toLowerCase() === "y";
  }

  // 4. AI client skills (detect, then confirm - never silent)
  let clientIds = [];
  let scope = (getArgValue("--scope") || "").toLowerCase();
  const clientsFlag = getArgValue("--clients");
  if (clientsFlag !== null) {
    clientIds = parseClients(clientsFlag);
  } else if (interactive) {
    const detected = detectClients(projectRoot);
    console.log("\n🤖 Which AI tools do you use? (detected ones are marked)");
    CLIENTS.forEach((c, i) => console.log(`   [${i + 1}] ${c.label}${detected[c.id] ? "  (detected)" : ""}`));
    const ans = (await rl.question("   Numbers separated by commas, Enter = detected ones, 'none' to skip: ")).trim().toLowerCase();
    if (ans === "") {
      clientIds = CLIENTS.filter((c) => detected[c.id]).map((c) => c.id);
    } else {
      const tokens = ans
        .split(",")
        .map((s) => s.trim())
        .map((s) => (/^[1-9]$/.test(s) && CLIENTS[Number(s) - 1] ? CLIENTS[Number(s) - 1].id : s));
      clientIds = parseClients(tokens.join(","));
    }
  }
  if (clientIds.length > 0 && !["project", "global"].includes(scope)) {
    scope = "project";
    if (interactive) {
      console.log(`\n📍 Where should the skill be installed?`);
      console.log(`   [1] This project (${projectRoot})  (default)`);
      console.log(`   [2] Globally for me (${HOME_DIR})`);
      const scopeAns = (await rl.question("   Choose [1-2]: ")).trim();
      if (scopeAns === "2") scope = "global";
    }
  }

  if (rl) rl.close();

  console.log(`\n⚙️  Initializing CodeMemory...`);
  console.log(`📂 Target directory: ${targetDir}\n`);

  fs.mkdirSync(targetDir, { recursive: true });

  // 5. Config
  const config = {
    name: prevConfig.name || path.basename(targetDir),
    version: 2,
    createdAt: prevConfig.createdAt || new Date().toISOString(),
    viewerPort: port,
    lastAutoId: Math.max(Number(prevConfig.lastAutoId) || 0, includeExamples ? 1 : 0),
  };
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf-8");

  // 6. Notes skeleton (clean by default)
  scaffoldNotes(targetDir, includeExamples);

  // 7. Viewer assets & launchers (always refreshed to the latest version)
  const viewerDst = path.join(targetDir, ".viewer");
  fs.mkdirSync(viewerDst, { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, "viewer", "mkdocs.base.yml"), path.join(viewerDst, "mkdocs.base.yml"));
  fs.copyFileSync(path.join(ROOT_DIR, "viewer", "sync.py"), path.join(viewerDst, "sync.py"));
  fs.writeFileSync(path.join(targetDir, "open-book.bat"), buildBatScript(), "utf-8");
  try {
    fs.writeFileSync(path.join(targetDir, "open-book.sh"), buildShScript(), { encoding: "utf-8", mode: 0o755 });
  } catch {
    fs.writeFileSync(path.join(targetDir, "open-book.sh"), buildShScript(), "utf-8");
  }

  // 8. AI skills
  const installed = clientIds.length > 0 ? installClients(clientIds, scope, projectRoot, targetDir) : [];

  console.log(`✅ [OK] Successfully initialized CodeMemory!`);
  console.log(`\n=======================================================`);
  console.log(`   🎉 What to do next:`);
  console.log(`=======================================================`);
  console.log(`1. 📖 Browse your notes in the interactive Book Reader (http://localhost:${port}):`);
  console.log(`   - Windows: double click 'open-book.bat' in ${path.basename(targetDir)}`);
  console.log(`   - Mac/Linux: run './open-book.sh' (auto-installs viewer dependencies on first run)`);
  console.log(`\n2. 🤖 Connect your AI assistant (MCP):`);
  console.log(`   - For Cursor / Antigravity / Claude Desktop (mcp_config.json):`);
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          codememory: { command: "npx", args: ["-y", "@irfansyafie/codememory@latest", "--dir", targetDir] },
        },
      },
      null,
      2
    )
  );
  console.log(`\n   - For OpenCode (opencode.json):`);
  console.log(
    JSON.stringify(
      {
        codememory: {
          type: "local",
          command: ["npx", "-y", "@irfansyafie/codememory@latest", "--dir", targetDir],
          enabled: true,
        },
      },
      null,
      2
    )
  );
  console.log(`\n3. 🧩 AI skill & rules:`);
  if (installed.length > 0) {
    installed.forEach((line) => console.log(`   - ${line}`));
  } else {
    console.log(`   - None installed. The MCP server already sends the workflow rules to your AI on connect.`);
    console.log(`   - To also install the skill: codememory init --dir "${targetDir}" --clients all --scope global`);
  }
  console.log(`\n4. 💡 How logging works:`);
  console.log(`   After a fix or feature, your AI will PROPOSE what to save and wait for your approval.`);
  console.log(`   Try asking: "Check CodeMemory before I fix this" or "What did we learn from the last issue?"\n`);

  process.exit(0);
}

if (command === "init") {
  runInit().catch((err) => {
    if (err && (err.code === "ABORT_ERR" || err.name === "AbortError")) {
      console.log("\nSetup cancelled.");
      process.exit(0);
    }
    console.error("Initialization failed:", err);
    process.exit(1);
  });
} else {
  // Default or 'start': run MCP Server
  const serverScript = path.join(ROOT_DIR, "src", "index.js");
  const child = spawn(process.execPath, [serverScript, ...args], {
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
}
