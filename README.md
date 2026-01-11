
<p align="center">
  <img src="assets/diffusion-lighthouse-logo.png" alt="Diffusion Lighthouse logo" width="420">
</p>

<p align="center">
  A curated, dataset-first map of diffusion research — peer-reviewed first, with rare canonical preprint exceptions.
</p>

<p align="center">
  <!-- GitHub Pages deployment status -->
  <a href="https://github.com/GKalliatakis/diffusion-lighthouse/actions/workflows/pages.yml">
    <img src="https://github.com/GKalliatakis/diffusion-lighthouse/actions/workflows/pages.yml/badge.svg" alt="Deploy to GitHub Pages">
  </a>

  <!-- License -->
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/GKalliatakis/diffusion-lighthouse?style=flat-square" alt="License">
  </a>

  <!-- Conceptual / editorial badges -->
  <img src="https://img.shields.io/badge/focus-diffusion%20models-blue?style=flat-square" alt="Focus: diffusion models">
  <img src="https://img.shields.io/badge/index-dataset--first-informational?style=flat-square" alt="Dataset-first index">
  <img src="https://img.shields.io/badge/status-editorial%20curation-success?style=flat-square" alt="Editorial curation">
  <img src="https://img.shields.io/badge/policy-peer--reviewed--first-critical?style=flat-square" alt="Peer-reviewed-first policy">
</p>

---

**Diffusion Lighthouse** helps researchers, students, and practitioners navigate the fast‑moving diffusion literature by surfacing work with **lasting conceptual signal**.

It is **not** an exhaustive index and it does **not** rank papers by benchmark performance.
Instead, it curates papers that shaped how diffusion models are **understood, trained, and applied** —
grounded in datasets, with **explicit editorial judgment**.

> Like a lighthouse, this project does not chart every wave —  
> it helps you navigate toward the most important signals.

---

## 🌐 Website (canonical index)

👉 **https://GKalliatakis.github.io/diffusion-lighthouse/**

The website is the **canonical index**.

- The repository supports the website.
- The website defines inclusion.
- If a paper is not on the website, it is **not included**.

---

## 🚫 What Diffusion Lighthouse is not

- Not a leaderboard  
- Not an automatic crawler  
- Not a complete bibliography  
- Not a benchmark comparison site  

Exclusion is intentional.

---

## 🗂️ Repository structure

This repository exists to **power the website**.

- Paper metadata is curated in YAML
- The site consumes a built `papers.json`
- The README intentionally does **not** duplicate the paper list

See the website for the actual index.

---

## 🧭 Editorial cadence

Diffusion Lighthouse is curated through an **explicit editorial process**.

Additions, revisions, and reclassifications take time by design.
Papers are evaluated for **lasting conceptual, methodological, or dataset-level signal** —
not for recency, popularity, or benchmark performance.

As a result:
- Not every notable paper is included
- Some papers may appear only after their historical role becomes clear
- Absence does not imply omission or oversight

The index evolves deliberately. Speed is not the goal; clarity is.

---

## 🤝 Contributions

Well-defined contributions are welcome.

Because Diffusion Lighthouse is editorially curated, contributions are expected to be
**specific, motivated, and grounded in the project’s criteria**.
Examples of acceptable contributions include:

- Proposing a paper with a clear editorial rationale
  (why it delivers lasting conceptual, methodological, or dataset-level signal)
- Suggesting a correction or clarification to an existing entry
- Pointing out missing or incorrect canonical publication links
- Identifying relation errors or misclassifications

General paper lists, popularity-based suggestions, or benchmark-driven additions
will not be considered.

All contributions are reviewed editorially, and inclusion is discretionary.

---

## 🔧 Maintenance

For the exact, repeatable steps to:

- update citations  
- rebuild `papers.json`  
- refresh the site  
- troubleshoot common failures (Scholar blocks, stale artifacts, build issues)

see **[MAINTENANCE.md](MAINTENANCE.md)**.

---

## 📜 License

This project is released under the **MIT License**.  
See [LICENSE](LICENSE) for details.

