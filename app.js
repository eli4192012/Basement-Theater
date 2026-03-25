const state = {
  catalog: null,
  review: { items: [], totalCandidates: 0 },
  trash: { items: [], totalCandidates: 0 },
  activeCategory: "All",
  activeLetter: "All",
  query: "",
  featuredIndex: 0,
  activeView: "library",
};

const els = {
  rows: document.querySelector("#rows"),
  reviewGrid: document.querySelector("#reviewGrid"),
  trashGrid: document.querySelector("#trashGrid"),
  reviewCount: document.querySelector("#reviewCount"),
  trashCount: document.querySelector("#trashCount"),
  searchInput: document.querySelector("#searchInput"),
  genreChips: document.querySelector("#genreChips"),
  letterChips: document.querySelector("#letterChips"),
  resultsHeading: document.querySelector("#resultsHeading"),
  resultsCount: document.querySelector("#resultsCount"),
  heroPanel: document.querySelector("#heroPanel"),
  heroTitle: document.querySelector("#heroTitle"),
  heroMeta: document.querySelector("#heroMeta"),
  heroDescription: document.querySelector("#heroDescription"),
  heroPlay: document.querySelector("#heroPlay"),
  heroInfo: document.querySelector("#heroInfo"),
  heroArt: document.querySelector("#heroArt"),
  randomPickButton: document.querySelector("#randomPickButton"),
  detailModal: document.querySelector("#detailModal"),
  detailTitle: document.querySelector("#detailTitle"),
  detailMeta: document.querySelector("#detailMeta"),
  detailDescription: document.querySelector("#detailDescription"),
  detailOpen: document.querySelector("#detailOpen"),
  detailPreview: document.querySelector("#detailPreview"),
  detailArt: document.querySelector("#detailArt"),
  libraryView: document.querySelector("#libraryView"),
  reviewView: document.querySelector("#reviewView"),
  trashView: document.querySelector("#trashView"),
  libraryTabButton: document.querySelector("#libraryTabButton"),
  reviewTabButton: document.querySelector("#reviewTabButton"),
  trashTabButton: document.querySelector("#trashTabButton"),
};

const palette = [
  ["#6f1317", "#151515"],
  ["#b20710", "#1b1b1b"],
  ["#2d3d63", "#141414"],
  ["#7a1e2d", "#171717"],
  ["#7f2f16", "#111827"],
  ["#1d4f63", "#151515"],
  ["#144030", "#151515"],
  ["#4d1837", "#161616"],
];

init();

async function init() {
  const [catalogResponse, reviewResponse, trashResponse] = await Promise.all([
    fetch("./data/catalog.json"),
    fetch("./data/wikipedia-review.json").catch(() => null),
    fetch("./data/trash-review.json").catch(() => null),
  ]);

  state.catalog = await catalogResponse.json();
  if (reviewResponse && reviewResponse.ok) {
    state.review = await reviewResponse.json();
  }
  if (trashResponse && trashResponse.ok) {
    state.trash = await trashResponse.json();
  }

  bindEvents();
  renderHero();
  renderChips();
  renderLetterChips();
  renderRows();
  renderReview();
  renderTrash();
  syncView();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    if (state.activeView === "library") {
      renderRows();
    } else if (state.activeView === "review") {
      renderReview();
    } else {
      renderTrash();
    }
  });

  els.randomPickButton.addEventListener("click", () => {
    if (state.activeView !== "library") return;
    const items = getFilteredItems();
    if (!items.length) return;
    const randomItem = items[Math.floor(Math.random() * items.length)];
    setHero(randomItem);
    openModal(randomItem);
  });

  els.heroInfo.addEventListener("click", () => {
    const heroItem = getHeroItem();
    if (heroItem) openModal(heroItem);
  });

  els.libraryTabButton.addEventListener("click", () => {
    state.activeView = "library";
    syncView();
  });

  els.reviewTabButton.addEventListener("click", () => {
    state.activeView = "review";
    syncView();
  });

  els.trashTabButton.addEventListener("click", () => {
    state.activeView = "trash";
    syncView();
  });

  els.detailModal.addEventListener("click", (event) => {
    const rect = els.detailModal.getBoundingClientRect();
    const inDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;

    if (!inDialog) {
      els.detailModal.close();
    }
  });
}

function syncView() {
  const reviewing = state.activeView === "review";
  const trashing = state.activeView === "trash";
  const library = state.activeView === "library";

  els.libraryView.classList.toggle("hidden-view", !library);
  els.reviewView.classList.toggle("hidden-view", !reviewing);
  els.trashView.classList.toggle("hidden-view", !trashing);
  els.libraryTabButton.classList.toggle("active", library);
  els.reviewTabButton.classList.toggle("active", reviewing);
  els.trashTabButton.classList.toggle("active", trashing);
  els.randomPickButton.disabled = !library;
  els.randomPickButton.classList.toggle("disabled-button", !library);

  if (library) {
    renderRows();
  } else if (reviewing) {
    renderReview();
  } else {
    renderTrash();
  }
}

function getFilteredItems() {
  const items = state.catalog?.items ?? [];

  return items.filter((item) => {
    const matchesCategory = state.activeCategory === "All" || item.category === state.activeCategory;
    const matchesLetter = state.activeLetter === "All" || normalizedFirstCharacter(item.title) === state.activeLetter;
    const haystack = `${item.title} ${item.rawTitle} ${item.category}`.toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesCategory && matchesLetter && matchesQuery;
  });
}

function getReviewItems() {
  const items = state.review?.items ?? [];
  return items.filter((item) => {
    const haystack = `${item.title} ${item.wikipediaTitle} ${item.category}`.toLowerCase();
    return !state.query || haystack.includes(state.query);
  });
}

function getTrashItems() {
  const items = state.trash?.items ?? [];
  return items.filter((item) => {
    const haystack = `${item.title} ${item.reason} ${item.category}`.toLowerCase();
    return !state.query || haystack.includes(state.query);
  });
}

function getHeroItem() {
  const preferred = state.catalog?.featured ?? [];
  const items = state.catalog?.items ?? [];
  const title = preferred[state.featuredIndex % Math.max(preferred.length, 1)];
  return items.find((item) => item.title === title) ?? items[0];
}

function renderHero() {
  const heroItem = getHeroItem();
  if (heroItem) setHero(heroItem);
}

function setHero(item) {
  const gradient = gradientFor(item.title);
  els.heroPanel.style.setProperty("--hero-gradient", gradient);
  els.heroArt.style.setProperty("--hero-gradient", gradient);
  els.heroArt.style.setProperty("--hero-image", item.backdropUrl ? `url("${item.backdropUrl}")` : "none");
  els.detailArt.style.setProperty("--detail-gradient", gradient);
  els.detailArt.style.setProperty("--detail-image", item.posterUrl ? `url("${item.posterUrl}")` : "none");
  els.heroTitle.textContent = item.title;
  els.heroMeta.textContent = `${item.category} • ${item.type === "series" ? "Series" : "Movie"}${item.year ? ` • ${item.year}` : ""}`;
  els.heroDescription.textContent = buildDescription(item);
  els.heroPlay.href = item.url;
  els.heroInfo.dataset.title = item.title;
}

function renderChips() {
  const categories = ["All", ...(state.catalog?.categories ?? [])];
  els.genreChips.innerHTML = categories
    .map(
      (category) => `
        <button
          type="button"
          class="chip ${category === state.activeCategory ? "active" : ""}"
          data-category="${escapeHtml(category)}"
        >
          ${escapeHtml(category)}
        </button>
      `,
    )
    .join("");

  els.genreChips.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategory = button.dataset.category;
      renderChips();
      renderRows();
    });
  });
}

function renderLetterChips() {
  const letters = ["All", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"];
  els.letterChips.innerHTML = letters
    .map(
      (letter) => `
        <button
          type="button"
          class="chip letter-chip ${letter === state.activeLetter ? "active" : ""}"
          data-letter="${escapeHtml(letter)}"
        >
          ${escapeHtml(letter)}
        </button>
      `,
    )
    .join("");

  els.letterChips.querySelectorAll(".letter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeLetter = button.dataset.letter;
      renderLetterChips();
      renderRows();
    });
  });
}

function renderRows() {
  const filtered = getFilteredItems();
  const grouped = filtered.reduce((map, item) => {
    map[item.category] ||= [];
    map[item.category].push(item);
    return map;
  }, {});

  const categories = Object.keys(grouped);
  const heading = state.activeCategory === "All" ? "All titles" : state.activeCategory;
  const suffix = state.activeLetter === "All" ? "" : ` • ${state.activeLetter}`;
  els.resultsHeading.textContent = `${heading}${suffix}`;
  els.resultsCount.textContent = `${filtered.length} title${filtered.length === 1 ? "" : "s"}`;

  if (!categories.length) {
    els.rows.innerHTML = `<div class="empty-state">No titles match that search yet. Try a different category or keyword.</div>`;
    return;
  }

  els.rows.innerHTML = categories
    .map((category) => {
      const cards = grouped[category]
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(renderCard)
        .join("");

      return `
        <section class="row">
          <div class="row-header">
            <h4>${escapeHtml(category)}</h4>
            <p class="results-count">${grouped[category].length} titles</p>
          </div>
          <div class="row-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  els.rows.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => {
      const item = state.catalog.items.find((entry) => entry.url === card.dataset.url);
      if (!item) return;
      setHero(item);
      openModal(item);
    });
  });
}

function renderReview() {
  const items = getReviewItems();
  els.reviewCount.textContent = `${items.length} candidate${items.length === 1 ? "" : "s"}`;

  if (!items.length) {
    els.reviewGrid.innerHTML = `<div class="empty-state">No Wikipedia review candidates match that search.</div>`;
    return;
  }

  els.reviewGrid.innerHTML = items
    .map(
      (item) => `
        <article class="review-card">
          <div class="review-image" style='background-image:url("${escapeHtml(item.posterUrl)}")'></div>
          <div class="review-body">
            <div class="review-title">${escapeHtml(item.title)}</div>
            <div class="review-meta">${escapeHtml(item.category)}${item.year ? ` • ${item.year}` : ""}</div>
            <div class="review-meta">Wikipedia match: ${escapeHtml(item.wikipediaTitle || "Unknown")}</div>
            <div class="review-meta">Confidence: ${escapeHtml(String(item.score ?? ""))}</div>
            <div class="review-actions">
              <a class="ghost-button review-link" href="${escapeHtml(item.wikipediaUrl || "#")}" target="_blank" rel="noreferrer">Open Wikipedia</a>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTrash() {
  const items = getTrashItems();
  els.trashCount.textContent = `${items.length} candidate${items.length === 1 ? "" : "s"}`;

  if (!items.length) {
    els.trashGrid.innerHTML = `<div class="empty-state">No trash review candidates match that search.</div>`;
    return;
  }

  els.trashGrid.innerHTML = items
    .map(
      (item) => `
        <article class="review-card">
          <div class="review-body">
            <div class="review-title">${escapeHtml(item.title)}</div>
            <div class="review-meta">${escapeHtml(item.category)}${item.year ? ` • ${item.year}` : ""}</div>
            <div class="review-meta">Reason: ${escapeHtml(item.reason || "Unknown")}</div>
            <div class="review-meta">Status: ${escapeHtml(String(item.httpStatus ?? "n/a"))}</div>
            <div class="review-actions">
              <a class="ghost-button review-link" href="${escapeHtml(item.checkedUrl || item.url || "#")}" target="_blank" rel="noreferrer">Open Checked Link</a>
            </div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderCard(item) {
  const gradient = gradientFor(item.title);
  return `
    <article class="card" data-url="${escapeHtml(item.url)}" tabindex="0">
      <div class="card-poster" style='--card-gradient:${gradient};--card-image:${item.posterUrl ? `url("${escapeHtml(item.posterUrl)}")` : "none"}'>
        <div>
          <span class="card-kicker">${item.type === "series" ? "Series" : "Movie"}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        <div class="card-meta">${escapeHtml(item.category)}${item.year ? ` • ${item.year}` : ""}</div>
      </div>
    </article>
  `;
}

function openModal(item) {
  const gradient = gradientFor(item.title);
  els.detailArt.style.setProperty("--detail-gradient", gradient);
  els.detailTitle.textContent = item.title;
  els.detailMeta.textContent = `${item.category} • ${item.type === "series" ? "Series or folder" : "Movie"}${item.year ? ` • ${item.year}` : ""}`;
  els.detailDescription.textContent = buildDescription(item);
  els.detailOpen.href = item.url;
  els.detailPreview.href = item.previewUrl || item.url;
  els.detailPreview.style.display = item.previewUrl ? "inline-flex" : "none";
  if (!els.detailModal.open) {
    els.detailModal.showModal();
  }
}

function gradientFor(seedText) {
  const total = [...seedText].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [start, end] = palette[total % palette.length];
  return `linear-gradient(135deg, ${start}, ${end})`;
}

function buildDescription(item) {
  const mode = item.type === "series"
    ? "Open the collection in Google Drive and jump into the folder like a streaming season shelf."
    : "Launch this title in Google Drive from your Basement Theater streaming library.";
  return `${mode} Curated from the "${item.category}" section of your catalog.`;
}

function normalizedFirstCharacter(title) {
  const first = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
