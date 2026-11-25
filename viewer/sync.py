import os
import re
import html
import shutil
import json
from pathlib import Path

VIEWER_DIR = Path(__file__).resolve().parent
ROOT_DIR = VIEWER_DIR.parent
DOCS_DIR = VIEWER_DIR / "docs"

DEFAULT_PORT = 8000
TYPE_ORDER = ["Bug", "Feature", "Decision"]

MERMAID_FENCE_RE = re.compile(
    r"^([ \t]*)```mermaid[ \t]*\r?\n(.*?)\r?\n\1```[ \t]*$",
    re.MULTILINE | re.DOTALL,
)

# Links to ../patches/x.sql point at the generated x.sql.md page inside the book
PATCH_LINK_RE = re.compile(r"\((\.\./patches/[^)\s]+?\.sql)\)")


def convert_mermaid_blocks(text):
    """Convert ```mermaid fenced blocks into <pre class="mermaid"><code>...</code></pre>
    so Material for MkDocs renders Mermaid diagrams natively without requiring
    PyYAML's !!python/name: constructor tag (which fails on Python 3.15 SafeLoader)."""
    def repl(match):
        indent = match.group(1)
        body = match.group(2)
        if indent:
            body_lines = [
                line[len(indent):] if line.startswith(indent) else line
                for line in body.splitlines()
            ]
            body = "\n".join(body_lines)
        escaped = html.escape(body, quote=False)
        if indent:
            indented_body = "\n".join(indent + l if l else "" for l in escaped.splitlines())
            return f'{indent}<pre class="mermaid"><code>{indented_body}</code></pre>'
        return f'<pre class="mermaid"><code>{escaped}</code></pre>'

    return MERMAID_FENCE_RE.sub(repl, text)


def copy_markdown_file(src_file, dst_file):
    Path(dst_file).parent.mkdir(parents=True, exist_ok=True)
    if str(src_file).lower().endswith(".md"):
        content = Path(src_file).read_text(encoding="utf-8", errors="replace")
        content = PATCH_LINK_RE.sub(r"(\1.md)", content)
        Path(dst_file).write_text(convert_mermaid_blocks(content), encoding="utf-8")
    else:
        shutil.copy2(src_file, dst_file)


def load_config():
    cfg_path = ROOT_DIR / "codememory.config.json"
    if cfg_path.exists():
        try:
            with open(cfg_path, "r", encoding="utf-8-sig") as f:
                return json.load(f)
        except Exception:
            pass
    return {"name": "CodeMemory"}


def get_port(config):
    try:
        port = int(config.get("viewerPort", DEFAULT_PORT))
        if 1024 <= port <= 65535:
            return port
    except (TypeError, ValueError):
        pass
    return DEFAULT_PORT


def q(text):
    return '"' + str(text).replace('"', "'") + '"'


def title_of(path, fallback):
    try:
        for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("# "):
                return line[2:].strip() or fallback
    except OSError:
        pass
    return fallback


def setup_docs():
    if DOCS_DIR.exists():
        shutil.rmtree(DOCS_DIR)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)


def copy_dir_markdown(name):
    """Copy ROOT/<name>/*.md into docs/<name>/ and return [(title, 'name/file.md'), ...]."""
    src = ROOT_DIR / name
    items = []
    if src.is_dir():
        for item in sorted(src.glob("*.md")):
            copy_markdown_file(item, DOCS_DIR / name / item.name)
            items.append((title_of(item, item.stem), f"{name}/{item.name}"))
    return items


def copy_patches():
    """Turn patches/**/*.sql into viewable .sql.md pages; returns [(name, path relative to patches/)]."""
    src = ROOT_DIR / "patches"
    dst = DOCS_DIR / "patches"
    items = []
    if not src.is_dir():
        return items
    for f in sorted(src.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(src)
        sub = rel.parent.as_posix()
        prefix = "" if sub == "." else sub + "/"
        if f.suffix.lower() == ".sql":
            out = dst / rel.parent / f"{f.name}.md"
            out.parent.mkdir(parents=True, exist_ok=True)
            sql = f.read_text(encoding="utf-8", errors="replace")
            out.write_text(f"# SQL Patch: `{f.name}`\n\n```sql\n{sql}\n```\n", encoding="utf-8")
            items.append((f.name, f"{prefix}{f.name}.md"))
        elif f.suffix.lower() == ".md":
            copy_markdown_file(f, dst / rel)
            items.append((f.stem, f"{prefix}{f.name}"))
    return items


def parse_index():
    """Read INDEX.md table rows: | ID | Title | Type | Status/Env | Key Files | Date |"""
    path = ROOT_DIR / "INDEX.md"
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s.startswith("|"):
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        if len(cells) < 6:
            continue
        if set(cells[0]) <= set(":- "):
            continue
        if cells[0].lower() == "id":
            continue
        rid = cells[0].strip("`").lstrip("#").strip()
        if not rid:
            continue
        rows.append(
            {
                "id": rid,
                "title": cells[1],
                "type": cells[2] or "Bug",
                "env": cells[3],
                "files": cells[4],
                "date": cells[5],
            }
        )
    return rows


def id_sort_key(row):
    rid = row["id"]
    if rid.isdigit():
        return (0, int(rid), "")
    return (1, 0, rid.lower())


def table_lines(rows, link_prefix, linkable):
    lines = [
        "| ID | Title | Type | Env / Status | Key Files | Date |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ]
    for r in rows:
        rid = r["id"]
        id_cell = f"[{rid}]({link_prefix}{rid}.md)" if rid in linkable else f"`{rid}`"
        lines.append(f"| {id_cell} | {r['title']} | {r['type']} | {r['env']} | {r['files']} | {r['date']} |")
    return lines


def build_tabs(rows, link_prefix, linkable):
    """Entries table with All / Bug / Feature / Decision tabs (Material tabbed content)."""
    if not rows:
        return "_No entries logged yet. After your next fix or feature, your AI will propose what to log._\n"
    rows = sorted(rows, key=id_sort_key)
    known = [t for t in TYPE_ORDER if any(r["type"] == t for r in rows)]
    extra = sorted({r["type"] for r in rows} - set(TYPE_ORDER))
    sections = [("All", rows)] + [(t, [r for r in rows if r["type"] == t]) for t in known + extra]
    out = []
    for label, items in sections:
        out.append(f'=== "{label} ({len(items)})"')
        out.append("")
        for line in table_lines(items, link_prefix, linkable):
            out.append("    " + line)
        out.append("")
    return "\n".join(out)


def write_doc(rel_path, text):
    out = DOCS_DIR / rel_path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")


def main():
    print(f"Syncing CodeMemory docs from {ROOT_DIR} into {DOCS_DIR}...")
    setup_docs()
    config = load_config()
    project_name = str(config.get("name", "CodeMemory")) or "CodeMemory"
    port = get_port(config)

    # Plain pages
    has_how_to = (ROOT_DIR / "README.md").exists()
    if has_how_to:
        copy_markdown_file(ROOT_DIR / "README.md", DOCS_DIR / "how-to-use.md")
    kb_files = [
        ("System Architecture & Code Map", "architecture.md"),
        ("Error Dictionary", "errors.md"),
        ("Gotchas & Key Decisions", "gotchas.md"),
    ]
    kb_items = []
    for label, fname in kb_files:
        if (ROOT_DIR / fname).exists():
            copy_markdown_file(ROOT_DIR / fname, DOCS_DIR / fname)
            kb_items.append((label, fname))

    # Folders
    issue_items = copy_dir_markdown("issues")
    playbook_items = copy_dir_markdown("playbooks")
    query_items = copy_dir_markdown("queries")
    patch_items = copy_patches()

    rows = parse_index()
    linkable = {Path(link).stem for _, link in issue_items}

    # Issues overview + home page share the same table
    has_issues = bool(rows or issue_items)
    if has_issues:
        write_doc(
            "issues/index.md",
            "# Issues\n\nAll bugs, features and decisions logged so far.\n\n" + build_tabs(rows, "", linkable),
        )
    if patch_items:
        lines = ["# SQL Patches", "", "Verified patch scripts (PRE-CHECK, EXECUTE, POST-CHECK).", ""]
        lines += ["| Patch | Page |", "| :--- | :--- |"]
        for name, link in patch_items:
            lines.append(f"| `{name}` | [open]({link}) |")
        write_doc("patches/index.md", "\n".join(lines) + "\n")

    quick = []
    if has_issues:
        quick.append(("Issues", "issues/index.md", "Every bug, feature and decision logged so far."))
    if playbook_items:
        quick.append(("Playbooks", playbook_items[0][1], "Repeatable step-by-step guides."))
    if patch_items:
        quick.append(("Patches", "patches/index.md", "Verified SQL patch scripts."))
    if query_items:
        quick.append(("Queries", query_items[0][1], "Verified diagnostic queries."))
    for label, fname in kb_items:
        quick.append((label, fname, ""))
    if has_how_to:
        quick.append(("How to use", "how-to-use.md", "How this notebook and your AI work together."))

    home = [
        f"# {project_name}",
        "",
        "Welcome to your engineering memory. Use the sidebar or the search bar to find past fixes, features and decisions.",
        "",
        "### Quick Navigation",
        "",
    ]
    for label, link, desc in quick:
        home.append(f"* **[{label}]({link})**" + (f": {desc}" if desc else ""))
    home += ["", "---", "", "## Logged Entries", "", build_tabs(rows, "issues/", linkable)]
    write_doc("index.md", "\n".join(home) + "\n")

    # Navigation
    nav = ["nav:", "  - Home: index.md"]
    if has_how_to:
        nav.append("  - How to use: how-to-use.md")
    if has_issues:
        nav.append("  - Issues: issues/index.md")
    if playbook_items:
        nav.append("  - Playbooks:")
        for label, link in playbook_items:
            nav.append(f"    - {q(label)}: {link}")
    if patch_items:
        nav.append("  - Patches: patches/index.md")
    if query_items:
        nav.append("  - Queries:")
        for label, link in query_items:
            nav.append(f"    - {q(label)}: {link}")
    if kb_items:
        nav.append("  - Knowledge Base:")
        for label, fname in kb_items:
            nav.append(f"    - {q(label)}: {fname}")

    # mkdocs.yml (site_name and dev_addr come from codememory.config.json)
    base_yml = VIEWER_DIR / "mkdocs.base.yml"
    base_content = base_yml.read_text(encoding="utf-8")
    base_content = "\n".join(
        line for line in base_content.splitlines() if not line.startswith("site_name:")
    )
    site_name = project_name.replace("'", "''")
    final_yml = (
        f"site_name: '{site_name}'\n"
        f"dev_addr: 127.0.0.1:{port}\n"
        + base_content
        + "\n\n"
        + "\n".join(nav)
        + "\n"
    )
    out_yml = VIEWER_DIR / "mkdocs.yml"
    out_yml.write_text(final_yml, encoding="utf-8")
    (VIEWER_DIR / "port.txt").write_text(str(port), encoding="utf-8")

    print(f"[OK] Successfully synced docs and generated {out_yml}")
    try:
        import mkdocs  # noqa: F401
    except ImportError:
        print("\n[CodeMemory] 'mkdocs-material' is not installed in your Python environment.")
        print("[CodeMemory] Installing automatically via pip...")
        import subprocess
        import sys

        env = os.environ.copy()
        env["PYYAML_FORCE_LIBYAML"] = "0"
        try:
            # Ensure pyyaml-pure is not conflicting
            subprocess.run(
                [sys.executable, "-m", "pip", "uninstall", "-y", "pyyaml-pure"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            subprocess.check_call([sys.executable, "-m", "pip", "install", "mkdocs-material"], env=env)
            print("[CodeMemory] Successfully installed mkdocs-material!\n")
        except Exception as e:
            print(f"\n[CodeMemory Error] Could not install mkdocs-material: {e}")
            print("Please run manually: pip install mkdocs-material\n")


if __name__ == "__main__":
    main()
