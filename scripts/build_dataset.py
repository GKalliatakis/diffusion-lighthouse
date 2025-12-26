#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import yaml


def main() -> None:
    papers_path = Path("../data/papers.yaml")
    citations_path = Path("../data/citations.json")
    out_dir = Path("../site/public/data")
    out_dir.mkdir(parents=True, exist_ok=True)

    with papers_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    citations = {}
    meta = {}

    if citations_path.exists():
        with citations_path.open("r", encoding="utf-8") as f:
            raw = json.load(f)
            meta = raw.get("meta", {})
            citations = raw.get("papers", {})

    for p in data.get("papers", []):
        cid = p["id"]
        c = citations.get(cid)
        if c and "citations" in c:
            p["citations"] = {
                "count": int(c["citations"]),
                "last_checked_utc": c.get("last_checked_utc"),
                "source": c.get("source_used"),
                "scholar_url": c.get("scholar_url"),
            }

    data["citations_meta"] = meta

    out_path = out_dir / "papers.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Wrote {out_path} ({len(data['papers'])} papers)")


if __name__ == "__main__":
    main()
