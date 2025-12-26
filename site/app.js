// =========================
// Diffusion Lighthouse — app.js
// Adds: citations chip (exact), sort by citations, Cite modal w/ BibTeX + copy
// =========================

async function loadPapersJson() {
  // Robust URL resolution: works for /site/ and for serving from inside site/
  const url = new URL("public/data/papers.json", window.location.href);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load papers.json (${res.status}) at ${url}`);

  const data = await res.json();
  if (!data || !Array.isArray(data.papers)) {
    throw new Error("papers.json is missing a top-level 'papers' array");
  }
  return data; // { papers: [...], citations_meta?: ... }
}

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element with id="${id}" in index.html`);
  return el;
}

function uniqSorted(arr) {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function paperText(p) {
  const authors = (p.authors || []).join(" ");
  const tags = (p.tags || []).join(" ");
  const why = (p.why_it_matters || "");
  return `${p.title || ""} ${authors} ${p.venue || ""} ${p.year || ""} ${p.impact_type || ""} ${tags} ${why}`.toLowerCase();
}

function el(tag, attrs = {}, children = []) {
  const SVG_TAGS = new Set([
    "svg", "path", "g", "circle", "rect", "line", "polyline", "polygon", "ellipse"
  ]);

  const n = SVG_TAGS.has(tag)
    ? document.createElementNS("http://www.w3.org/2000/svg", tag)
    : document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.setAttribute("class", v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }

  for (const c of children) {
    if (typeof c === "string") n.appendChild(document.createTextNode(c));
    else if (c) n.appendChild(c);
  }
  return n;
}


function linkOrNull(href, text) {
  if (!href) return null;
  return el("a", { href, target: "_blank", rel: "noreferrer" }, [text]);
}

function fillSelect(selectId, values, placeholder) {
  const sel = $(selectId);
  sel.innerHTML = "";
  sel.appendChild(el("option", { value: "" }, [placeholder]));
  for (const v of values) sel.appendChild(el("option", { value: v }, [v]));
}

/**
 * Exact always:
 * 25117 -> "25,117"
 * 9989  -> "9,989"
 */
function formatCitationsExact(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toLocaleString("en-US");
}

function citationCount(p) {
  const c = Number(p?.citations?.count);
  return Number.isFinite(c) ? c : null; // null means "missing"
}

// -------------------------
// BibTeX helpers (Cite modal)
// -------------------------

function slugifyId(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeBibtex(s) {
  // Minimal escaping to avoid breaking braces/quotes
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/"/g, '\\"');
}

function authorsToBibtex(authors) {
  const a = (authors || []).filter(Boolean).map(String).map(x => x.trim()).filter(x => x.length > 0);
  return a.join(" and ");
}

function arxivIdFromUrl(url) {
  const u = String(url || "");
  const m = u.match(/arxiv\.org\/abs\/([^?#]+)/i);
  return m ? m[1] : null;
}

function makeBibtex(p) {
  // Prefer canonical BibTeX if you later add p.bibtex to your build output
  if (p && p.bibtex && String(p.bibtex).trim()) return String(p.bibtex).trim();

  const id = slugifyId(p.id || `${(p.authors?.[0] || "paper")}_${p.year || ""}`);
  const title = escapeBibtex(p.title || "");
  const author = escapeBibtex(authorsToBibtex(p.authors));
  const year = p.year ? String(p.year) : "";
  const venue = escapeBibtex(p.venue || "");
  const arxivAbs = p.links?.arxiv || "";
  const arxivId = arxivIdFromUrl(arxivAbs);

  const v = (p.venue || "").toLowerCase();
  const entryType = v.includes("arxiv") ? "article" : "inproceedings";

  const lines = [];
  lines.push(`@${entryType}{${id},`);
  if (title) lines.push(`  title = {${title}},`);
  if (author) lines.push(`  author = {${author}},`);
  if (venue) {
    if (entryType === "article") lines.push(`  journal = {${venue}},`);
    else lines.push(`  booktitle = {${venue}},`);
  }
  if (year) lines.push(`  year = {${year}},`);
  if (arxivId) {
    lines.push(`  eprint = {${escapeBibtex(arxivId)}},`);
    lines.push(`  archivePrefix = {arXiv},`);
  }
  if (arxivAbs) lines.push(`  url = {${escapeBibtex(arxivAbs)}},`);

  // Remove trailing comma from the last field
  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,\s*$/, "");
  }
  lines.push("}");

  return lines.join("\n");
}

// -------------------------
// Cite modal wiring
// -------------------------

let openCiteModal = null; // function(paper)

function initCiteModal() {
  const citeModal = document.getElementById("citeModal");
  if (!citeModal) return; // modal not added to HTML yet

  const citeOverlay = document.getElementById("citeOverlay");
  const citeClose = document.getElementById("citeClose");
  const closeBibtex = document.getElementById("closeBibtex");
  const bibtexBox = document.getElementById("bibtexBox");
  const copyBibtex = document.getElementById("copyBibtex");
  const openScholar = document.getElementById("openScholar");
  const citeSubtitle = document.getElementById("citeSubtitle");
  const citeFootnote = document.getElementById("citeFootnote");

  let currentBibtex = "";

  function open(p) {
    const bib = makeBibtex(p);
    currentBibtex = bib;

    citeModal.setAttribute("aria-hidden", "false");
    bibtexBox.value = bib;

    citeSubtitle.textContent = (p.title || "").slice(0, 160);

    // Prefer scholar URL, then arXiv, then PDF
    openScholar.href = p?.scholar?.scholar_url || p?.citations?.scholar_url || p?.links?.arxiv || p?.links?.pdf || "#";

    const checked = p?.citations?.last_checked_utc ? ` • citations checked ${p.citations.last_checked_utc}` : "";
    citeFootnote.textContent = `BibTeX is generated from dataset fields when a canonical BibTeX entry is not available${checked}.`;

    bibtexBox.focus();
    bibtexBox.select();
  }

  function close() {
    citeModal.setAttribute("aria-hidden", "true");
    currentBibtex = "";
  }

  citeOverlay?.addEventListener("click", close);
  citeClose?.addEventListener("click", close);
  closeBibtex?.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && citeModal.getAttribute("aria-hidden") === "false") close();
  });

  copyBibtex?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentBibtex || bibtexBox.value || "");
      copyBibtex.textContent = "Copied!";
      setTimeout(() => (copyBibtex.textContent = "Copy BibTeX"), 900);
    } catch {
      // Fallback: select text so user can Cmd/Ctrl+C
      bibtexBox.focus();
      bibtexBox.select();
      copyBibtex.textContent = "Select & copy";
      setTimeout(() => (copyBibtex.textContent = "Copy BibTeX"), 1200);
    }
  });

  openCiteModal = open;
}

// -------------------------
// Rendering
// -------------------------

function renderList(papers) {
  const list = $("list");
  list.innerHTML = "";

  if (papers.length === 0) {
    list.appendChild(
      el("div", { class: "card" }, [
        el("h2", {}, ["No results"]),
        el("div", { class: "why" }, ["Try clearing filters or using a different query."])
      ])
    );
    $("count").textContent = "0";
    return;
  }

  for (const p of papers) {
    const chips = [];

    // Citations chip — Option I: show for all papers.
    const c = citationCount(p);
    if (c !== null) {
      const asOf = p?.citations?.last_checked_utc;
      const title = asOf ? `Citations (checked ${asOf})` : "Citations";
      chips.push(el("span", { class: "chip", title }, [`Cited by ${formatCitationsExact(c)}`]));
    } else {
      chips.push(el("span", { class: "chip", title: "Citations not available yet" }, ["Cited by —"]));
    }

    // Core chips
    chips.push(
      el("span", { class: "chip" }, [String(p.year ?? "")]),
      el("span", { class: "chip" }, [String(p.venue ?? "")]),
      el("span", { class: "chip" }, [String(p.impact_type ?? "")])
    );

    // Tag chips
    for (const t of (p.tags || [])) chips.push(el("span", { class: "chip" }, [t]));

    const cleanedChips = chips.filter(ch => ch.textContent.trim().length > 0);

    // Title clickable to arXiv if available
    const titleNode = p.links?.arxiv
      ? el("a", { href: p.links.arxiv, target: "_blank", rel: "noreferrer" }, [p.title || "(untitled)"])
      : document.createTextNode(p.title || "(untitled)");

    // --- Cite button (define BEFORE links) ---
    const citeBtn = el("button", {
      class: "linkAction",
      type: "button",
      title: "Copy BibTeX"
    }, [
      el("svg", {class: "citeIcon", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true"}, [
        el("path", {
          d: "M12 3 2 8l10 5 10-5-10-5Z",
          stroke: "currentColor",
          "stroke-width": "1.8",
          "stroke-linejoin": "round"
        }),
        el("path", {
          d: "M6 10v5c0 1 3 3 6 3s6-2 6-3v-5",
          stroke: "currentColor",
          "stroke-width": "1.8",
          "stroke-linecap": "round"
        }),
        el("path", {
          d: "M22 8v6",
          stroke: "currentColor",
          "stroke-width": "1.8",
          "stroke-linecap": "round"
        }),
        el("path", {
          d: "M22 14c0 1-1.2 2-2.7 2",
          stroke: "currentColor",
          "stroke-width": "1.8",
          "stroke-linecap": "round"
        })
      ]),
      "Cite"
    ]);

    citeBtn.addEventListener("click", () => {
      if (typeof openCiteModal === "function") openCiteModal(p);
    });

    // Links row (Cite on the same line)
    const links = el("div", { class: "links" }, [
      linkOrNull(p.links?.arxiv, "arXiv"),
      linkOrNull(p.links?.pdf, "PDF"),
      linkOrNull(p.links?.code, "Code"),
      linkOrNull(p.links?.project, "Project"),
      citeBtn
    ].filter(Boolean));

    const card = el("div", { class: "card" }, [
      el("div", { class: "cardTop" }, [
        el("div", {}, [
          el("h2", {}, [titleNode]),
          el("div", { class: "smallMeta" }, [(p.authors || []).join(", ")])
        ])
      ]),
      el("div", { class: "badgeRow" }, cleanedChips),
      links,
      el("div", { class: "why" }, [p.why_it_matters || ""])
    ]);

    list.appendChild(card);
  }

  $("count").textContent = String(papers.length);
}


function applyFilters(all) {
  const q = $("q").value.trim().toLowerCase();
  const impact = $("impact").value;
  const tag = $("tag").value;
  const sort = $("sort").value;

  let out = all.filter(p => {
    if (impact && p.impact_type !== impact) return false;
    if (tag && !(p.tags || []).includes(tag)) return false;
    if (q && !paperText(p).includes(q)) return false;
    return true;
  });

  if (sort === "new") out.sort((a, b) => (b.year - a.year) || String(a.title).localeCompare(String(b.title)));
  if (sort === "old") out.sort((a, b) => (a.year - b.year) || String(a.title).localeCompare(String(b.title)));
  if (sort === "title") out.sort((a, b) => String(a.title).localeCompare(String(b.title)));

  // Sort by citations (descending), missing citations last
  if (sort === "cites") {
    out.sort((a, b) => {
      const ca = citationCount(a);
      const cb = citationCount(b);
      const va = ca === null ? -1 : ca;
      const vb = cb === null ? -1 : cb;
      return (vb - va) || (b.year - a.year) || String(a.title).localeCompare(String(b.title));
    });
  }

  renderList(out);
}

// -------------------------
// Main
// -------------------------

async function main() {
  initCiteModal();

  const data = await loadPapersJson();
  const all = data.papers;

  $("total").textContent = String(all.length);

  fillSelect("impact", uniqSorted(all.map(p => p.impact_type).filter(Boolean)), "All impact types");
  fillSelect("tag", uniqSorted(all.flatMap(p => p.tags || [])), "All tags");

  // Optional: populate cite provenance line if present
  const citeMetaEl = document.getElementById("citeMeta");
  if (citeMetaEl && data.citations_meta) {
    const notes = data.citations_meta.notes || "";
    const src = data.citations_meta.source ? ` (${data.citations_meta.source})` : "";
    const updated = data.citations_meta.last_updated_utc ? ` • updated ${data.citations_meta.last_updated_utc}` : "";
    citeMetaEl.textContent = `${notes}${src}${updated}`.trim();
  }

  const rerender = () => applyFilters(all);

  $("q").addEventListener("input", rerender);
  $("impact").addEventListener("change", rerender);
  $("tag").addEventListener("change", rerender);
  $("sort").addEventListener("change", rerender);

  $("clear").addEventListener("click", () => {
    $("q").value = "";
    $("impact").value = "";
    $("tag").value = "";
    $("sort").value = "new";
    rerender();
  });

  rerender();
}

main().catch(err => {
  console.error(err);
  const list = document.getElementById("list");
  if (list) {
    list.innerHTML = "";
    list.textContent = `Error: ${err?.message || String(err)}`;
  }
  const count = document.getElementById("count");
  if (count) count.textContent = "0";
});
