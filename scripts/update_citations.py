# scripts/update_citations.py (Python 3.6)
import os
import re
import time
import random
from typing import Dict, Optional, Tuple

import requests
from bs4 import BeautifulSoup
import yaml

from scripts.utils import read_json, write_json, append_jsonl, now_utc_iso, sleep_backoff

ROOT = os.path.dirname(os.path.dirname(__file__))
PAPERS_YAML = os.path.join(ROOT, "data", "papers.yaml")
CITATIONS_JSON = os.path.join(ROOT, "data", "citations.json")
HISTORY_JSONL = os.path.join(ROOT, "data", "citations.history.jsonl")

SCHOLAR_BASE = "https://scholar.google.com/scholar"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

# Delay between papers (seconds)
MIN_DELAY = int(os.environ.get("MIN_DELAY", "20"))
MAX_DELAY = int(os.environ.get("MAX_DELAY", "35"))

# Semantic Scholar endpoints (no key required for light usage)
S2_PAPER = "https://api.semanticscholar.org/graph/v1/paper/{paper_id}"
S2_FIELDS = "title,citationCount,url,year,venue"
S2_SEARCH = "https://api.semanticscholar.org/graph/v1/paper/search"
S2_SEARCH_FIELDS = "paperId,title,year,venue,citationCount,url"


class ScholarBlocked(Exception):
    pass


def choose_delay():
    lo = MIN_DELAY
    hi = MAX_DELAY
    if hi < lo:
        hi = lo
    return random.randint(lo, hi)


def fetch_html(url, params=None, timeout=20):
    # type: (str, Optional[Dict[str, str]], int) -> str
    headers = {"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}
    r = requests.get(url, params=params, headers=headers, timeout=timeout)
    text = r.text or ""
    low = text.lower()
    if "captcha" in low or "unusual traffic" in low:
        raise ScholarBlocked("Google Scholar appears to be blocking requests (captcha/unusual traffic).")
    if r.status_code >= 400:
        raise RuntimeError("HTTP {0}".format(r.status_code))
    return text


def fetch_semantic_scholar_by_title(title):
    # type: (str) -> Optional[Tuple[int, str]]
    if not title:
        return None
    headers = {"User-Agent": UA}
    r = requests.get(
        S2_SEARCH,
        params={"query": title, "limit": 5, "fields": S2_SEARCH_FIELDS},
        headers=headers,
        timeout=20,
    )
    if r.status_code == 429:
        raise RuntimeError("Semantic Scholar HTTP 429")
    if r.status_code >= 400:
        raise RuntimeError("Semantic Scholar HTTP {0}".format(r.status_code))

    js = r.json() or {}
    data = js.get("data") or []
    if not data:
        return None

    # pick the top result (usually fine for exact titles)
    best = data[0]
    cc = best.get("citationCount")
    url = best.get("url") or ""
    if isinstance(cc, int):
        return (cc, url)
    return None



def parse_cited_by_anywhere(html):
    # type: (str) -> Optional[int]
    m = re.search(r"\bCited by\s+(\d+)\b", html)
    if m:
        return int(m.group(1))
    return None


def parse_first_result(html):
    # type: (str) -> Optional[Tuple[int, str]]
    soup = BeautifulSoup(html, "lxml")
    first = soup.select_one("div.gs_r")
    if not first:
        return None

    block_text = first.get_text(" ", strip=True)
    m = re.search(r"\bCited by\s+(\d+)\b", block_text)
    citations = int(m.group(1)) if m else None

    # Prefer a Scholar cites/cluster link if present
    scholar_url = ""
    for a in first.select("a"):
        href = a.get("href") or ""
        txt = a.get_text(" ", strip=True).lower()
        if ("cites=" in href or "cluster=" in href) and ("scholar.google" in href or href.startswith("/")):
            if href.startswith("/"):
                scholar_url = "https://scholar.google.com" + href
            else:
                scholar_url = href
            break
        if txt.startswith("cited by") and href:
            if href.startswith("/"):
                scholar_url = "https://scholar.google.com" + href
            else:
                scholar_url = href
            break

    if citations is None:
        return None

    return (citations, scholar_url)


def update_one_by_query(query):
    html = fetch_html(SCHOLAR_BASE, params={"q": query}, timeout=20)
    return parse_first_result(html)


def update_one_by_url(scholar_url):
    # Fetch cluster/cites URL directly and parse "Cited by N" anywhere in HTML
    html = fetch_html(scholar_url, params=None, timeout=20)
    citations = parse_cited_by_anywhere(html)
    if citations is None:
        # Some pages might be weird; fallback to first-result parser
        r = parse_first_result(html)
        if r is None:
            return None
        citations, found_url = r
        return (citations, found_url or scholar_url)
    return (citations, scholar_url)


def arxiv_id_from_url(arxiv_url):
    # type: (str) -> Optional[str]
    if not arxiv_url:
        return None
    # handles: https://arxiv.org/abs/2006.11239 or .../abs/2006.11239v2
    m = re.search(r"arxiv\.org/(abs|pdf)/([0-9]{4}\.[0-9]{4,5})(v\d+)?", arxiv_url)
    if not m:
        return None
    return m.group(2)


def doi_from_url(doi_url):
    # type: (str) -> Optional[str]
    if not doi_url:
        return None
    # allow raw DOI or doi.org link
    if doi_url.startswith("10."):
        return doi_url
    m = re.search(r"doi\.org/(10\.\d{4,9}/\S+)", doi_url)
    return m.group(1) if m else None


def fetch_semantic_scholar_citations(paper):
    # type: (dict) -> Optional[Tuple[int, str]]
    """
    Returns (citationCount, semantic_scholar_url) or None.
    Prefer ARXIV id, then DOI, then title search.
    """
    links = paper.get("links", {}) or {}
    arxiv = links.get("arxiv", "")
    doi = links.get("doi", "")

    aid = arxiv_id_from_url(arxiv)
    if aid:
        paper_id = "ARXIV:{0}".format(aid)
    else:
        d = doi_from_url(doi)
        paper_id = "DOI:{0}".format(d) if d else None

    headers = {"User-Agent": UA}

    # 1) Try ARXIV/DOI lookup if we have it
    if paper_id:
        url = S2_PAPER.format(paper_id=paper_id)
        r = requests.get(url, params={"fields": S2_FIELDS}, headers=headers, timeout=20)
        if r.status_code == 429:
            raise RuntimeError("Semantic Scholar HTTP 429")
        if r.status_code != 404 and r.status_code >= 400:
            raise RuntimeError("Semantic Scholar HTTP {0}".format(r.status_code))
        if r.status_code != 404:
            js = r.json()
            cc = js.get("citationCount", None)
            if isinstance(cc, int):
                return (cc, js.get("url") or "")

    # 2) Title-search fallback (handles missing ARXIV ids)
    title = paper.get("title", "")
    return fetch_semantic_scholar_by_title(title)


def main():
    with open(PAPERS_YAML, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}

    store = read_json(CITATIONS_JSON, default={"meta": {}, "papers": {}})
    store.setdefault("meta", {})
    store.setdefault("papers", {})

    run_ts = now_utc_iso()
    papers = cfg.get("papers", []) or []
    if not papers:
        print("No papers in data/papers.yaml")
        return

    start = int(os.environ.get("START", "1"))
    end = int(os.environ.get("END", str(len(papers))))

    print("Running update for papers [{0}..{1}] out of {2}".format(start, end, len(papers)))
    print("Delay between papers: {0}-{1}s".format(MIN_DELAY, MAX_DELAY))

    for idx, p in enumerate(papers, start=1):
        if idx < start or idx > end:
            continue

        pid = p.get("id")
        if not pid:
            continue

        scholar = p.get("scholar", {}) or {}
        scholar_url = scholar.get("scholar_url")
        query = scholar.get("scholar_query")

        if not scholar_url and not query:
            print("[{0}/{1}] {2}: missing scholar_url or scholar_query (skipping)".format(idx, len(papers), pid))
            continue

        old = store["papers"].get(pid, {}) or {}
        old_citations = old.get("citations")

        print("[{0}/{1}] Updating {2} ...".format(idx, len(papers), pid))

        citations = None
        resolved_url = ""
        source_used = ""

        # ---- Try Google Scholar first ----
        blocked = False
        for attempt in range(3):
            try:
                r = None
                if scholar_url:
                    r = update_one_by_url(scholar_url)
                else:
                    r = update_one_by_query(query)

                if r is not None:
                    citations, resolved_url = r
                    source_used = "google_scholar"
                break
            except ScholarBlocked as e:
                blocked = True
                print("  Scholar blocked: {0}".format(e))
                break
            except Exception as e:
                print("  Scholar attempt {0} failed: {1}".format(attempt + 1, e))
                sleep_backoff(attempt)

        # ---- Fallback to Semantic Scholar ----
        if citations is None:
            try:
                fr = fetch_semantic_scholar_citations(p)
                if fr is None:
                    fr = fetch_semantic_scholar_by_title(p)
                if fr is not None:
                    citations, resolved_url = fr
                    source_used = "semantic_scholar"
                    print("  Fallback used: Semantic Scholar")
                else:
                    print("  Fallback failed: Semantic Scholar had no match (arXiv/DOI/title).")
            except Exception as e:
                print("  Fallback error: {0}".format(e))

        # If still none, skip update for this paper
        if citations is None:
            if blocked:
                # If Scholar is blocked, don't hammer further; stop run
                print("Stopping update to avoid further blocks. (Fallback may still work next run.)")
                break
            print("  No citation info found; keeping old value.")
            continue

        store["papers"].setdefault(pid, {})
        store["papers"][pid].update(
            {
                "citations": citations,
                "last_checked_utc": run_ts,
                # scholar_url is ONLY for Google Scholar URLs (cluster/cites)
                "scholar_url": scholar_url or (resolved_url if source_used == "google_scholar" else "") or "",
                # keep resolved_url for debugging
                "resolved_url": resolved_url or "",
                # store semantic scholar URL explicitly
                "semantic_scholar_url": resolved_url if source_used == "semantic_scholar" else "",
                "source_used": source_used,
            }
        )

        if old_citations != citations:
            append_jsonl(
                HISTORY_JSONL,
                {
                    "paper_id": pid,
                    "timestamp_utc": run_ts,
                    "citations": citations,
                    "previous": old_citations,
                    "source_used": source_used,
                },
            )

        d = choose_delay()
        print("  Sleeping {0}s...".format(d))
        time.sleep(d)

    store["meta"].update(
        {
            "last_updated_utc": run_ts,
            "source": "google_scholar + semantic_scholar_fallback",
            "notes": "Citations are best-effort snapshots. Scholar may block; Semantic Scholar may differ due to indexing.",
        }
    )

    write_json(CITATIONS_JSON, store)

    # Render README safely as module
    # os.system("python -m scripts.render_readme")

    print("Done.")


if __name__ == "__main__":
    main()
