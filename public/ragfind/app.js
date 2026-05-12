const state = {
  theme: localStorage.getItem("ragfind-theme") || "system",
  scopeLabel: ""
};

const themeToggleEl = document.getElementById("theme-toggle");
const heroViewEl = document.getElementById("hero-view");
const resultsViewEl = document.getElementById("results-view");
const scopeNoteEl = document.getElementById("scope-note");
const searchFormEl = document.getElementById("search-form");
const resultsSearchFormEl = document.getElementById("results-search-form");
const searchInputEl = document.getElementById("search-input");
const resultsSearchInputEl = document.getElementById("results-search-input");
const resultsMetaEl = document.getElementById("results-meta");
const resultsListEl = document.getElementById("results-list");
const emptyStateEl = document.getElementById("empty-state");

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem("ragfind-theme", theme);
  const resolved = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
  document.body.dataset.theme = resolved;
}

function toggleTheme() {
  if (state.theme === "light") {
    setTheme("dark");
    return;
  }
  if (state.theme === "dark") {
    setTheme("system");
    return;
  }
  setTheme("light");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function requestJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `request failed with status ${response.status}`);
  }
  return payload;
}

function renderScopeLabel(meta) {
  const names = Array.isArray(meta?.knowledgeBases)
    ? meta.knowledgeBases.map((knowledgeBase) => knowledgeBase.name).filter(Boolean)
    : [];
  state.scopeLabel = names.length
    ? `Suche nur in: ${names.join(", ")}`
    : "Suche nur in den fuer RAGfind konfigurierten Wissensdatenbanken";
  scopeNoteEl.textContent = state.scopeLabel;
}

function showHome() {
  heroViewEl.classList.remove("hidden");
  resultsViewEl.classList.add("hidden");
  resultsListEl.innerHTML = "";
  emptyStateEl.classList.add("hidden");
}

function renderResults(payload) {
  heroViewEl.classList.add("hidden");
  resultsViewEl.classList.remove("hidden");
  resultsSearchInputEl.value = payload.query;
  resultsMetaEl.textContent = `${payload.resultCount} Dokumenttreffer in ${payload.tookMs} ms. Suchbereich: ${(payload.searchScope.knowledgeBaseNames || []).join(", ")}.`;

  if (!payload.results.length) {
    resultsListEl.innerHTML = "";
    emptyStateEl.classList.remove("hidden");
    emptyStateEl.textContent = `Keine Treffer für „${payload.query}“ in den fuer RAGfind konfigurierten Wissensdatenbanken.`;
    return;
  }

  emptyStateEl.classList.add("hidden");
  resultsListEl.innerHTML = payload.results.map((result) => {
    const link = result.viewUrl || result.originalUrl || "#";
    const sourceLabel = result.originalName || result.sourceRef;
    const sourceBadges = [result.sourceType];
    if (result.isHtml) {
      sourceBadges.push("HTML/Webseite");
    }
    const snippets = result.snippets.map((snippet) => {
      const metaParts = [];
      if (snippet.sectionTitle) {
        metaParts.push(`Abschnitt: ${escapeHtml(snippet.sectionTitle)}`);
      } else if (snippet.sectionIndex !== null) {
        metaParts.push(`Abschnitt #${snippet.sectionIndex}`);
      }
      if (snippet.pageStart !== null) {
        metaParts.push(`Seite ${snippet.pageStart}${snippet.pageEnd && snippet.pageEnd !== snippet.pageStart ? `-${snippet.pageEnd}` : ""}`);
      }
      return `
        <div class="result-snippet">${snippet.snippet}</div>
        ${metaParts.length ? `<div class="snippet-meta">${metaParts.join(" | ")}</div>` : ""}
      `;
    }).join("");

    return `
      <article class="result-card">
        <div class="result-kicker">${escapeHtml(sourceBadges.join(" | "))} | Score ${result.score.toFixed(2)}</div>
        <a class="result-title" href="${escapeHtml(link)}" ${link !== "#" ? 'target="_blank" rel="noreferrer"' : ""}>${escapeHtml(result.title)}</a>
        <div class="result-source">${escapeHtml(sourceLabel)}</div>
        ${snippets}
      </article>
    `;
  }).join("");
}

async function performSearch(query) {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    return;
  }

  const params = new URLSearchParams({ q: trimmedQuery, topK: "12" });
  const payload = await requestJson(`/api/search?${params.toString()}`);
  renderResults(payload);

  const url = new URL(window.location.href);
  url.searchParams.set("q", trimmedQuery);
  window.history.replaceState({}, "", url);
}

async function initialize() {
  setTheme(state.theme);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") {
      setTheme("system");
    }
  });

  themeToggleEl.addEventListener("click", toggleTheme);

  const meta = await requestJson("/api/meta");
  renderScopeLabel(meta);

  const onSubmit = async (event, input) => {
    event.preventDefault();
    try {
      await performSearch(input.value);
    } catch (error) {
      resultsViewEl.classList.remove("hidden");
      heroViewEl.classList.add("hidden");
      resultsMetaEl.textContent = "";
      resultsListEl.innerHTML = "";
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.textContent = error instanceof Error ? error.message : "Suche fehlgeschlagen.";
    }
  };

  searchFormEl.addEventListener("submit", (event) => onSubmit(event, searchInputEl));
  resultsSearchFormEl.addEventListener("submit", (event) => onSubmit(event, resultsSearchInputEl));

  const initialQuery = new URL(window.location.href).searchParams.get("q");
  if (initialQuery) {
    searchInputEl.value = initialQuery;
    try {
      await performSearch(initialQuery);
    } catch (error) {
      emptyStateEl.classList.remove("hidden");
      emptyStateEl.textContent = error instanceof Error ? error.message : "Suche fehlgeschlagen.";
    }
  } else {
    showHome();
  }
}

void initialize();