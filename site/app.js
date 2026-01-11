// =========================
// Diffusion Lighthouse — app.js (DOM-first; matches your index.html + style.css)
// FIXES:
// - Works on GitHub Pages subpaths (e.g. /diffusion-lighthouse/)
// - Robust SPA routing between index/about/policy using base-prefix aware paths
// - Rewrites nav hrefs to include base prefix automatically
//
// PHASE 2 ADDITIONS (site explains itself):
// - Renders an Index explainer once into #indexIntro (preferred), or falls back to inserting above #list
// - Makes About link base-aware in the explainer
//
// PHASE 3 ADDITIONS (relations polish):
// - Human-readable relation types ("builds_on" -> "Builds on")
// - Resolves relation targets to paper titles (via state.byId)
// - Shows Outgoing + Incoming relations in modal (incoming computed from all papers)
//
// FEATURES (kept):
// - Uses existing DOM: #list, #q/#impact/#tag/#sort/#clear, KPIs, #citeMeta
// - Uses existing modals: #citeModal and #paperModal (aria-hidden toggling)
// - Peer-reviewed-first canonical link preference
// - Allows arXiv links ONLY when publication_status === "canonical_preprint"
// - Publication badge: Peer-reviewed vs Canonical preprint
// - Citations chip: "Cited by X" + tooltip
// - "Paper" + "Venue" links via pickPdfLink + pickVenueLink
// =========================

/* -------------------------
   Helpers
------------------------- */

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function formatAuthors(authors) {
  const a = normalizeArray(authors).filter(Boolean);
  if (a.length === 0) return "";
  if (a.length <= 2) return a.join(", ");
  if (a.length === 3) return `${a[0]}, ${a[1]}, ${a[2]}`;
  return `${a[0]}, ${a[1]}, et al.`;
}

function safeUrl(u) {
  if (!u) return "";
  try {
    return new URL(u).toString();
  } catch {
    return "";
  }
}

function toTitleCase(s) {
  return String(s || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function isCanonicalPreprint(p) {
  return String(p?.publication_status || "").toLowerCase() === "canonical_preprint";
}

function isPeerReviewed(p) {
  const ps = String(p?.publication_status || "").toLowerCase();
  return ps === "accepted" || ps === "published";
}

function publicationLabel(p) {
  if (isCanonicalPreprint(p)) return "Canonical preprint";
  if (isPeerReviewed(p)) return "Peer-reviewed";
  return p?.publication_status ? toTitleCase(p.publication_status) : "";
}

function publicationTooltip(p) {
  if (isCanonicalPreprint(p)) {
    return "Included by exception: field-defining preprint with downstream lineage. Explicitly labeled.";
  }
  if (isPeerReviewed(p)) {
    return "Peer-reviewed: canonical proceedings/journal links shown.";
  }
  return "";
}

/**
 * Prefer peer-reviewed canonical links.
 * For peer-reviewed papers: exclude arXiv links.
 * For canonical_preprint: allow arXiv links.
 */
function pickCanonicalLink(p) {
  const links = p?.links || {};
  const allowArxiv = isCanonicalPreprint(p);

  const order = ["doi", "journal", "pdf", "proceedings", "publisher", "official", "url"];
  for (const k of order) {
    const u = safeUrl(links?.[k]);
    if (!u) continue;
    if (!allowArxiv && u.includes("arxiv.org")) continue;
    return { key: k, url: u };
  }

  // canonical_preprint fallback: use arxiv/pdf if present
  if (allowArxiv) {
    const pdf = safeUrl(links?.pdf);
    if (pdf) return { key: "pdf", url: pdf };
    const ax = safeUrl(links?.arxiv);
    if (ax) return { key: "arxiv", url: ax };
  }

  return null;
}

function pickPdfLink(p) {
  const u = safeUrl(p?.links?.pdf);
  if (!u) return null;
  if (!isCanonicalPreprint(p) && u.includes("arxiv.org")) return null;
  return u;
}

function pickVenueLink(p) {
  const links = p?.links || {};
  const allowArxiv = isCanonicalPreprint(p);
  const order = ["doi", "journal", "proceedings", "publisher", "official", "url"];
  for (const k of order) {
    const u = safeUrl(links[k]);
    if (!u) continue;
    if (!allowArxiv && u.includes("arxiv.org")) continue;
    return { key: k, url: u };
  }
  return null;
}

function getCitationsCount(p) {
  const raw = p?.citations?.count;

  if (raw == null) return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;

  const cleaned = String(raw).replace(/[^\d]/g, "");
  if (!cleaned) return 0;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function makeBibTeX(p) {
  const id = (p.id || "paper").replace(/[^\w-]/g, "");
  const year = p.year || "";
  const title = p.title || "";
  const authors = normalizeArray(p.authors).filter(Boolean).join(" and ");
  const venue = p.venue || "";
  const link = pickCanonicalLink(p)?.url || "";

  const entryType = String(p.venue || "").toLowerCase().includes("journal") ? "article" : "inproceedings";

  return `@${entryType}{${id},
  title={${title}},
  author={${authors}},
  year={${year}}${venue ? `,
  booktitle={${venue}}` : ""}${link ? `,
  url={${link}}` : ""}
}`;
}

/* -------------------------
   Relations polish
------------------------- */

const RELATION_HELP = {
  builds_on: "Directly extends or refines ideas from this work.",
  enables: "Makes this later work feasible or practical.",
  unifies: "Connects previously separate ideas into one framework.",
  contrasts_with: "Takes a different or opposing approach.",
  precedes: "Earlier work that established foundations.",
  simplifies: "Reduces complexity while preserving capability.",
  extends: "Adds scope or capability on top of this work.",
  accelerates_sampling_of: "Introduces a faster sampling method for this model family.",
  refines_training_of: "Improves training choices, objectives, or schedules.",
};

function humanizeRelationType(t) {
  const s = String(t || "").trim();
  if (!s) return "";
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function resolveTargetId(r) {
  return String(r?.target_id || r?.paper_id || r?.id || r?.target || r?.paper || "").trim();
}

function resolvePaperTitle(idOrTitle) {
  const id = String(idOrTitle || "");
  const hit = state.byId?.get(id);
  if (hit?.title) return hit.title;
  return id || "Related";
}

function buildIncomingRelationsIndex() {
  const incoming = new Map();

  for (const src of state.papers) {
    const rels = Array.isArray(src.relations) ? src.relations : [];
    for (const r of rels) {
      if (!r || typeof r !== "object") continue;
      const tid = resolveTargetId(r);
      if (!tid) continue;

      if (!incoming.has(tid)) incoming.set(tid, []);
      incoming.get(tid).push({ source: src, relation: r });
    }
  }

  for (const [k, arr] of incoming.entries()) {
    arr.sort((a, b) => {
      const ta = humanizeRelationType(a.relation?.type);
      const tb = humanizeRelationType(b.relation?.type);
      if (ta !== tb) return ta.localeCompare(tb);
      return (b.source?.year || 0) - (a.source?.year || 0);
    });
  }

  state.incoming = incoming;
}

function renderRelationsList(items) {
  if (!items || !items.length) return `<span class="smallMeta">None listed.</span>`;

  return items
    .map((it) => {
      const r = it?.relation || it; // supports {source, relation} for incoming
      const typeKey = String(r?.type || "").trim();
      const typeTxt = humanizeRelationType(typeKey);
      const tip = RELATION_HELP[typeKey] || RELATION_HELP[typeKey.toLowerCase?.()] || "";
      const typeHtml = typeTxt
        ? `<span class="relationType"${tip ? ` title="${escapeHtml(tip)}"` : ""}>${escapeHtml(typeTxt)}</span>`
        : "";

      const tid = resolveTargetId(r);
      const title = r?.target_title || resolvePaperTitle(tid) || "Related";

      const link = tid
        ? `<a href="#" class="relationLink" data-open-paper="${escapeHtml(tid)}">${escapeHtml(title)}</a>`
        : `<span>${escapeHtml(title)}</span>`;

      const note = r?.note ? `<span class="smallMeta">${escapeHtml(r.note)}</span>` : "";

      const from = it?.source?.id
        ? `<span class="smallMeta">From: <a href="#" class="relationLink" data-open-paper="${escapeHtml(
            it.source.id
          )}">${escapeHtml(it.source.title || it.source.id)}</a></span>`
        : "";

      return `<div class="relationItem">${typeHtml}${link}${note}${from}</div>`;
    })
    .join("");
}

/* -------------------------
   Base-path aware routing
------------------------- */

// Compute base prefix (e.g. "/diffusion-lighthouse") so routes work on GitHub Pages subpaths.
const ROUTES = ["/about", "/editorial-policy"];

function baseFromTag() {
  const baseEl = document.querySelector("base[href]");
  if (!baseEl) return null;

  try {
    const abs = new URL(baseEl.getAttribute("href"), window.location.href);
    let p = abs.pathname || "/";
    if (p.endsWith("/")) p = p.slice(0, -1);
    return p === "/" ? "" : p;
  } catch {
    return null;
  }
}

function isIndexVisible() {
  const indexMain = $("indexMain");
  return !!indexMain && indexMain.hidden === false;
}


function computeBasePrefix() {
  const fromBase = baseFromTag();
  if (fromBase != null) return fromBase;

  let p = window.location.pathname || "/";
  p = p.replace(/\/index\.html$/, "");

  for (const r of ROUTES) {
    const idx = p.indexOf(r);
    if (idx !== -1) {
      const base = p.slice(0, idx);
      return base.endsWith("/") ? base.slice(0, -1) : base;
    }
  }

  if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
  return p === "/" ? "" : p;
}


const BASE = computeBasePrefix();

function joinBase(route) {
  const r = route === "/" ? "" : route;
  const b = BASE || "";
  const out = `${b}${r}`;
  return out || "/";
}

function routeFromPathname(pathname) {
  let p = (pathname || "/").replace(/\/index\.html$/, "");
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length);
  if (!p) p = "/";
  if (!p.startsWith("/")) p = `/${p}`;

  if (p === "/" || p === "") return "index";
  if (p === "/about") return "about";
  if (p === "/editorial-policy") return "policy";
  return "index";
}

function rewriteNavHrefs() {
  const map = {
    index: joinBase("/"),
    about: joinBase("/about"),
    policy: joinBase("/editorial-policy"),
  };

  document.querySelectorAll("a[data-nav]").forEach((a) => {
    const key = a.getAttribute("data-nav");
    if (map[key]) a.setAttribute("href", map[key]);
  });
}

/* -------------------------
   Phase 2: “site explains itself”
------------------------- */

function renderIndexExplainer() {
  const aboutHref = joinBase("/about");
  return `
    <section class="policyCard" style="margin-top:14px;">
      <p style="margin-top:0;">
        <strong>Diffusion Lighthouse</strong> is a curated, dataset-first map of diffusion research.
        It prioritizes <strong>ideas, provenance, and long-term relevance</strong> over benchmark tables.
      </p>
      <p class="muted" style="margin:10px 0 0 0;">
        Tip: sort by <strong>citations</strong> for a “gravity well” view — then open a paper to see its
        <strong>dataset focus</strong>, <strong>concept tags</strong>, and <strong>relations</strong>.
        <a href="${escapeHtml(aboutHref)}" data-nav="about">How to read this →</a>
      </p>
    </section>
  `;
}

function renderIndexIntroOnce() {
  const host = $("indexIntro"); // preferred host in index.html
  if (host) {
    if (host.dataset.rendered === "1") return;
    host.innerHTML = renderIndexExplainer();
    host.dataset.rendered = "1";
    return;
  }

  // fallback: insert above #list
  const list = $("list");
  if (!list) return;
  const markerId = "indexIntroAuto";
  if (document.getElementById(markerId)) return;

  const wrap = document.createElement("div");
  wrap.id = markerId;
  wrap.innerHTML = renderIndexExplainer();
  list.parentNode.insertBefore(wrap, list);
}

/* -------------------------
   Data loading
------------------------- */

async function loadPapersJson() {
  // Always fetch from the site root (repo base), not from the current route.
  const url = new URL(joinBase("/public/data/papers.json"), window.location.origin);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load papers.json (${res.status})`);

  const data = await res.json();

  const papers = Array.isArray(data) ? data : Array.isArray(data?.papers) ? data.papers : [];
  const citationsMeta = Array.isArray(data) ? null : data?.citations_meta || null;

  return {
    papers: papers.map((p) => ({
      ...p,
      tags: normalizeArray(p.tags),
      dataset_focus: normalizeArray(p.dataset_focus),
      contribution_types: normalizeArray(p.contribution_types),
      concept_tags: normalizeArray(p.concept_tags),
      citations: p.citations ?? {},
      links: p.links ?? {},
      scholar: p.scholar ?? {},
      relations: p.relations ?? null,
    })),
    citationsMeta,
  };
}

/* -------------------------
   State
------------------------- */

const state = {
  papers: [],
  filtered: [],
  byId: new Map(),
  citationsMeta: null,

  // relations index
  incoming: new Map(),

  q: "",
  impact: "",
  tag: "",
  sort: "new", // new | old | title | cites

  activePaperId: null,
  activeCitePaperId: null,
};

/* -------------------------
   Routing (DOM toggle)
------------------------- */

function setActiveNav(route) {
  const navIndex = $("navIndex");
  const navAbout = $("navAbout");
  const navPolicy = $("navPolicy");
  if (!navIndex || !navAbout || !navPolicy) return;

  navIndex.classList.toggle("active", route === "index");
  navAbout.classList.toggle("active", route === "about");
  navPolicy.classList.toggle("active", route === "policy");
}

function showPageByRoute(route) {
  const indexMain = $("indexMain");
  const aboutMain = $("aboutMain");
  const policyMain = $("policyMain");

  const controls = $("controls");
  const citeMeta = $("citeMeta");

  const isIndex = route === "index";
  const isAbout = route === "about";
  const isPolicy = route === "policy";

  if (indexMain) indexMain.hidden = !isIndex;
  if (aboutMain) aboutMain.hidden = !isAbout;
  if (policyMain) policyMain.hidden = !isPolicy;

  // Controls + cite meta only on index
  if (controls) controls.style.display = isIndex ? "" : "none";
  if (citeMeta) citeMeta.style.display = isIndex ? "" : "none";

  setActiveNav(route);

  // Only show explainer on index
  if (isIndex) renderIndexIntroOnce();
}

function showPageFromLocation() {
  const route = routeFromPathname(window.location.pathname);
  showPageByRoute(route);
}

function bindNavigation() {
  rewriteNavHrefs();

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (!a) return;

    const href = a.getAttribute("href");
    if (!href) return;

    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    e.preventDefault();
    history.pushState({}, "", url.pathname);

    // Close modals when navigating
    closeCiteModal();
    closePaperModal();

    showPageFromLocation();
  });

  window.addEventListener("popstate", () => {
    closeCiteModal();
    closePaperModal();
    showPageFromLocation();
  });
}

/* -------------------------
   Filtering + sorting
------------------------- */

function recomputeFilters() {
  const q = state.q.trim().toLowerCase();
  const impact = state.impact.trim();
  const tag = state.tag.trim();

  const filtered = state.papers.filter((p) => {
    if (impact && String(p.impact_type || "") !== impact) return false;
    if (tag && !normalizeArray(p.tags).includes(tag)) return false;

    if (!q) return true;

    const hay = [
      p.title,
      formatAuthors(p.authors),
      p.venue,
      p.year,
      p.publication_status,
      ...(p.tags || []),
      ...(p.dataset_focus || []),
      ...(p.contribution_types || []),
      ...(p.concept_tags || []),
    ]
      .filter(Boolean)
      .join(" · ")
      .toLowerCase();

    return hay.includes(q);
  });

  if (state.sort === "new") {
    filtered.sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (state.sort === "old") {
    filtered.sort((a, b) => (a.year || 0) - (b.year || 0));
  } else if (state.sort === "title") {
    filtered.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  } else if (state.sort === "cites") {
    filtered.sort((a, b) => getCitationsCount(b) - getCitationsCount(a) || (b.year || 0) - (a.year || 0));
  }

  state.filtered = filtered;

  const totalEl = $("total");
  const countEl = $("count");
  if (totalEl) totalEl.textContent = String(state.papers.length);
  if (countEl) countEl.textContent = String(state.filtered.length);
}

/* -------------------------
   Rendering cards into #list
------------------------- */

function renderList() {
  const list = $("list");
  if (!list) return;
  if (!isIndexVisible()) return;
  // Ensure explainer exists (index only)
  renderIndexIntroOnce();

  const html = state.filtered
    .map((p) => {
      const relPreview = renderRelationsPreview(p, 3);

      const venueYear = [p.venue, p.year].filter(Boolean).join(" · ");
      const cites = getCitationsCount(p);

      const pubLabel = publicationLabel(p);
      const pubTip = publicationTooltip(p);

      // Paper + Venue links
      const paperUrl = pickPdfLink(p) || pickVenueLink(p)?.url || "";
      const venue = pickVenueLink(p);
      const venueUrl = venue?.url || "";

      const paperHtml = paperUrl
        ? `<a class="linkBtn" href="${escapeHtml(paperUrl)}" target="_blank" rel="noreferrer"
             title="${escapeHtml(isCanonicalPreprint(p) ? "Canonical source (preprint)" : "Canonical peer-reviewed link")}">Paper</a>`
        : isPeerReviewed(p)
          ? `<span class="smallMeta">No peer-reviewed link.</span>`
          : `<span class="smallMeta">No link.</span>`;

      const showVenue = venueUrl && venueUrl !== paperUrl;
      const venueHtml = showVenue
        ? `<a class="linkBtn" href="${escapeHtml(venueUrl)}" target="_blank" rel="noreferrer"
             title="Proceedings / journal landing page">Venue</a>`
        : "";

      const citeChip = cites
        ? `<span class="chip" title="Google Scholar snapshot. Context, not rank."><strong>Cited by ${cites.toLocaleString()}</strong></span>`
        : "";

      const pubChip = pubLabel
        ? `<span class="chip" title="${escapeHtml(pubTip)}">${escapeHtml(pubLabel)}</span>`
        : "";

      return `
        <article class="card" data-paper-id="${escapeHtml(p.id)}">
          <div class="cardTop">
            <div style="min-width:0;">
              <h2>
                <a href="#" data-open-paper="${escapeHtml(p.id)}">${escapeHtml(p.title || "(untitled)")}</a>
              </h2>
              <div class="smallMeta">
                ${escapeHtml(formatAuthors(p.authors))}${venueYear ? ` · ${escapeHtml(venueYear)}` : ""}
              </div>
            </div>
          </div>

          ${p.why_it_matters ? `<div class="why">${escapeHtml(String(p.why_it_matters))}</div>` : ""}

          <div class="badgeRow">
            ${citeChip}
            ${pubChip}
            ${p.impact_type ? `<span class="chip">${escapeHtml(toTitleCase(p.impact_type))}</span>` : ""}
            ${(p.tags || []).slice(0, 6).map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")}
          </div>

          ${relPreview ? `<div class="relationsPreview">${relPreview}</div>` : ""}

          <div class="cardActions">
            ${paperHtml}
            ${venueHtml}
            <button class="citeBtn" type="button" data-open-cite="${escapeHtml(p.id)}" title="Open BibTeX + Scholar link">Cite</button>
          </div>
        </article>
      `;
    })
    .join("");

  list.innerHTML = html;
}

function renderRelationsPreview(p, limit = 3) {
  const rels = Array.isArray(p?.relations) ? p.relations : [];
  if (!rels.length) return "";

  const shown = rels.slice(0, limit);
  const more = rels.length - shown.length;

  const html = shown
    .map((r) => {
      const tid = resolveTargetId(r);
      const targetObj = tid ? state.byId.get(tid) : null;
      const label = r?.target_title || targetObj?.title || tid || "Related";
      const type = humanizeRelationType(r?.type);

      const target = tid
        ? `<a href="#" data-open-paper="${escapeHtml(tid)}">${escapeHtml(label)}</a>`
        : `<span>${escapeHtml(label)}</span>`;

      return `<span class="relChip"><span class="relType">${escapeHtml(type)}</span> → ${target}</span>`;
    })
    .join("");

  return html + (more > 0 ? `<span class="smallMeta" style="margin-left:8px;">+${more}</span>` : "");
}

function renderChipRow(items, strong = false) {
  const arr = normalizeArray(items).filter(Boolean);
  if (!arr.length) return `<span class="smallMeta">None listed.</span>`;
  return arr
    .map((x) =>
      strong
        ? `<span class="chip"><strong>${escapeHtml(String(x))}</strong></span>`
        : `<span class="chip">${escapeHtml(String(x))}</span>`
    )
    .join("");
}

function renderSection(title, innerHtml) {
  return `
    <div class="section">
      <div class="sectionTitle">${escapeHtml(title)}</div>
      <div class="badgeRow" style="margin-top:6px;">${innerHtml}</div>
    </div>
  `;
}

/* Bind list delegation ONCE */
function bindListDelegation() {
  const list = $("list");
  if (!list) return;

  list.addEventListener("click", (e) => {
    const citeBtn = e.target.closest("[data-open-cite]");
    if (citeBtn) {
      e.preventDefault();
      openCiteModal(citeBtn.getAttribute("data-open-cite"));
      return;
    }

    const openPaper = e.target.closest("[data-open-paper]");
    if (openPaper) {
      e.preventDefault();
      openPaperModal(openPaper.getAttribute("data-open-paper"));
    }
  });
}

/* -------------------------
   Controls binding
------------------------- */

function populateFilters() {
  const impactSel = $("impact");
  const tagSel = $("tag");

  if (impactSel) {
    const impacts = Array.from(new Set(state.papers.map((p) => p.impact_type).filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    impactSel.innerHTML =
      `<option value="">All impact types</option>` +
      impacts.map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(toTitleCase(x))}</option>`).join("");
  }

  if (tagSel) {
    const tags = Array.from(new Set(state.papers.flatMap((p) => p.tags || []).filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b))
    );
    tagSel.innerHTML =
      `<option value="">All tags</option>` +
      tags.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  }
}

function bindControls() {
  const q = $("q");
  const impact = $("impact");
  const tag = $("tag");
  const sort = $("sort");
  const clear = $("clear");

  if (q) {
    q.addEventListener("input", () => {
      state.q = q.value || "";
      recomputeFilters();
      renderList();
    });
  }
  if (impact) {
    impact.addEventListener("change", () => {
      state.impact = impact.value || "";
      recomputeFilters();
      renderList();
    });
  }
  if (tag) {
    tag.addEventListener("change", () => {
      state.tag = tag.value || "";
      recomputeFilters();
      renderList();
    });
  }
  if (sort) {
    sort.addEventListener("change", () => {
      state.sort = sort.value || "new";
      recomputeFilters();
      renderList();
    });
  }
  if (clear) {
    clear.addEventListener("click", () => {
      state.q = "";
      state.impact = "";
      state.tag = "";
      state.sort = "new";
      if (q) q.value = "";
      if (impact) impact.value = "";
      if (tag) tag.value = "";
      if (sort) sort.value = "new";
      recomputeFilters();
      renderList();
    });
  }
}

/* -------------------------
   Modals
------------------------- */

function setModalOpen(modalEl, open) {
  if (!modalEl) return;
  modalEl.setAttribute("aria-hidden", open ? "false" : "true");
}

/* --- Cite modal --- */

function openCiteModal(paperId) {
  const p = state.byId.get(paperId);
  if (!p) return;

  state.activeCitePaperId = paperId;

  const citeModal = $("citeModal");
  const citeTitle = $("citeTitle");
  const citeSubtitle = $("citeSubtitle");
  const bibtexBox = $("bibtexBox");
  const citeFootnote = $("citeFootnote");
  const openScholar = $("openScholar");

  if (citeTitle) citeTitle.textContent = "Cite";
  if (citeSubtitle) {
    const bits = [];
    if (p.venue) bits.push(p.venue);
    if (p.year) bits.push(p.year);
    citeSubtitle.textContent = `${p.title || ""}${bits.length ? ` · ${bits.join(" · ")}` : ""}`;
  }
  if (bibtexBox) bibtexBox.value = p.bibtex ? String(p.bibtex) : makeBibTeX(p);

  const c = p.citations || {};
  const foot = [];
  const cites = getCitationsCount(p);
  if (cites) foot.push(`Cited by ${cites.toLocaleString()}`);
  if (c.snapshot_year) foot.push(`Snapshot: ${c.snapshot_year}`);
  if (c.source) foot.push(`Source: ${c.source}`);
  if (citeFootnote) citeFootnote.textContent = foot.join(" · ");

  const scholarUrl = safeUrl(p?.scholar?.scholar_url) || safeUrl(p?.scholar_url) || "";
  if (openScholar) {
    if (scholarUrl) {
      openScholar.href = scholarUrl;
      openScholar.style.display = "";
    } else {
      openScholar.href = "#";
      openScholar.style.display = "none";
    }
  }

  setModalOpen(citeModal, true);
}

function closeCiteModal() {
  state.activeCitePaperId = null;
  setModalOpen($("citeModal"), false);
}

function bindCiteModal() {
  const citeOverlay = $("citeOverlay");
  const citeClose = $("citeClose");
  const closeBibtex = $("closeBibtex");
  const copyBibtex = $("copyBibtex");

  if (citeOverlay) citeOverlay.addEventListener("click", closeCiteModal);
  if (citeClose) citeClose.addEventListener("click", closeCiteModal);
  if (closeBibtex) closeBibtex.addEventListener("click", closeCiteModal);

  if (copyBibtex) {
    copyBibtex.addEventListener("click", async () => {
      const box = $("bibtexBox");
      const text = box ? box.value || "" : "";
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
    });
  }
}

/* --- Paper modal --- */

function openPaperModal(paperId) {
  const p = state.byId.get(paperId);
  if (!p) return;

  state.activePaperId = paperId;

  const paperModal = $("paperModal");
  const paperTitle = $("paperTitle");
  const paperSubtitle = $("paperSubtitle");
  const paperBadges = $("paperBadges");
  const paperLinks = $("paperLinks");
  const paperWhy = $("paperWhy");
  const paperRelations = $("paperRelations");
  const paperCiteBtn = $("paperCiteBtn");

  if (paperTitle) paperTitle.textContent = p.title || "Paper";

  if (paperSubtitle) {
    const bits = [];
    const a = formatAuthors(p.authors);
    if (a) bits.push(a);
    const vy = [p.venue, p.year].filter(Boolean).join(" · ");
    if (vy) bits.push(vy);
    paperSubtitle.textContent = bits.join(" · ");
  }

  if (paperBadges) {
    const chips = [];
    const cites = getCitationsCount(p);

    if (cites) {
      chips.push(
        `<span class="chip" title="Citation snapshot. Context, not rank."><strong>Cited by ${cites.toLocaleString()}</strong></span>`
      );
    }

    const pub = publicationLabel(p);
    if (pub) {
      chips.push(
        `<span class="chip" title="${escapeHtml(publicationTooltip(p))}">${escapeHtml(pub)}</span>`
      );
    }

    if (p.impact_type) chips.push(`<span class="chip">${escapeHtml(toTitleCase(p.impact_type))}</span>`);
    for (const t of (p.tags || []).slice(0, 12)) chips.push(`<span class="chip">${escapeHtml(t)}</span>`);

    paperBadges.innerHTML = chips.join("");
  }

  if (paperLinks) {
    const out = [];

    const paperUrl = pickPdfLink(p) || pickVenueLink(p)?.url || "";
    const venue = pickVenueLink(p);
    const venueUrl = venue?.url || "";

    if (paperUrl) {
      out.push(
        `<a class="linkBtn" href="${escapeHtml(paperUrl)}" target="_blank" rel="noreferrer"
           title="${escapeHtml(isCanonicalPreprint(p) ? "Canonical source (preprint)" : "Canonical peer-reviewed link")}">Paper</a>`
      );
    } else {
      out.push(
        isPeerReviewed(p)
          ? `<span class="smallMeta">No peer-reviewed link.</span>`
          : `<span class="smallMeta">No link.</span>`
      );
    }

    if (venueUrl && venueUrl !== paperUrl) {
      out.push(
        `<a class="linkBtn" href="${escapeHtml(venueUrl)}" target="_blank" rel="noreferrer" title="Proceedings / journal landing page">Venue</a>`
      );
    }

    const scholarUrl = safeUrl(p?.scholar?.scholar_url) || safeUrl(p?.scholar_url) || "";
    if (scholarUrl) out.push(`<a class="linkBtn" href="${escapeHtml(scholarUrl)}" target="_blank" rel="noreferrer">Scholar</a>`);

    paperLinks.innerHTML = out.join(" ");
  }

  if (paperWhy) {
    const blocks = [];

    if (p.why_it_matters) {
      blocks.push(`<div class="why">${escapeHtml(String(p.why_it_matters))}</div>`);
    }

    const contrib = normalizeArray(p.contribution_types).filter(Boolean);
    const datasets = normalizeArray(p.dataset_focus).filter(Boolean);
    const concepts = normalizeArray(p.concept_tags).filter(Boolean);

    if (contrib.length) blocks.push(renderSection("Contribution types", renderChipRow(contrib.map(toTitleCase), true)));
    if (datasets.length) blocks.push(renderSection("Dataset focus", renderChipRow(datasets)));
    if (concepts.length) blocks.push(renderSection("Concept tags", renderChipRow(concepts)));

    if (isCanonicalPreprint(p) && p.editorial_note) {
      blocks.push(`
        <div class="section">
          <div class="sectionTitle">Editorial note</div>
          <div class="smallMeta" style="margin-top:0;">${escapeHtml(String(p.editorial_note))}</div>
        </div>
      `);
    }

    paperWhy.innerHTML = blocks.join("");
  }

  // ✅ Relations polish: outgoing + incoming, title resolution, tooltips on relation types
  if (paperRelations) {
    const outgoing = Array.isArray(p.relations) ? p.relations : [];
    const incoming = state.incoming?.get(paperId) || [];

    const outgoingHtml = renderRelationsList(outgoing);
    const incomingHtml = renderRelationsList(incoming);

    paperRelations.innerHTML = `
      <div class="section" style="margin-top:0;">
        <div class="sectionTitle">Outgoing</div>
        <div class="relations">${outgoingHtml}</div>
      </div>

      <div class="section" style="margin-top:14px;">
        <div class="sectionTitle">Incoming</div>
        <div class="relations">${incomingHtml}</div>
      </div>
    `;
  }

  if (paperCiteBtn) {
    paperCiteBtn.onclick = () => openCiteModal(paperId);
  }

  setModalOpen(paperModal, true);
}

function closePaperModal() {
  state.activePaperId = null;
  setModalOpen($("paperModal"), false);
}

function bindPaperModal() {
  const paperOverlay = $("paperOverlay");
  const paperClose = $("paperClose");
  const paperClose2 = $("paperClose2");

  if (paperOverlay) paperOverlay.addEventListener("click", closePaperModal);
  if (paperClose) paperClose.addEventListener("click", closePaperModal);
  if (paperClose2) paperClose2.addEventListener("click", closePaperModal);
}

/* -------------------------
   Citations meta
------------------------- */

function renderCitationsMeta() {
  const el = $("citeMeta");
  if (!el) return;

  const m = state.citationsMeta;
  if (!m) { el.textContent = ""; return; }

  const bits = [];
  if (m.source) bits.push(`Source: ${m.source}`);
  if (m.snapshot_date || m.last_updated_utc) bits.push(`Snapshot: ${m.snapshot_date || m.last_updated_utc}`);
  if (m.note || m.notes) bits.push(m.note || m.notes);
  bits.push("Citations are context, not rank.");

  el.textContent = bits.join(" · ");
}

/* -------------------------
   Boot
------------------------- */

async function main() {
  bindNavigation();
  bindControls();
  bindListDelegation();
  bindCiteModal();
  bindPaperModal();

  // Route render (base-aware)
  const forced = window.__DL_FORCE_ROUTE__;
  if (forced) showPageByRoute(forced);
  else showPageFromLocation();

  try {
    const { papers, citationsMeta } = await loadPapersJson();
    state.papers = papers;
    state.citationsMeta = citationsMeta;
    state.byId = new Map(papers.map((p) => [p.id, p]));

    // ✅ Build incoming relations index after byId is ready (for title resolution)
    buildIncomingRelationsIndex();

    populateFilters();
    renderCitationsMeta();

    recomputeFilters();
    renderList();
  } catch (err) {
    console.error(err);
    const list = $("list");
    if (list) {
      list.innerHTML = `<div class="smallMeta">Failed to load papers: ${escapeHtml(err?.message || String(err))}</div>`;
    }
  }
}

// ESC closes modals
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  const citeOpen = $("citeModal")?.getAttribute("aria-hidden") === "false";
  const paperOpen = $("paperModal")?.getAttribute("aria-hidden") === "false";

  if (citeOpen) closeCiteModal();
  else if (paperOpen) closePaperModal();
});

main();
