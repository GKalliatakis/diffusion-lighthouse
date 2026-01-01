# 🛠 Diffusion Lighthouse — Maintenance Manual

This document describes the **exact, repeatable steps** required to update the
Diffusion Lighthouse website safely and correctly.

> **Key principle**
> `data/papers.yaml` is the source of truth.
> The website never reads YAML directly — it only consumes the built JSON.

---

## 🔁 Overview: what triggers what?

| You change… | You must run… |
|------------|---------------|
| Paper metadata (titles, venues, relations, tags, notes) | `build_dataset.py` |
| Citation counts | `update_citations.py` → `build_dataset.py` |
| UI / wording / behavior | edit files in `site/` only |
| README framing | edit README only (no build needed) |

---

## ✅ Canonical update sequence (always follow this order)

### 1️⃣ Edit paper metadata (source of truth)

File:
```bash
data/papers.yaml
```

Typical edits:
- add or remove papers
- edit titles, venues, years
- update relations
- adjust tags, dataset focus, concept tags
- add editorial notes
- fix canonical links (PDF / proceedings / DOI)

⚠️ At this stage, the website will **not** change yet.

---

### 2️⃣ (Optional) Update citation snapshots

Run only if:
- you added new papers
- or you want refreshed citation counts

```bash
python scripts/update_citations.py
```

What this does:
- queries Google Scholar (best effort)
- falls back to Semantic Scholar
- writes results to:
  ```bash
  data/citations.json
  ```

Notes:
- Scholar may block requests (captcha / HTTP 429)
- Missing citation counts are allowed
- Citation updates never affect inclusion

If this step fails → **skip it and continue**.

---

### 3️⃣ Build the website dataset (**required**)

This step is mandatory after *any* YAML change.

```bash
python scripts/build_dataset.py
```

What this does:
- merges:
  - `data/papers.yaml`
  - `data/citations.json`
- outputs:
  ```bash
  site/public/data/papers.json
  ```

📌 If you skip this step, the site will show **stale data**.

This is the most common cause of:
- changes not appearing
- citations missing
- links not updating

---

### 4️⃣ Sanity-check the build (recommended)

Quick checks:

```bash
ls site/public/data/papers.json
```

Paper count:
```bash
python - <<'PY'
import json
d=json.load(open("site/public/data/papers.json"))
print("papers:", len(d["papers"]))
PY
```

Missing citations (allowed):
```bash
python - <<'PY'
import json
d=json.load(open("site/public/data/papers.json"))
missing=[p["id"] for p in d["papers"] if not (p.get("citations",{}) or {}).get("count")]
print("missing citations:", missing)
PY
```

---

### 5️⃣ View the site locally

```bash
cd site
python -m http.server
```

Open:
```
http://localhost:8000
```

Hard refresh if needed:
- macOS: `Cmd + Shift + R`
- Linux / Windows: `Ctrl + Shift + R`

---

### 6️⃣ Commit and push

Files commonly committed together:
```bash
data/papers.yaml
data/citations.json        # if updated
site/public/data/papers.json
```

UI-only changes:
```bash
site/index.html
site/app.js
site/style.css
```

---

### Quick sanity check
```bash
python scripts/doctor.py


## 🧠 Mental model (important)

- YAML → editorial intent
- citations.json → context
- papers.json → what the site actually renders
- README → framing, not data

If something looks wrong on the site:
1. Inspect `site/public/data/papers.json`
2. Ignore YAML until JSON looks correct

---

## 🚫 Common mistakes to avoid

- Editing YAML without rebuilding the dataset
- Expecting README edits to affect the website
- Treating missing citations as errors
- Editing `papers.json` directly (it is a build artifact)

---

## 🧭 When to stop “fixing”

Stop iterating if:
- the site loads correctly
- papers render and open
- relations work
- links resolve

Citation completeness is **explicitly not a goal**.

---

## ✅ TL;DR checklist

Every update:

```text
1. Edit data/papers.yaml
2. (Optional) python scripts/update_citations.py
3. python scripts/build_dataset.py   ← required
4. Refresh site
5. Commit & push
```

---

Diffusion Lighthouse is intentionally **curated, explicit, and editorial**.
This manual exists so future updates remain boring, safe, and repeatable.
