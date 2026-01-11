#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Set, Optional
from urllib.parse import urlparse

import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA = ROOT / "data" / "papers.yaml"
DEFAULT_SCHEMA = ROOT / "data" / "schema.json"

try:
    import jsonschema
except ImportError:
    print("Missing dependency: jsonschema. Install with: pip install jsonschema", file=sys.stderr)
    sys.exit(2)


# -------------------------
# IO
# -------------------------

def load_yaml(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_json(path: Path) -> Dict[str, Any]:
    import json
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


# -------------------------
# Helpers
# -------------------------

def is_url(s: Any) -> bool:
    if not isinstance(s, str) or not s.strip():
        return False
    try:
        u = urlparse(s)
        return u.scheme in {"http", "https"} and bool(u.netloc)
    except Exception:
        return False


def is_canonical_preprint(p: Dict[str, Any]) -> bool:
    return str(p.get("publication_status", "")).strip().lower() == "canonical_preprint"


def resolve_relation_target(rel: Any) -> Optional[str]:
    # Supports the dataset + app.js conventions:
    # target_id | paper_id | target | id | paper
    if not isinstance(rel, dict):
        return None
    for k in ("target_id", "paper_id", "target", "id", "paper"):
        v = rel.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


# -------------------------
# Integrity checks
# -------------------------

def validate_unique_ids(papers: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    seen: Set[str] = set()
    for p in papers:
        pid = p.get("id")
        if pid in seen:
            errors.append(f"Duplicate id: {pid}")
        seen.add(pid)
    return errors


def validate_relations_exist(papers: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    ids: Set[str] = {p["id"] for p in papers}

    for p in papers:
        rels = p.get("relations", []) or []
        for rel in rels:
            tgt = resolve_relation_target(rel)
            if not tgt:
                errors.append(f"{p['id']}: relation missing target (expected target_id/paper_id/target)")
                continue
            if tgt not in ids:
                errors.append(f"{p['id']}: relation target '{tgt}' does not exist")
            if tgt == p["id"]:
                errors.append(f"{p['id']}: relation target cannot be self")
    return errors


def validate_links(papers: List[Dict[str, Any]]) -> List[str]:
    """Peer-reviewed-first rules (matches the site logic).

    - If publication_status == canonical_preprint:
        * require links.arxiv to be https://arxiv.org/abs/...
        * require links.pdf to be https://arxiv.org/pdf/... .pdf

    - Otherwise:
        * do NOT require arXiv links
        * require at least one canonical (non-arXiv) URL among:
            doi, journal, proceedings, publisher, official, url, pdf
        * if links.pdf is provided, it must NOT be an arXiv PDF URL
    """
    errors: List[str] = []

    canonical_keys = ["doi", "journal", "proceedings", "publisher", "official", "url", "pdf"]

    for p in papers:
        links = p.get("links", {}) or {}

        arxiv = links.get("arxiv")
        pdf = links.get("pdf")

        if is_canonical_preprint(p):
            if not (isinstance(arxiv, str) and arxiv.startswith("https://arxiv.org/abs/")):
                errors.append(
                    f"{p['id']}: canonical_preprint requires links.arxiv starting with 'https://arxiv.org/abs/'"
                )
            if not (isinstance(pdf, str) and pdf.startswith("https://arxiv.org/pdf/") and pdf.endswith(".pdf")):
                errors.append(f"{p['id']}: canonical_preprint requires links.pdf as an arXiv PDF URL ending in .pdf")
            continue

        # Non-preprint: require some canonical peer-reviewed link (non-arXiv)
        found_canonical = False
        for k in canonical_keys:
            v = links.get(k)
            if not is_url(v):
                continue
            if isinstance(v, str) and "arxiv.org" in v:
                continue
            found_canonical = True
            break

        if not found_canonical:
            errors.append(
                f"{p['id']}: missing canonical peer-reviewed link (add one of: doi/journal/proceedings/publisher/official/url/pdf)"
            )

        # If pdf exists, make sure it's not an arXiv PDF for non-preprints
        if isinstance(pdf, str) and pdf.strip():
            if "arxiv.org/pdf/" in pdf:
                errors.append(f"{p['id']}: links.pdf must NOT be an arXiv PDF for peer-reviewed entries")
            elif not is_url(pdf):
                errors.append(f"{p['id']}: links.pdf must be a valid URL")

        # If arxiv exists, it can be kept as provenance, but validate format if provided
        if isinstance(arxiv, str) and arxiv.strip():
            if not arxiv.startswith("https://arxiv.org/abs/"):
                errors.append(f"{p['id']}: links.arxiv must start with 'https://arxiv.org/abs/' (if provided)")

    return errors


# -------------------------
# Main
# -------------------------

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
    errors += validate_links(papers)

    if errors:
        print("Dataset validation failed:", file=sys.stderr)
        for err in errors:
            print(f"- {err}", file=sys.stderr)
        return 1

    print("OK: dataset validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
