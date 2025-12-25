
<p align="center">
  <img src="assets/diffusion-lighthouse-logo.png" alt="Diffusion Lighthouse logo" width="420">
</p>

<h1 align="center">🌊 Diffusion Lighthouse</h1>

<p align="center">
  A citation-guided index of influential diffusion-model research.
</p>

<p align="center">
  <a href="https://github.com/GKalliatakis/diffusion-lighthouse">
    <img src="https://img.shields.io/github/stars/GKalliatakis/diffusion-lighthouse?style=flat-square" alt="GitHub stars">
  </a>
  <a href="https://github.com/GKalliatakis/diffusion-lighthouse/issues">
    <img src="https://img.shields.io/github/issues/GKalliatakis/diffusion-lighthouse?style=flat-square" alt="Issues">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/GKalliatakis/diffusion-lighthouse?style=flat-square" alt="License">
  </a>
  <img src="https://img.shields.io/badge/field-diffusion%20models-blue?style=flat-square" alt="Field">
  <img src="https://img.shields.io/badge/status-active%20curation-success?style=flat-square" alt="Status">
</p>


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

👉 **https://GKalliatakis.github.io/diffusion-lighthouse/**

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

## 📚 Papers

<!-- DIFFUSION_LIGHTHOUSE_TABLE_START -->

_Last updated (UTC): **2025-12-24T17:48:26Z**_

| # | Title | Year | Venue | Citations | Last checked (UTC) | Tags | Links |
|---:|---|---:|---|---:|---|---|---|
| 1 | [Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) | 2020 | NeurIPS | 25,117 | 2025-12-24T17:48:26Z | foundations, image | [arXiv](https://arxiv.org/abs/2006.11239) · [PDF](https://arxiv.org/pdf/2006.11239.pdf) · [Scholar](https://scholar.google.com/scholar?cluster=622631041436591387&hl=en&as_sdt=2005&sciodt=0,5) |
| 2 | [Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) | 2020 | ICLR | 9,989 | 2025-12-24T17:48:26Z | foundations, sampling | [arXiv](https://arxiv.org/abs/2010.02502) · [PDF](https://arxiv.org/pdf/2010.02502.pdf) · [Scholar](https://scholar.google.com/scholar?cluster=15692403916484267912&hl=en&as_sdt=2005&sciodt=0,5) |
| 3 | [Score-Based Generative Modeling through Stochastic Differential Equations](https://arxiv.org/abs/2011.13456) | 2021 | ICLR | 8,647 | 2025-12-24T17:48:26Z | foundations, theory | [arXiv](https://arxiv.org/abs/2011.13456) · [PDF](https://arxiv.org/pdf/2011.13456.pdf) · [Scholar](https://scholar.google.com/scholar?cluster=14592788616550656262&hl=en&as_sdt=2005&sciodt=0,5) |
| 4 | [Improved Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2102.09672) | 2021 | ICML | 0 | 2025-12-24T17:03:39Z | training, image | [arXiv](https://arxiv.org/abs/2102.09672) · [PDF](https://arxiv.org/pdf/2102.09672.pdf) · [Scholar](https://proceedings.mlr.press/v139/nichol21a.html) |
| 5 | [Generative Modeling by Estimating Gradients of the Data Distribution](https://arxiv.org/abs/1907.05600) | 2019 | NeurIPS | 0 | 2025-12-24T17:03:39Z | foundations, score | [arXiv](https://arxiv.org/abs/1907.05600) · [PDF](https://arxiv.org/pdf/1907.05600.pdf) · [Scholar](https://proceedings.neurips.cc/paper/2019/hash/3001ef257407d5a371a96dcd947c7d93-Abstract.html?ref=https://githubhelp.com) |
| 6 | [Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) | 2022 | arXiv | — | — | guidance, conditioning | [arXiv](https://arxiv.org/abs/2207.12598) · [PDF](https://arxiv.org/pdf/2207.12598.pdf) · [Scholar](https://scholar.google.com/scholar?cluster=9321084442049185729&hl=en&as_sdt=2005&sciodt=0,5) |
| 7 | [High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) | 2022 | CVPR | — | — | latent, image, systems | [arXiv](https://arxiv.org/abs/2112.10752) · [PDF](https://arxiv.org/pdf/2112.10752.pdf) · [Scholar](https://scholar.google.com/scholar?cluster=2427242760668866618&hl=en&as_sdt=2005&sciodt=0,5) |
| 8 | [Photorealistic Text-to-Image Diffusion Models with Deep Language Understanding](https://arxiv.org/abs/2205.11487) | 2022 | arXiv | — | — | text-to-image, scaling | [arXiv](https://arxiv.org/abs/2205.11487) · [PDF](https://arxiv.org/pdf/2205.11487.pdf) · [Scholar](https://scholar.google.com/scholar?cluster=2130901831690841916&hl=en&as_sdt=2005&sciodt=0,5) |
| 9 | [Progressive Distillation for Fast Sampling of Diffusion Models](https://arxiv.org/abs/2202.00512) | 2022 | ICLR | — | — | acceleration, distillation | [arXiv](https://arxiv.org/abs/2202.00512) · [PDF](https://arxiv.org/pdf/2202.00512.pdf) · [Scholar](https://scholar.google.com/scholar?cluster=5194434213555432016&hl=en&as_sdt=2005&sciodt=0,5) |
| 10 | [Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) | 2021 | NeurIPS | — | — | guidance, image | [arXiv](https://arxiv.org/abs/2105.05233) · [PDF](https://arxiv.org/pdf/2105.05233.pdf) · [Scholar](https://scholar.google.com/scholar?cluster=17982230494456470673&hl=en&as_sdt=2005&sciodt=0,5) |
| 11 | [GLIDE: Towards Photorealistic Image Generation and Editing with Text-Guided Diffusion Models](https://arxiv.org/abs/2112.10741) | 2021 | arXiv | — | — | text-to-image, editing | [arXiv](https://arxiv.org/abs/2112.10741) · [PDF](https://arxiv.org/pdf/2112.10741.pdf) · [Scholar](https://scholar.google.com/scholar?cluster=15472303808406531445&hl=en&as_sdt=2005&sciodt=0,5) |

<!-- DIFFUSION_LIGHTHOUSE_TABLE_END -->

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
