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

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function copyTemplate(src, dst) {
  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

async function runInit() {
  const rl = readline.createInterface({ input, output });

  let targetDir = getArgValue("--dir");
  let type = getArgValue("--type");

  console.log("\n=======================================================");
  console.log("   🧠 Welcome to CodeMemory Setup");
  console.log("   AI-Native Engineering Memory & Universal MCP Server");
  console.log("=======================================================\n");

  // 1. Interactive Directory Selection (if not passed via flag)
  if (!targetDir) {
    const currentDir = process.cwd();
    const isHome = path.resolve(currentDir) === path.resolve(os.homedir());

    console.log(`Current directory: ${currentDir}`);
    const folderAnswer = await rl.question(
      `\n📁 Where would you like to initialize CodeMemory?\n   (Enter a folder name like "notes" or "codememory", or "." for current folder)\n   [default: ./codememory]: `
    );

    const folderChoice = folderAnswer.trim();

    if (!folderChoice || folderChoice === "") {
      targetDir = path.resolve(currentDir, "codememory");
    } else if (folderChoice === ".") {
      if (isHome) {
        console.log(`\n⚠️  WARNING: You are in your user home folder (${currentDir}).`);
        const confirmHome = await rl.question(
          `   Initializing here will create ticket and config folders directly in your home directory.\n   Are you sure? (y/N): `
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
    targetDir = path.resolve(targetDir);
  }

  // 2. Interactive Type Selection (if not passed via flag)
  if (!type || !["ticket", "project", "hybrid"].includes(type.toLowerCase())) {
    console.log("\n🎯 Select the configuration mode for CodeMemory:");
    console.log("   [1] ticket  - Bug fixes, incident tracking, 3-step SQL patches, playbooks & error dictionary");
    console.log("   [2] project - Greenfield apps, feature architecture, ADRs, runbooks & data flows");
    console.log("   [3] hybrid  - Full engineering suite combining both\n");

    const typeAnswer = await rl.question("   Choose mode [1-3] (default: 1): ");
    const choice = typeAnswer.trim();

    if (choice === "2" || choice.toLowerCase() === "project") {
      type = "project";
    } else if (choice === "3" || choice.toLowerCase() === "hybrid") {
      type = "hybrid";
    } else {
      type = "ticket";
    }
  } else {
    type = type.toLowerCase();
  }

  rl.close();

  console.log(`\n⚙️  Initializing CodeMemory in [${type} mode]...`);
  console.log(`📂 Target directory: ${targetDir}\n`);

  fs.mkdirSync(targetDir, { recursive: true });

  // 3. Write codememory.config.json
  const config = {
    name: path.basename(targetDir),
    type: type,
    createdAt: new Date().toISOString(),
    environments: type === "ticket" ? ["PROD", "STG", "INT"] : ["PROD", "STAGING", "DEV"],
  };
  fs.writeFileSync(path.join(targetDir, "codememory.config.json"), JSON.stringify(config, null, 2), "utf-8");

  // 4. Scaffold directories based on type
  const tplDir = path.join(ROOT_DIR, "templates");

  if (type === "ticket" || type === "hybrid") {
    copyTemplate(path.join(tplDir, "ticket", "ticket-template.md"), path.join(targetDir, "tickets", "001-example.md"));
    copyTemplate(path.join(tplDir, "ticket", "playbook-template.md"), path.join(targetDir, "playbooks", "example-playbook.md"));
    copyTemplate(path.join(tplDir, "ticket", "patch-template.sql"), path.join(targetDir, "patches", "001_example_patch.sql"));
    copyTemplate(path.join(tplDir, "ticket", "relationships.md"), path.join(targetDir, "relationships.md"));
  }

  if (type === "project" || type === "hybrid") {
    copyTemplate(path.join(tplDir, "project", "feature-template.md"), path.join(targetDir, "features", "FEAT-001-auth.md"));
    copyTemplate(path.join(tplDir, "project", "adr-template.md"), path.join(targetDir, "adr", "ADR-001-database-selection.md"));
    copyTemplate(path.join(tplDir, "project", "runbook-template.md"), path.join(targetDir, "runbooks", "local-setup.md"));
    copyTemplate(path.join(tplDir, "project", "architecture.md"), path.join(targetDir, "architecture.md"));
  }

  // Common knowledge base files
  copyTemplate(path.join(tplDir, "common", "gotchas.md"), path.join(targetDir, "gotchas.md"));
  copyTemplate(path.join(tplDir, "common", "errors.md"), path.join(targetDir, "errors.md"));
  copyTemplate(path.join(tplDir, "common", "INDEX.md"), path.join(targetDir, "INDEX.md"));
  copyTemplate(path.join(tplDir, "common", "README.md"), path.join(targetDir, "README.md"));

  // 5. Inject AI Rules directly into the target so AI automatically picks them up!
  const skillsDir = path.join(ROOT_DIR, "skills");
  copyTemplate(path.join(skillsDir, "cursor", ".cursorrules"), path.join(targetDir, ".cursorrules"));
  copyTemplate(path.join(skillsDir, "claude", "CLAUDE.md"), path.join(targetDir, "CLAUDE.md"));
  copyTemplate(path.join(skillsDir, "antigravity", "SKILL.md"), path.join(targetDir, "skills", "codememory", "SKILL.md"));

  // 6. Copy viewer assets & launchers (always update viewer scripts to latest version)
  const viewerDst = path.join(targetDir, ".viewer");
  fs.mkdirSync(viewerDst, { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, "viewer", "mkdocs.base.yml"), path.join(viewerDst, "mkdocs.base.yml"));
  fs.copyFileSync(path.join(ROOT_DIR, "viewer", "sync.py"), path.join(viewerDst, "sync.py"));

  const batScript = `@echo off
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

:: 3. Sync notes and launch web viewer
"%PY_CMD%" sync.py
if %errorlevel% neq 0 (
    echo.
    echo [CodeMemory Error] Sync script failed.
    pause
    exit /b 1
)

start http://localhost:8000
"%PY_CMD%" -m mkdocs serve -a 127.0.0.1:8000
if %errorlevel% neq 0 (
    echo.
    echo ======================================================================
    echo [CodeMemory] Viewer encountered an error and stopped.
    echo ======================================================================
    echo.
    pause
)
`;
  fs.writeFileSync(path.join(targetDir, "open-book.bat"), batScript, "utf-8");

  const shScript = `#!/usr/bin/env bash
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

# 3. Sync notes and launch web viewer
"$PYTHON_BIN" sync.py
if command -v xdg-open > /dev/null; then
  xdg-open http://localhost:8000 &
elif command -v open > /dev/null; then
  open http://localhost:8000 &
elif command -v start > /dev/null; then
  start http://localhost:8000 &
fi
"$PYTHON_BIN" -m mkdocs serve -a 127.0.0.1:8000
if [ $? -ne 0 ]; then
  echo ""
  echo "[CodeMemory] Viewer encountered an error and stopped."
  read -p "Press Enter to exit..."
fi
`;
  try {
    fs.writeFileSync(path.join(targetDir, "open-book.sh"), shScript, { encoding: "utf-8", mode: 0o755 });
  } catch {
    fs.writeFileSync(path.join(targetDir, "open-book.sh"), shScript, "utf-8");
  }

  console.log(`✅ [OK] Successfully initialized CodeMemory (${type} mode)!`);
  console.log(`\n=======================================================`);
  console.log(`   🎉 What to do next:`);
  console.log(`=======================================================`);
  console.log(`1. 📖 Browse Knowledge Base in Interactive Reader:`);
  console.log(`   - Windows: double click 'open-book.bat' in ${path.basename(targetDir)}`);
  console.log(`   - Mac/Linux: run './open-book.sh' (auto-installs viewer dependencies on first run)`);
  console.log(`\n2. 🤖 Connect AI Assistant:`);
  console.log(`   - For Cursor / Antigravity / Claude Desktop (mcp_config.json):`);
  console.log(JSON.stringify({
    mcpServers: {
      codememory: {
        command: "npx",
        args: ["-y", "@irfansyafie/codememory@latest", "--dir", targetDir]
      }
    }
  }, null, 2));
  console.log(`\n   - For OpenCode (opencode.json):`);
  console.log(JSON.stringify({
    codememory: {
      type: "local",
      command: ["npx", "-y", "@irfansyafie/codememory@latest", "--dir", targetDir],
      enabled: true
    }
  }, null, 2));
  console.log(`\n3. 💡 Using with your AI:`);
  console.log(`   AI rules (.cursorrules, CLAUDE.md) have been auto-injected.`);
  console.log(`   Try asking your AI:`);
  console.log(`   > "Lookup error ORA-00001 in CodeMemory"`);
  console.log(`   > "Check CodeMemory gotchas before I write this database transaction"`);
  console.log(`   > "Log this bug fix into CodeMemory"\n`);

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
