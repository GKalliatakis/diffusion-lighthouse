#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import yaml
import subprocess
import sys


def infer_publication_status(p: dict) -> str | None:
    """Infer publication_status if missing.
    - venue == arXiv -> canonical_preprint
    - otherwise -> accepted
    """
    if p.get("publication_status"):
        return None  # keep user-provided

    venue = str(p.get("venue", "")).strip().lower()
    if venue == "arxiv":
        return "canonical_preprint"
    if venue:
        return "accepted"
    return None


def main() -> None:
    papers_path = Path("../data/papers.yaml")
    citations_path = Path("../data/citations.json")
    out_dir = Path("../site/public/data")
    out_dir.mkdir(parents=True, exist_ok=True)

    with papers_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    citations = {}
    meta = {}

    if citations_path.exists():
        with citations_path.open("r", encoding="utf-8") as f:
            raw = json.load(f) or {}
            meta = raw.get("meta", {}) or {}
            citations = raw.get("papers", {}) or {}

    papers = data.get("papers", []) or []

    for p in papers:
        # Infer publication_status (so UI doesn't say "No link" for peer-reviewed venues)
        inferred = infer_publication_status(p)
        if inferred:
            p["publication_status"] = inferred

        # Merge in citations from citations.json (authoritative for counts)
        cid = p.get("id")
        if not cid:
            continue

        c = citations.get(cid)
        if c and "citations" in c:
            p["citations"] = {
                "count": int(c["citations"]),
                "last_checked_utc": c.get("last_checked_utc"),
                "source": c.get("source_used"),
            }

            # Keep scholar links in a consistent location
            p.setdefault("scholar", {})

            # Prefer Google Scholar link if available
            if c.get("scholar_url"):
                p["scholar"]["scholar_url"] = c["scholar_url"]

            # Otherwise fall back to Semantic Scholar if that's what we used
            elif c.get("semantic_scholar_url"):
                p["scholar"]["scholar_url"] = c["semantic_scholar_url"]

    data["papers"] = papers
    data["citations_meta"] = meta


    # Validate before building
    validator = Path(__file__).resolve().parent / "validate_papers.py"
    if validator.exists():
        subprocess.run([sys.executable, str(validator)], check=True)

    out_path = out_dir / "papers.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Wrote {out_path} ({len(papers)} papers)")


if __name__ == "__main__":
    main()
