#!/usr/bin/env node

import fs from "fs";
import path from "path";
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

if (command === "init") {
  const type = getArgValue("--type") || "ticket"; // 'ticket' | 'project' | 'hybrid'
  const targetDir = path.resolve(getArgValue("--dir") || process.cwd());

  console.log(`\nInitializing CodeMemory (${type} mode) in: ${targetDir}...\n`);

  fs.mkdirSync(targetDir, { recursive: true });

  // 1. Write codememory.config.json
  const config = {
    name: path.basename(targetDir),
    type: type,
    createdAt: new Date().toISOString(),
    environments: type === "ticket" ? ["PROD", "STG", "INT"] : ["PROD", "STAGING", "DEV"],
  };
  fs.writeFileSync(path.join(targetDir, "codememory.config.json"), JSON.stringify(config, null, 2), "utf-8");

  // 2. Scaffold directories based on type
  const tplDir = path.join(ROOT_DIR, "templates");

  if (type === "ticket" || type === "hybrid") {
    fs.mkdirSync(path.join(targetDir, "tickets"), { recursive: true });
    fs.mkdirSync(path.join(targetDir, "patches"), { recursive: true });
    fs.mkdirSync(path.join(targetDir, "playbooks"), { recursive: true });

    copyTemplate(path.join(tplDir, "ticket", "ticket-template.md"), path.join(targetDir, "tickets", "001-example.md"));
    copyTemplate(path.join(tplDir, "ticket", "playbook-template.md"), path.join(targetDir, "playbooks", "example-playbook.md"));
    copyTemplate(path.join(tplDir, "ticket", "patch-template.sql"), path.join(targetDir, "patches", "001_example_patch.sql"));
    copyTemplate(path.join(tplDir, "ticket", "relationships.md"), path.join(targetDir, "relationships.md"));
  }

  if (type === "project" || type === "hybrid") {
    fs.mkdirSync(path.join(targetDir, "features"), { recursive: true });
    fs.mkdirSync(path.join(targetDir, "adr"), { recursive: true });
    fs.mkdirSync(path.join(targetDir, "runbooks"), { recursive: true });

    copyTemplate(path.join(tplDir, "project", "feature-template.md"), path.join(targetDir, "features", "FEAT-001-auth.md"));
    copyTemplate(path.join(tplDir, "project", "adr-template.md"), path.join(targetDir, "adr", "ADR-001-database-selection.md"));
    copyTemplate(path.join(tplDir, "project", "runbook-template.md"), path.join(targetDir, "runbooks", "local-setup.md"));
    copyTemplate(path.join(tplDir, "project", "architecture.md"), path.join(targetDir, "architecture.md"));
  }

  // Common files for both modes
  copyTemplate(path.join(tplDir, "common", "gotchas.md"), path.join(targetDir, "gotchas.md"));
  copyTemplate(path.join(tplDir, "common", "errors.md"), path.join(targetDir, "errors.md"));
  copyTemplate(path.join(tplDir, "common", "INDEX.md"), path.join(targetDir, "INDEX.md"));
  copyTemplate(path.join(tplDir, "common", "README.md"), path.join(targetDir, "README.md"));

  // Copy viewer assets
  const viewerDst = path.join(targetDir, ".viewer");
  fs.mkdirSync(viewerDst, { recursive: true });
  copyTemplate(path.join(ROOT_DIR, "viewer", "mkdocs.base.yml"), path.join(viewerDst, "mkdocs.base.yml"));
  copyTemplate(path.join(ROOT_DIR, "viewer", "sync.py"), path.join(viewerDst, "sync.py"));

  // Launchers for Windows & Mac/Linux
  const batScript = `@echo off\ncd /d "%~dp0\\.viewer"\npython sync.py\nstart http://localhost:8000\npython -m mkdocs serve -a 127.0.0.1:8000\n`;
  fs.writeFileSync(path.join(targetDir, "open-book.bat"), batScript, "utf-8");

  const shScript = `#!/usr/bin/env bash\ncd "$(dirname "$0")/.viewer"\npython3 sync.py 2>/dev/null || python sync.py\nif command -v xdg-open > /dev/null; then\n  xdg-open http://localhost:8000 &\nelif command -v open > /dev/null; then\n  open http://localhost:8000 &\nfi\npython3 -m mkdocs serve -a 127.0.0.1:8000 2>/dev/null || python -m mkdocs serve -a 127.0.0.1:8000\n`;
  try {
    fs.writeFileSync(path.join(targetDir, "open-book.sh"), shScript, { encoding: "utf-8", mode: 0o755 });
  } catch {
    fs.writeFileSync(path.join(targetDir, "open-book.sh"), shScript, "utf-8");
  }

  console.log(`[OK] Successfully initialized CodeMemory (${type} mode)!`);
  console.log(`\nNext steps:`);
  console.log(`1. View your knowledge base:`);
  console.log(`   - Windows: double click 'open-book.bat'`);
  console.log(`   - Mac/Linux: run './open-book.sh' (requires: pip install mkdocs-material)`);
  console.log(`\n2. Add this MCP server to your AI assistant (mcp_config.json):`);
  console.log(JSON.stringify({
    mcpServers: {
      codememory: {
        command: "npx",
        args: ["-y", "@irfansyafie/codememory", "--dir", targetDir]
      }
    }
  }, null, 2));
  process.exit(0);
}

// Default or 'start': run MCP Server
const serverScript = path.join(ROOT_DIR, "src", "index.js");
const child = spawn(process.execPath, [serverScript, ...args], {
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code || 0);
});

function copyTemplate(src, dst) {
  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    fs.copyFileSync(src, dst);
  }
}
