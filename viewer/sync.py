import os
import shutil
import json
from pathlib import Path

VIEWER_DIR = Path(__file__).resolve().parent
ROOT_DIR = VIEWER_DIR.parent
DOCS_DIR = VIEWER_DIR / "docs"

def load_config():
    cfg_path = ROOT_DIR / "codememory.config.json"
    if cfg_path.exists():
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"name": "CodeMemory", "type": "hybrid"}

def setup_docs():
    if DOCS_DIR.exists():
        shutil.rmtree(DOCS_DIR)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

def copy_markdown_dir(src_name, dst_name):
    src = ROOT_DIR / src_name
    dst = DOCS_DIR / dst_name
    items = []
    if src.exists() and src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
        for item in sorted(src.glob("*.md")):
            shutil.copy2(item, dst / item.name)
            title = item.stem.replace("-", " ").replace("_", " ").title()
            items.append({title: f"{dst_name}/{item.name}"})
    return items

def copy_patches():
    src = ROOT_DIR / "patches"
    dst = DOCS_DIR / "patches"
    items = []
    if src.exists() and src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
        for root, _, files in os.walk(src):
            for f in sorted(files):
                if f.endswith(".sql") or f.endswith(".md"):
                    rel_p = Path(root).relative_to(src)
                    out_dir = dst / rel_p
                    out_dir.mkdir(parents=True, exist_ok=True)
                    
                    src_file = Path(root) / f
                    if f.endswith(".sql"):
                        # Convert SQL to Markdown with code block for viewing
                        dst_file = out_dir / f"{f}.md"
                        with open(src_file, "r", encoding="utf-8", errors="replace") as sf:
                            sql_content = sf.read()
                        with open(dst_file, "w", encoding="utf-8") as df:
                            df.write(f"# SQL Patch: `{f}`\n\n```sql\n{sql_content}\n```\n")
                        rel_link = f"patches/{rel_p}/{f}.md" if str(rel_p) != "." else f"patches/{f}.md"
                        items.append({f: rel_link})
                    else:
                        shutil.copy2(src_file, out_dir / f)
                        rel_link = f"patches/{rel_p}/{f}" if str(rel_p) != "." else f"patches/{f}"
                        items.append({Path(f).stem: rel_link})
    return items

def copy_file(name, target_name=None):
    target = target_name or name
    src = ROOT_DIR / name
    dst = DOCS_DIR / target
    if src.exists():
        shutil.copy2(src, dst)
        return True
    return False

def main():
    print(f"Syncing CodeMemory docs from {ROOT_DIR} into {DOCS_DIR}...")
    setup_docs()
    config = load_config()
    mode = config.get("type", "hybrid")
    project_name = config.get("name", "CodeMemory Book")

    # Common files
    has_readme = copy_file("README.md", "index.md")
    has_index = copy_file("INDEX.md")
    has_gotchas = copy_file("gotchas.md")
    has_errors = copy_file("errors.md")
    has_rel = copy_file("relationships.md")
    has_arch = copy_file("architecture.md")

    # Mode-specific folders
    ticket_items = copy_markdown_dir("tickets", "tickets") if mode in ("ticket", "hybrid") else []
    patch_items = copy_patches() if mode in ("ticket", "hybrid") else []
    playbook_items = copy_markdown_dir("playbooks", "playbooks") if mode in ("ticket", "hybrid") else []

    feature_items = copy_markdown_dir("features", "features") if mode in ("project", "hybrid") else []
    adr_items = copy_markdown_dir("adr", "adr") if mode in ("project", "hybrid") else []
    runbook_items = copy_markdown_dir("runbooks", "runbooks") if mode in ("project", "hybrid") else []

    # Read base config
    base_yml = VIEWER_DIR / "mkdocs.base.yml"
    with open(base_yml, "r", encoding="utf-8") as f:
        base_content = f.read()

    # Build nav structure
    nav_lines = ["nav:"]
    if has_readme:
        nav_lines.append("  - Overview: index.md")
    if has_index:
        nav_lines.append("  - Index: INDEX.md")

    # Ticket mode sections
    if mode in ("ticket", "hybrid"):
        if ticket_items:
            nav_lines.append("  - Tickets:")
            for item in ticket_items:
                for k, v in item.items():
                    nav_lines.append(f"      - {k}: {v}")
        if patch_items:
            nav_lines.append("  - SQL Patches:")
            for item in patch_items:
                for k, v in item.items():
                    nav_lines.append(f"      - {k}: {v}")
        if playbook_items:
            nav_lines.append("  - Playbooks:")
            for item in playbook_items:
                for k, v in item.items():
                    nav_lines.append(f"      - {k}: {v}")

    # Project mode sections
    if mode in ("project", "hybrid"):
        if feature_items:
            nav_lines.append("  - Features:")
            for item in feature_items:
                for k, v in item.items():
                    nav_lines.append(f"      - {k}: {v}")
        if adr_items:
            nav_lines.append("  - ADRs:")
            for item in adr_items:
                for k, v in item.items():
                    nav_lines.append(f"      - {k}: {v}")
        if runbook_items:
            nav_lines.append("  - Runbooks:")
            for item in runbook_items:
                for k, v in item.items():
                    nav_lines.append(f"      - {k}: {v}")

    # Knowledge / Architecture section
    kb_items = []
    if has_arch:
        kb_items.append("      - System Architecture: architecture.md")
    if has_rel:
        kb_items.append("      - Entity Relationships: relationships.md")
    if has_errors:
        kb_items.append("      - Error Dictionary: errors.md")
    if has_gotchas:
        kb_items.append("      - Gotchas & Traps: gotchas.md")

    if kb_items:
        nav_lines.append("  - Knowledge Base:")
        nav_lines.extend(kb_items)

    final_yml = f"site_name: '{project_name}'\n" + base_content + "\n" + "\n".join(nav_lines) + "\n"

    out_yml = VIEWER_DIR / "mkdocs.yml"
    with open(out_yml, "w", encoding="utf-8") as f:
        f.write(final_yml)

    print(f"[OK] Successfully synced docs and generated {out_yml}")
    import sys
    if sys.version_info >= (3, 15):
        print("\n======================================================================")
        print("⚠️  [CodeMemory Warning] You are running Python 3.15+ (experimental/preview).")
        print("Pre-compiled binary wheels (like PyYAML) are not published for Python 3.15 yet,")
        print("which requires Microsoft Visual C++ to compile from source.")
        print("👉 RECOMMENDED FIX: Install Python 3.12, 3.13, or 3.14 (Stable) from:")
        print("   https://www.python.org/downloads/")
        print("======================================================================\n")

    try:
        import mkdocs
    except ImportError:
        print("\n[CodeMemory] 'mkdocs-material' is not installed in your Python environment.")
        print("[CodeMemory] Installing automatically via pip...")
        import subprocess
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "mkdocs-material"])
            print("[CodeMemory] Successfully installed mkdocs-material!\n")
        except Exception as e:
            print(f"\n[CodeMemory Error] Could not install mkdocs-material: {e}")
            if sys.version_info >= (3, 15):
                print("This failure is due to Python 3.15 lacking pre-built wheels.")
                print("Please switch to a stable Python release (3.12, 3.13, or 3.14).\n")
            else:
                print("Please run manually: pip install mkdocs-material\n")

if __name__ == "__main__":
    main()
