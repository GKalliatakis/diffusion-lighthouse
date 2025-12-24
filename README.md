# 🌊 Diffusion Lighthouse

**Diffusion Lighthouse** is a living, citation-guided index of the most influential research papers on **Diffusion Models**.

It helps researchers, students, and practitioners navigate a fast-growing literature by highlighting **impactful work**, using **Google Scholar citation counts** combined with careful human curation.

> Like a lighthouse, this project does not chart every wave —  
> it helps you orient toward the most important signals.

---

## ✨ What this project does

- 📚 Curates **major diffusion-model papers** (foundations, methods, scaling, applications)
- 📊 Tracks **Google Scholar citation counts** (best-effort snapshots)
- 🔁 Updates continuously (manual or scheduled)
- 🧭 Organizes work by **research themes**
- 🌐 Provides both:
  - a **GitHub-readable table**, and
  - a **searchable website** (GitHub Pages)

---

## 🌐 Website

Browse, search, sort, and filter the paper list here:

👉 **https://\<your-username\>.github.io/diffusion-lighthouse/**

The website is automatically synced with the repository data.

---

## 📌 Citation counts

- Citation numbers come from **Google Scholar**
- They are:
  - not real-time  
  - subject to fluctuation  
  - sometimes merged across multiple versions of the same paper
- Each update stores a **timestamped snapshot**, not a canonical truth

This project prioritizes **transparency and reproducibility** over scraping perfection.

---

## 🗂️ Repository structure

- `data/papers.yaml`  
  Curated *source of truth* (paper metadata, links, tags)

- `data/citations.json`  
  Automatically updated citation snapshots

- `scripts/`  
  Citation updater and README generator

- `site/`  
  Static website (GitHub Pages)

The paper list is **human-curated**.  
Citation counts are **machine-updated**.

---

## 🤝 Contributing

Contributions are welcome.

You can help by:
- adding missing **major papers**
- improving **tags or categorization**
- fixing metadata (venue, year, links)
- reporting citation mismatches

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for details.

> The goal is **signal over exhaustiveness** —  
> not every diffusion paper, but the *important* ones.

---

## ⚠️ Disclaimer

- This repository does **not** claim authority over what *should* matter
- Citations are an imperfect proxy for impact
- Inclusion ≠ endorsement

**Diffusion Lighthouse** is a navigation aid — not a gatekeeper.

---

## 📜 License

MIT License.

---

## 🧠 How to update citations locally

```bash
pip install -r requirements.txt
python scripts/update_citations.py
