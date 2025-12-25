# scripts/render_readme.py
import os
import re
from typing import Any, Dict, List

import yaml
from scripts.utils import read_json

ROOT = os.path.dirname(os.path.dirname(__file__))
PAPERS_YAML = os.path.join(ROOT, "data", "papers.yaml")
CITATIONS_JSON = os.path.join(ROOT, "data", "citations.json")
README_MD = os.path.join(ROOT, "README.md")

START_MARKER = "<!-- DIFFUSION_LIGHTHOUSE_TABLE_START -->"
END_MARKER = "<!-- DIFFUSION_LIGHTHOUSE_TABLE_END -->"


def md_link(label, url):
    return "[{0}]({1})".format(label, url) if url else ""


def render_table(rows):
    lines = []
    lines.append("| # | Title | Year | Venue | Citations | Last checked (UTC) | Tags | Links |")
    lines.append("|---:|---|---:|---|---:|---|---|---|")
    for i, r in enumerate(rows, start=1):
        title = r.get("title", "")
        links_obj = r.get("links", {}) or {}
        arxiv = links_obj.get("arxiv", "")
        title_cell = md_link(title, arxiv) if arxiv else title

        year = r.get("year", "")
        venue = r.get("venue", "")
        citations = r.get("citations", None)
        if isinstance(citations, int):
            citations_cell = "{0:,}".format(citations)  # 12,345
        else:
            citations_cell = "—"

        checked = r.get("last_checked_utc") or "—"
        tags = ", ".join(r.get("tags", []) or [])

        links = []
        if links_obj.get("arxiv"):
            links.append(md_link("arXiv", links_obj["arxiv"]))
        if links_obj.get("doi"):
            links.append(md_link("DOI", links_obj["doi"]))
        if links_obj.get("pdf"):
            links.append(md_link("PDF", links_obj["pdf"]))

        scholar_url = r.get("scholar_url") or ""
        if scholar_url:
            links.append(md_link("Scholar", scholar_url))

        links_cell = " · ".join([x for x in links if x]) if links else "—"

        lines.append("| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7} |".format(
            i, title_cell, year, venue, citations_cell, checked, tags, links_cell
        ))
    return "\n".join(lines)


def build_table_block(cfg, citations):
    c_papers = citations.get("papers", {}) or {}

    rows = []
    for p in cfg.get("papers", []) or []:
        pid = p.get("id")
        if not pid:
            continue
        c = c_papers.get(pid, {}) or {}
        row = dict(p)
        row["citations"] = c.get("citations")
        row["last_checked_utc"] = c.get("last_checked_utc")
        row["scholar_url"] = c.get("scholar_url") or (p.get("scholar", {}) or {}).get("scholar_url")
        rows.append(row)

    def sort_key(r):
        c = r.get("citations")
        c_key = c if isinstance(c, int) else -1
        y = r.get("year") or 0
        return (c_key, y)

    rows.sort(key=sort_key, reverse=True)

    last_updated = (citations.get("meta", {}) or {}).get("last_updated_utc") or "—"

    block_lines = []
    block_lines.append(START_MARKER)
    block_lines.append("")
    block_lines.append("_Last updated (UTC): **{0}**_".format(last_updated))
    block_lines.append("")
    block_lines.append(render_table(rows))
    block_lines.append("")
    block_lines.append(END_MARKER)
    return "\n".join(block_lines)


def main():
    with open(PAPERS_YAML, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}

    citations = read_json(CITATIONS_JSON, default={"meta": {}, "papers": {}})

    # Read existing README (or create a minimal one if missing)
    if os.path.exists(README_MD):
        with open(README_MD, "r", encoding="utf-8") as f:
            readme = f.read()
    else:
        readme = "# 🌊 Diffusion Lighthouse\n\n## Papers\n\n{0}\n\n{1}\n".format(START_MARKER, END_MARKER)

    if START_MARKER not in readme or END_MARKER not in readme:
        raise RuntimeError(
            "README.md must contain both markers:\n{0}\n{1}".format(START_MARKER, END_MARKER)
        )

    new_block = build_table_block(cfg, citations)

    # Replace everything between markers (inclusive) with new_block
    pattern = re.compile(
        re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER),
        re.DOTALL
    )
    updated = pattern.sub(new_block, readme, count=1)

    with open(README_MD, "w", encoding="utf-8") as f:
        f.write(updated)


if __name__ == "__main__":
    main()
