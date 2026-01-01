#!/usr/bin/env python3
"""
Diffusion Lighthouse — doctor.py
Quick sanity checks to catch the most common "why doesn't the site update" issues.

Usage:
  python scripts/doctor.py
  python scripts/doctor.py --strict
"""

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

try:
    import yaml
except Exception:
    yaml = None  # handled below


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PATHS = {
    "papers_yaml": os.path.join(ROOT, "data", "papers.yaml"),
    "citations_json": os.path.join(ROOT, "data", "citations.json"),
    "papers_json": os.path.join(ROOT, "site", "public", "data", "papers.json"),
    "index_html": os.path.join(ROOT, "site", "index.html"),
    "app_js": os.path.join(ROOT, "site", "app.js"),
    "readme": os.path.join(ROOT, "README.md"),
    "maintenance": os.path.join(ROOT, "MAINTENANCE.md"),
}

README_MARKERS = (
    "<!-- DIFFUSION_LIGHTHOUSE_TABLE_START -->",
    "<!-- DIFFUSION_LIGHTHOUSE_TABLE_END -->",
)

ROUTES_EXPECTED = ("/about", "/editorial-policy")


def _exists(path: str) -> bool:
    return os.path.exists(path)


def _mtime(path: str) -> Optional[float]:
    if not _exists(path):
        return None
    return os.path.getmtime(path)


def _fmt_time(ts: Optional[float]) -> str:
    if ts is None:
        return "missing"
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _read_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _read_yaml(path: str) -> Any:
    if yaml is None:
        raise RuntimeError("PyYAML not installed. Run: pip install pyyaml")
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def warn(msg: str) -> None:
    print(f"⚠️  {msg}")


def ok(msg: str) -> None:
    print(f"✅ {msg}")


def fail(msg: str) -> None:
    print(f"❌ {msg}")


def die(msg: str, code: int = 1) -> None:
    fail(msg)
    sys.exit(code)


def check_files(strict: bool) -> int:
    issues = 0
    for k, p in PATHS.items():
        if _exists(p):
            ok(f"{k}: {p}")
        else:
            issues += 1
            warn(f"{k} missing: {p}")

    if strict and issues:
        die("Missing required files/paths. Fix the warnings above.", 2)
    return issues


def check_readme_markers(strict: bool) -> int:
    if not _exists(PATHS["readme"]):
        warn("README.md missing (skipping marker check).")
        return 1

    txt = _read_text(PATHS["readme"])
    missing = [m for m in README_MARKERS if m not in txt]

    if missing:
        warn(
            "README.md is missing render markers used by scripts/render_readme.py:\n"
            + "\n".join(f"  - {m}" for m in missing)
        )
        warn("If you intentionally removed the auto-table, update render_readme.py to not require markers.")
        return 1 if not strict else die("README marker check failed in strict mode.", 3)  # type: ignore

    ok("README.md contains both render markers.")
    return 0


def check_index_hooks(strict: bool) -> int:
    issues = 0

    if _exists(PATHS["index_html"]):
        html = _read_text(PATHS["index_html"])
        if 'id="indexIntro"' in html:
            ok("index.html: found #indexIntro (explainer host).")
        else:
            issues += 1
            warn('index.html: missing element with id="indexIntro" (explainer won’t render as intended).')
    else:
        issues += 1
        warn("index.html missing (skipping #indexIntro check).")

    if _exists(PATHS["app_js"]):
        js = _read_text(PATHS["app_js"])
        # lightweight checks — not brittle parsing
        if "joinBase(" in js and "computeBasePrefix" in js:
            ok("app.js: base-path aware routing helpers present.")
        else:
            issues += 1
            warn("app.js: base-path helpers not found (Pages subpath routing might break).")

        if "renderIndexIntroOnce" in js or "renderIndexExplainerOnce" in js or "renderIndexExplainer" in js:
            ok("app.js: index explainer rendering present.")
        else:
            issues += 1
            warn("app.js: index explainer rendering not found.")
    else:
        issues += 1
        warn("app.js missing (skipping JS checks).")

    if strict and issues:
        die("Index/app wiring checks failed in strict mode.", 4)
    return issues


def check_yaml_integrity(strict: bool) -> int:
    issues = 0
    if not _exists(PATHS["papers_yaml"]):
        warn("papers.yaml missing (skipping YAML checks).")
        return 1

    cfg = _read_yaml(PATHS["papers_yaml"]) or {}
    papers = cfg.get("papers") or []
    if not isinstance(papers, list) or not papers:
        return die("data/papers.yaml: expected non-empty top-level 'papers:' list.", 5)  # type: ignore

    ok(f"papers.yaml: loaded {len(papers)} paper(s).")

    ids: Set[str] = set()
    for i, p in enumerate(papers, start=1):
        if not isinstance(p, dict):
            issues += 1
            warn(f"papers.yaml: entry #{i} is not a mapping/dict.")
            continue

        pid = str(p.get("id") or "").strip()
        if not pid:
            issues += 1
            warn(f"papers.yaml: entry #{i} missing id.")
            continue
        if pid in ids:
            issues += 1
            warn(f"papers.yaml: duplicate id: {pid}")
        ids.add(pid)

        # minimal required fields
        for field in ("title", "year", "venue", "publication_status"):
            if p.get(field) in (None, "", []):
                issues += 1
                warn(f"{pid}: missing {field}")

        # canonical_preprint requires Scholar URL (your validator)
        pub = str(p.get("publication_status") or "").lower()
        if pub == "canonical_preprint":
            scholar = p.get("scholar") or {}
            scholar_url = (scholar.get("scholar_url") or p.get("scholar_url") or "").strip()
            if not scholar_url:
                issues += 1
                warn(f"{pid}: canonical_preprint requires scholar.scholar_url (or scholar_url).")

        # relations target existence check (best-effort)
        rels = p.get("relations")
        if isinstance(rels, list):
            for r in rels:
                if isinstance(r, dict):
                    tgt = r.get("target") or r.get("target_id") or r.get("paper_id")
                    if tgt and str(tgt) not in ids:
                        # might refer forward; check after full pass
                        pass

    # second pass for relation targets (now ids contains all)
    for p in papers:
        pid = str(p.get("id") or "").strip()
        rels = p.get("relations")
        if not pid or not isinstance(rels, list):
            continue
        for r in rels:
            if not isinstance(r, dict):
                continue
            tgt = r.get("target") or r.get("target_id") or r.get("paper_id")
            if tgt and str(tgt) not in ids:
                issues += 1
                warn(f"{pid}: relation target not found in dataset: {tgt}")

    if strict and issues:
        die("YAML integrity checks failed in strict mode.", 6)
    return issues


def check_build_freshness(strict: bool) -> int:
    """
    Catch the classic issue: you edited YAML but didn't rebuild site/public/data/papers.json
    """
    issues = 0
    y = _mtime(PATHS["papers_yaml"])
    pj = _mtime(PATHS["papers_json"])

    if y is None:
        warn("papers.yaml missing; cannot check build freshness.")
        return 1

    if pj is None:
        issues += 1
        warn("site/public/data/papers.json missing. Run your build step (e.g. build_dataset.py).")
        if strict:
            die("Missing build artifact in strict mode.", 7)
        return issues

    if pj < y:
        issues += 1
        warn(
            "papers.json looks stale (older than papers.yaml).\n"
            f"  papers.yaml mtime: {_fmt_time(y)}\n"
            f"  papers.json mtime:  {_fmt_time(pj)}\n"
            "Run: python scripts/build_dataset.py (or your build command) to regenerate papers.json."
        )
        if strict:
            die("Stale build artifact in strict mode.", 8)
    else:
        ok("papers.json is newer than papers.yaml (build artifact looks fresh).")

    return issues


def check_citations_visibility(strict: bool) -> int:
    """
    Check that papers.json actually contains citations.count for most papers,
    and that the citations_meta exists (optional).
    """
    issues = 0

    if not _exists(PATHS["papers_json"]):
        warn("papers.json missing (skipping citations visibility checks).")
        return 1

    data = _read_json(PATHS["papers_json"]) or {}
    papers = data.get("papers") or []
    if not isinstance(papers, list) or not papers:
        warn("papers.json has no 'papers' list (unexpected shape).")
        return 1

    missing = []
    for p in papers:
        c = (p.get("citations") or {})
        if not (c.get("count") or 0):
            missing.append(p.get("id"))

    if missing:
        warn(f"papers.json: {len(missing)} paper(s) missing citations.count: {missing}")
        warn("This can be OK if Scholar/S2 blocked or a paper has no match yet.")
    else:
        ok("papers.json: all papers have citations.count.")

    meta = data.get("citations_meta")
    if meta:
        ok("papers.json: citations_meta present.")
    else:
        warn("papers.json: citations_meta missing (not fatal, but citeMeta line will be blank).")

    # strict mode: only fail if *most* citations missing
    if strict and len(missing) > max(1, len(papers) // 2):
        die("Too many missing citations in strict mode.", 9)

    return issues


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="Exit non-zero on warnings that usually matter.")
    args = ap.parse_args()

    strict = bool(args.strict)

    print("🩺 Diffusion Lighthouse doctor\n")
    issues = 0

    issues += check_files(strict=False)  # don't hard-fail immediately; we do strict gating per section
    issues += check_readme_markers(strict=strict)
    issues += check_index_hooks(strict=strict)
    issues += check_yaml_integrity(strict=strict)
    issues += check_build_freshness(strict=strict)
    issues += check_citations_visibility(strict=strict)

    print("\n---")
    if issues == 0:
        ok("All checks passed.")
        return 0

    if strict:
        die(f"Doctor found {issues} issue(s) in strict mode.", 10)

    warn(f"Doctor found {issues} issue(s). Fix the warnings above when relevant.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
