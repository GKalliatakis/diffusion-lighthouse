#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Set

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA = ROOT / "data" / "papers.yaml"
DEFAULT_SCHEMA = ROOT / "data" / "schema.json"

try:
    import jsonschema
except ImportError:
    print("Missing dependency: jsonschema. Install with: pip install jsonschema", file=sys.stderr)
    sys.exit(2)


def load_yaml(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_json(path: Path) -> Dict[str, Any]:
    import json
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def validate_relations_exist(papers: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    ids: Set[str] = {p["id"] for p in papers}

    for p in papers:
        for rel in p.get("relations", []) or []:
            tgt = rel.get("target")
            if tgt not in ids:
                errors.append(f"{p['id']}: relation target '{tgt}' does not exist")
            if tgt == p["id"]:
                errors.append(f"{p['id']}: relation target cannot be self")
    return errors


def validate_unique_ids(papers: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    seen: Set[str] = set()
    for p in papers:
        pid = p.get("id")
        if pid in seen:
            errors.append(f"Duplicate id: {pid}")
        seen.add(pid)
    return errors


def validate_arxiv_links(papers: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    for p in papers:
        links = p.get("links", {}) or {}
        arxiv = links.get("arxiv", "")
        pdf = links.get("pdf", "")

        # Keep this strict to avoid drift; loosen later if needed.
        if not isinstance(arxiv, str) or not arxiv.startswith("https://arxiv.org/abs/"):
            errors.append(f"{p['id']}: links.arxiv must start with 'https://arxiv.org/abs/'")
        if not isinstance(pdf, str) or not (pdf.startswith("https://arxiv.org/pdf/") and pdf.endswith(".pdf")):
            errors.append(f"{p['id']}: links.pdf must be an arXiv PDF URL ending in .pdf")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(DEFAULT_DATA))
    ap.add_argument("--schema", default=str(DEFAULT_SCHEMA))
    args = ap.parse_args()

    data_path = Path(args.data)
    schema_path = Path(args.schema)

    data = load_yaml(data_path)
    schema = load_json(schema_path)

    # 1) JSON Schema validation
    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        print("Schema validation failed:", file=sys.stderr)
        print(f"- {e.message}", file=sys.stderr)
        if e.path:
            print(f"  at path: {'/'.join(map(str, e.path))}", file=sys.stderr)
        return 1

    papers: List[Dict[str, Any]] = data["papers"]

    # 2) Dataset integrity checks
    errors: List[str] = []
    errors += validate_unique_ids(papers)
    errors += validate_relations_exist(papers)
    errors += validate_arxiv_links(papers)

    if errors:
        print("Dataset validation failed:", file=sys.stderr)
        for err in errors:
            print(f"- {err}", file=sys.stderr)
        return 1

    print("OK: dataset validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
