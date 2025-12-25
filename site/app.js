async function fetchJSON(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to fetch ${path} (${r.status})`);
  return await r.json();
}

async function fetchYAML(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`Failed to fetch ${path} (${r.status})`);
  const text = await r.text();
  return window.jsyaml.load(text);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[c]));
}

function normalize(s) {
  return String(s ?? "").toLowerCase();
}

function tagsFromPapers(papers) {
  const set = new Set();
  for (const p of papers) for (const t of (p.tags || [])) set.add(t);
  return Array.from(set).sort((a,b) => a.localeCompare(b));
}

function sortPapers(papers, mode) {
  const arr = [...papers];
  const getC = (p) => (typeof p.citations === "number" ? p.citations : -1);
  const getY = (p) => Number(p.year || 0);

  arr.sort((a,b) => {
    if (mode === "cit_desc") return getC(b) - getC(a);
    if (mode === "cit_asc") return getC(a) - getC(b);
    if (mode === "year_desc") return getY(b) - getY(a);
    if (mode === "year_asc") return getY(a) - getY(b);
    if (mode === "title_asc") return String(a.title).localeCompare(String(b.title));
    return getC(b) - getC(a);
  });
  return arr;
}

function paperMatches(p, q, tag) {
  const hay = [
    p.title,
    (p.authors || []).join(" "),
    p.venue,
    (p.tags || []).join(" "),
  ].join(" ");
  const okQ = !q || normalize(hay).includes(normalize(q));
  const okT = !tag || (p.tags || []).includes(tag);
  return okQ && okT;
}

function linkHtml(label, url) {
  if (!url) return "";
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
}

function renderRows(papers) {
  const tbody = document.getElementById("rows");
  tbody.innerHTML = "";

  papers.forEach((p, idx) => {
    const arxiv = p.links && p.links.arxiv;
    const title = arxiv
      ? `<a href="${esc(arxiv)}" target="_blank" rel="noopener">${esc(p.title)}</a>`
      : esc(p.title);

    const citations = (typeof p.citations === "number") ? p.citations : null;
    const citationsCell = (citations === null) ? "—" : citations.toLocaleString("en-US");

    const tags = (p.tags || []).map(t => `<span class="badge">${esc(t)}</span>`).join("");

    const links = [];
    if (p.links && p.links.arxiv) links.push(linkHtml("arXiv", p.links.arxiv));
    if (p.links && p.links.doi) links.push(linkHtml("DOI", p.links.doi));
    if (p.links && p.links.pdf) links.push(linkHtml("PDF", p.links.pdf));
    const scholarUrl = (p.scholar && p.scholar.scholar_url) || p.scholar_url || "";
    if (scholarUrl) links.push(linkHtml("Scholar", scholarUrl));
    const linksCell = links.length ? links.join(" · ") : "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${title}</td>
      <td>${esc(p.year)}</td>
      <td>${esc(p.venue || "")}</td>
      <td class="num">${citationsCell}</td>
      <td>${tags}</td>
      <td>${linksCell}</td>
    `;
    tbody.appendChild(tr);
  });
}

function setStatus(text) {
  document.getElementById("status").textContent = text || "";
}

async function main() {
  try {
    setStatus("Loading data...");

    // These are copied into site/data/ by the Pages workflow below.
    const [citations, papersYaml] = await Promise.all([
      fetchJSON("./data/citations.json"),
      fetchYAML("./data/papers.yaml"),
    ]);

    const last = citations.meta && citations.meta.last_updated_utc;
    document.getElementById("lastUpdated").textContent = last ? ` • Last updated (UTC): ${last}` : "";

    // Try to guess repo URL from location (works on Pages)
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const repoName = pathParts.length ? pathParts[0] : "";
    const repoUrl = repoName ? `https://github.com/${window.location.hostname.split(".")[0]}/${repoName}` : "#";
    document.getElementById("repoLink").href = repoUrl;

    const snap = (citations.papers || {});
    const papers = (papersYaml.papers || []).map(p => {
      const pid = p.id;
      const c = snap[pid] || {};
      return {
        ...p,
        citations: Number.isFinite(c.citations) ? c.citations : null,
        last_checked_utc: c.last_checked_utc || null,
        scholar_url: c.resolved_url || c.scholar_url || null,
      };
    });

    // Populate tag dropdown
    const tagSel = document.getElementById("tag");
    const tags = tagsFromPapers(papers);
    tagSel.innerHTML = `<option value="">All tags</option>` +
      tags.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("");

    const q = document.getElementById("q");
    const sort = document.getElementById("sort");
    const reset = document.getElementById("reset");

    function rerender() {
      const qv = q.value.trim();
      const tv = tagSel.value;
      const sv = sort.value;

      let filtered = papers.filter(p => paperMatches(p, qv, tv));
      filtered = sortPapers(filtered, sv);

      renderRows(filtered);
      setStatus(`${filtered.length} / ${papers.length} papers shown`);
    }

    q.addEventListener("input", rerender);
    tagSel.addEventListener("change", rerender);
    sort.addEventListener("change", rerender);
    reset.addEventListener("click", () => {
      q.value = "";
      tagSel.value = "";
      sort.value = "cit_desc";
      rerender();
    });

    rerender();
  } catch (e) {
    console.error(e);
    setStatus(`Error: ${e.message}`);
  }
}

main();
