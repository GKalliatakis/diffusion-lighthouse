#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import yaml


# ---- Config (tweak as desired) ----

REQUIRED_FIELDS = [
    "id",
    "title",
    "year",
    "authors",
    "venue",
    "impact_type",
    "tags",
    "why_it_matters",
]

# What counts as "peer-reviewed canonical link"
PEER_REVIEWED_LINK_KEYS = ["doi", "journal", "proceedings", "publisher", "official", "url", "pdf"]


# If publication_status is missing, we infer it (same logic as your builder patch)
def infer_publication_status(p: Dict[str, Any]) -> str:
    ps = str(p.get("publication_status", "")).strip()
    if ps:
        return ps
    venue = str(p.get("venue", "")).strip().lower()
    if venue == "arxiv":
        return "canonical_preprint"
    if venue:
        return "accepted"
    return "unknown"


def is_nonempty_str(x: Any) -> bool:
    return isinstance(x, str) and x.strip() != ""


def as_list(x: Any) -> List[Any]:
    if x is None:
        return []
    if isinstance(x, list):
        return x
    return [x]


def get_links(p: Dict[str, Any]) -> Dict[str, Any]:
    links = p.get("links")
    return links if isinstance(links, dict) else {}


def has_any_link_key(p: Dict[str, Any], keys: List[str]) -> bool:
    links = get_links(p)
    for k in keys:
        v = links.get(k)
        if is_nonempty_str(v):
            return True
    return False


def looks_like_arxiv_url(u: str) -> bool:
    s = u.lower()
    return "arxiv.org" in s


def canonical_peer_reviewed_link_ok(p: Dict[str, Any]) -> Tuple[bool, str]:
    """
    For peer-reviewed papers, canonical links must exist and must not be arXiv.
    Specifically: at least one of PEER_REVIEWED_LINK_KEYS exists with a non-arXiv URL.
    """
    links = get_links(p)
    for k in PEER_REVIEWED_LINK_KEYS:
        v = links.get(k)
        if not is_nonempty_str(v):
            continue
        if looks_like_arxiv_url(v):
            continue
        return True, f"ok ({k})"
    return False, "missing peer-reviewed canonical link (non-arXiv)"


def canonical_preprint_requirements_ok(p: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Canonical preprint entries are allowed, but must be clearly justified and usable.
    Require:
      - editorial_note (non-empty)
      - scholar.scholar_url OR top-level scholar_url (non-empty)
      - at least one arXiv link (arxiv or pdf) is present
    """
    if not is_nonempty_str(p.get("editorial_note")):
        return False, "canonical_preprint requires editorial_note"

    scholar = p.get("scholar")
    scholar_url = ""
    if isinstance(scholar, dict):
        scholar_url = str(scholar.get("scholar_url") or "").strip()
    if not scholar_url:
        scholar_url = str(p.get("scholar_url") or "").strip()

    if not scholar_url:
        return False, "canonical_preprint requires scholar.scholar_url (or scholar_url)"

    links = get_links(p)
    arxiv_like = False
    for k in ["arxiv", "pdf", "url"]:
        v = links.get(k)
        if is_nonempty_str(v) and looks_like_arxiv_url(v):
            arxiv_like = True
            break
    if not arxiv_like:
        return False, "canonical_preprint should include an arXiv link (links.arxiv or links.pdf)"

    return True, "ok"


def validate_paper(p: Dict[str, Any], ids_seen: set) -> List[str]:
    errs: List[str] = []

    # Required fields
    for f in REQUIRED_FIELDS:
        if f not in p:
            errs.append(f"missing required field: {f}")

    # id unique + non-empty
    pid = p.get("id")
    if not is_nonempty_str(pid):
        errs.append("id must be a non-empty string")
    else:
        if pid in ids_seen:
            errs.append(f"duplicate id: {pid}")
        ids_seen.add(pid)

    # year int-ish
    year = p.get("year")
    if year is None:
        errs.append("year missing")
    else:
        try:
            y = int(year)
            if y < 1950 or y > 2100:
                errs.append(f"year out of range: {y}")
        except Exception:
            errs.append(f"year must be an integer (got {year!r})")

    # authors list
    authors = p.get("authors")
    if not isinstance(authors, list) or not authors or not all(is_nonempty_str(a) for a in authors):
        errs.append("authors must be a non-empty list of strings")

    # tags list
    tags = p.get("tags")
    if not isinstance(tags, list) or not tags or not all(is_nonempty_str(t) for t in tags):
        errs.append("tags must be a non-empty list of strings")

    # why_it_matters non-empty
    if not is_nonempty_str(str(p.get("why_it_matters") or "").strip()):
        errs.append("why_it_matters must be non-empty")

    # Publication status logic
    ps = infer_publication_status(p)

    # If peer-reviewed (accepted/published), require non-arXiv canonical link
    if ps in ["accepted", "published", "peer_reviewed"]:
        ok, msg = canonical_peer_reviewed_link_ok(p)
        if not ok:
            errs.append(msg)

    # If canonical preprint, require editorial note + scholar URL + arXiv link
    if ps in ["canonical_preprint"]:
        ok, msg = canonical_preprint_requirements_ok(p)
        if not ok:
            errs.append(msg)

    # Optional: if venue is arXiv but status not canonical_preprint, nudge
    venue = str(p.get("venue") or "").strip().lower()
    if venue == "arxiv" and ps != "canonical_preprint":
        errs.append('venue is "arXiv" but publication_status is not canonical_preprint')

    return errs


def main() -> int:
    # Default path matches your repo layout (scripts/validate_papers.py)
    papers_path = Path(__file__).resolve().parent.parent / "data" / "papers.yaml"
    if len(sys.argv) > 1:
        papers_path = Path(sys.argv[1])

    if not papers_path.exists():
        print(f"[validate] ERROR: file not found: {papers_path}", file=sys.stderr)
        return 2

    with papers_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    papers = data.get("papers")
    if not isinstance(papers, list):
        print("[validate] ERROR: papers.yaml must contain a top-level 'papers: [ ... ]' list", file=sys.stderr)
        return 2

    ids_seen: set = set()
    all_errors: List[Tuple[str, List[str]]] = []

    for i, p in enumerate(papers):
        if not isinstance(p, dict):
            all_errors.append((f"(index {i})", ["paper entry must be a mapping/object"]))
            continue

        pid = str(p.get("id") or f"(index {i})")
        errs = validate_paper(p, ids_seen)
        if errs:
            all_errors.append((pid, errs))

    if all_errors:
        print(f"[validate] FAILED: {len(all_errors)} paper(s) have issues:\n", file=sys.stderr)
        for pid, errs in all_errors:
            print(f" - {pid}:", file=sys.stderr)
            for e in errs:
                print(f"    • {e}", file=sys.stderr)
        print("\n[validate] Fix papers.yaml and re-run.", file=sys.stderr)
        return 1

    print(f"[validate] OK: {len(papers)} papers validated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
