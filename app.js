const STORAGE_KEYS = {
  profiles: "basement-theater.profiles",
  activeProfileId: "basement-theater.active-profile-id",
  progress: "basement-theater.progress",
  favorites: "basement-theater.favorites",
  watchlist: "basement-theater.watchlist",
  history: "basement-theater.history",
  welcomeSeen: "basement-theater.welcome-seen",
};

const DEFAULT_PROFILES = [
  { id: "kid-1", name: "Kid 1", maturity: "PG", color: "#ff7b72" },
  { id: "kid-2", name: "Kid 2", maturity: "PG", color: "#6ee7b7" },
  { id: "teen", name: "Teen", maturity: "PG-13", color: "#60a5fa" },
  { id: "adult", name: "Adults", maturity: "R", color: "#f59e0b" },
];

const MATURITY_ORDER = { G: 0, PG: 1, "PG-13": 2, R: 3 };

const state = {
  catalog: null,
  trash: { items: [], totalCandidates: 0 },
  auth: {
    token: sessionStorage.getItem("basement-theater.google-token") || "",
    user: loadJson("basement-theater.google-user", null),
    config: null,
  },
  profiles: loadJson(STORAGE_KEYS.profiles, DEFAULT_PROFILES),
  activeProfileId: localStorage.getItem(STORAGE_KEYS.activeProfileId) || DEFAULT_PROFILES[0].id,
  progress: loadJson(STORAGE_KEYS.progress, {}),
  favorites: loadJson(STORAGE_KEYS.favorites, {}),
  watchlist: loadJson(STORAGE_KEYS.watchlist, {}),
  history: loadJson(STORAGE_KEYS.history, {}),
  activeCategory: "All",
  activeLetter: "All",
  query: "",
  featuredIndex: 0,
  activeView: "library",
  surpriseMode: "all",
  editingProfileName: false,
};

const els = {
  authGate: document.querySelector("#authGate"),
  authMessage: document.querySelector("#authMessage"),
  googleSignInButton: document.querySelector("#googleSignInButton"),
  rows: document.querySelector("#rows"),
  favoritesRows: document.querySelector("#favoritesRows"),
  trashGrid: document.querySelector("#trashGrid"),
  favoritesCount: document.querySelector("#favoritesCount"),
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
  welcomeModal: document.querySelector("#welcomeModal"),
  detailTitle: document.querySelector("#detailTitle"),
  detailMeta: document.querySelector("#detailMeta"),
  detailDescription: document.querySelector("#detailDescription"),
  detailOpen: document.querySelector("#detailOpen"),
  detailPreview: document.querySelector("#detailPreview"),
  detailArt: document.querySelector("#detailArt"),
  libraryView: document.querySelector("#libraryView"),
  favoritesView: document.querySelector("#favoritesView"),
  trashView: document.querySelector("#trashView"),
  libraryTabButton: document.querySelector("#libraryTabButton"),
  favoritesTabButton: document.querySelector("#favoritesTabButton"),
  trashTabButton: document.querySelector("#trashTabButton"),
  detailActions: document.querySelector(".detail-actions"),
  topbarActions: document.querySelector(".topbar-actions"),
  welcomeDismissButton: document.querySelector("#welcomeDismissButton"),
  surpriseButtons: document.querySelectorAll("[data-surprise-mode]"),
  statsPanel: document.querySelector("#statsPanel"),
  statsMostWatched: document.querySelector("#statsMostWatched"),
  statsKidPrefs: document.querySelector("#statsKidPrefs"),
  statsTotalHours: document.querySelector("#statsTotalHours"),
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
  ensureActiveProfile();
  buildProfileBar();
  bindEvents();
  await bootstrapAuth();
}

async function bootstrapAuth() {
  setAuthMessage("Checking access setup...");
  try {
    state.auth.config = await fetchJson("/api/config");
  } catch {
    setAuthMessage("Could not load the sign-in setup. Try refreshing in a moment.");
    return;
  }

  if (!state.auth.config?.googleClientId) {
    setAuthMessage("Google sign-in is not configured yet. Add the Google client ID in Vercel to turn on private access.");
    return;
  }

  if (state.auth.token) {
    const verified = await verifyAccess(state.auth.token);
    if (verified) {
      await loadProtectedData();
      return;
    }
  }

  setAuthMessage("Sign in with an approved Google account to open the theater.");
  renderGoogleSignIn();
}

async function loadProtectedData() {
  const [catalog, trash] = await Promise.all([
    authedFetchJson("/api/catalog"),
    authedFetchJson("/api/trash").catch(() => ({ items: [], totalCandidates: 0 })),
  ]);
  state.catalog = catalog;
  state.trash = trash;
  els.authGate.classList.add("hidden");
  renderAll();
}

function renderGoogleSignIn() {
  if (!window.google?.accounts?.id) {
    window.setTimeout(renderGoogleSignIn, 300);
    return;
  }

  els.googleSignInButton.innerHTML = "";
  window.google.accounts.id.initialize({
    client_id: state.auth.config.googleClientId,
    callback: async (response) => {
      setAuthMessage("Checking your access...");
      const verified = await verifyAccess(response.credential);
      if (!verified) return;
      await loadProtectedData();
    },
  });
  window.google.accounts.id.renderButton(els.googleSignInButton, {
    theme: "outline",
    size: "large",
    shape: "pill",
    width: 280,
    text: "signin_with",
  });
}

async function verifyAccess(token) {
  try {
    const result = await fetchJson("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: token }),
    });
    state.auth.token = token;
    state.auth.user = result.user;
    sessionStorage.setItem("basement-theater.google-token", token);
    localStorage.setItem("basement-theater.google-user", JSON.stringify(result.user));
    return true;
  } catch (error) {
    state.auth.token = "";
    state.auth.user = null;
    sessionStorage.removeItem("basement-theater.google-token");
    localStorage.removeItem("basement-theater.google-user");
    setAuthMessage(error.message || "That account is not approved for Basement Theater.");
    return false;
  }
}

async function authedFetchJson(url) {
  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${state.auth.token}`,
    },
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function setAuthMessage(message) {
  els.authMessage.textContent = message;
}

function renderAll() {
  renderHero();
  renderProfiles();
  renderChips();
  renderLetterChips();
  updateSurpriseButtons();
  renderRows();
  renderFavorites();
  renderTrash();
  renderStats();
  syncView();
  maybeShowWelcome();
}

function buildProfileBar() {
  const profileBar = document.createElement("div");
  profileBar.className = "profile-bar";
  profileBar.innerHTML = `
    <div class="profile-section">
      <div>
        <p class="eyebrow">Profiles</p>
        <div id="profileList" class="profile-list"></div>
      </div>
      <div class="profile-section-right">
        <div class="profile-meta">
          <input id="activeProfileName" class="profile-name-input" type="text" maxlength="24" readonly aria-label="Active profile name" />
          <span id="activeProfileGate" class="profile-gate"></span>
        </div>
        <button id="renameProfileButton" class="ghost-button rename-profile-button" type="button">Rename</button>
      </div>
    </div>
  `;
  els.topbarActions.parentNode.insertAdjacentElement("afterend", profileBar);
  els.profileList = document.querySelector("#profileList");
  els.activeProfileName = document.querySelector("#activeProfileName");
  els.activeProfileGate = document.querySelector("#activeProfileGate");
  els.renameProfileButton = document.querySelector("#renameProfileButton");
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    rerenderActiveView();
  });

  els.renameProfileButton.addEventListener("click", () => {
    if (state.editingProfileName) saveActiveProfileName();
    else startProfileRename();
  });
  els.activeProfileName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveActiveProfileName();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelActiveProfileRename();
    }
  });
  els.activeProfileName.addEventListener("blur", () => {
    if (state.editingProfileName) saveActiveProfileName();
  });

  els.randomPickButton.addEventListener("click", () => runSurprise(state.surpriseMode));
  els.heroPlay.addEventListener("click", () => {
    const heroItem = getHeroItem();
    if (heroItem) markWatched(heroItem);
  });
  els.heroInfo.addEventListener("click", () => {
    const heroItem = getHeroItem();
    if (heroItem) openModal(heroItem);
  });

  els.libraryTabButton.addEventListener("click", () => setView("library"));
  els.favoritesTabButton.addEventListener("click", () => setView("favorites"));
  els.trashTabButton.addEventListener("click", () => setView("trash"));

  els.surpriseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.surpriseMode = button.dataset.surpriseMode;
      updateSurpriseButtons();
      runSurprise(state.surpriseMode);
    });
  });

  els.detailModal.addEventListener("click", (event) => {
    const rect = els.detailModal.getBoundingClientRect();
    const inDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!inDialog) els.detailModal.close();
  });

  els.welcomeModal?.addEventListener("close", dismissWelcome);
  els.welcomeDismissButton?.addEventListener("click", dismissWelcome);
}

function setView(view) {
  state.activeView = view;
  syncView();
}

function syncView() {
  const favorites = state.activeView === "favorites";
  const trashing = state.activeView === "trash";
  const library = state.activeView === "library";

  els.libraryView.classList.toggle("hidden-view", !library);
  els.favoritesView.classList.toggle("hidden-view", !favorites);
  els.trashView.classList.toggle("hidden-view", !trashing);
  els.libraryTabButton.classList.toggle("active", library);
  els.favoritesTabButton.classList.toggle("active", favorites);
  els.trashTabButton.classList.toggle("active", trashing);
  els.randomPickButton.disabled = !library;
  els.randomPickButton.classList.toggle("disabled-button", !library);
  if (library) renderRows();
  if (favorites) renderFavorites();
  if (trashing) renderTrash();
}

function rerenderActiveView() {
  renderStats();
  renderProfiles();
  if (state.activeView === "library") {
    renderHero();
    renderRows();
  } else if (state.activeView === "favorites") {
    renderFavorites();
  } else {
    renderTrash();
  }
}

function getActiveProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) || state.profiles[0];
}

function startProfileRename() {
  const active = getActiveProfile();
  if (!active) return;
  state.editingProfileName = true;
  els.activeProfileName.readOnly = false;
  els.activeProfileName.focus();
  els.activeProfileName.select();
  els.renameProfileButton.textContent = "Save";
}

function saveActiveProfileName() {
  const active = getActiveProfile();
  if (!active) return;

  const cleaned = els.activeProfileName.value.trim().replace(/\s+/g, " ").slice(0, 24);
  active.name = cleaned || active.name;
  persistState(STORAGE_KEYS.profiles, state.profiles);
  finishProfileRename();
  rerenderActiveView();
}

function cancelActiveProfileRename() {
  const active = getActiveProfile();
  if (!active) return;
  els.activeProfileName.value = active.name;
  finishProfileRename();
}

function finishProfileRename() {
  state.editingProfileName = false;
  els.activeProfileName.readOnly = true;
  els.renameProfileButton.textContent = "Rename";
}

function ensureActiveProfile() {
  if (!state.profiles.some((profile) => profile.id === state.activeProfileId)) {
    state.activeProfileId = state.profiles[0].id;
  }
}

function renderProfiles() {
  const active = getActiveProfile();
  els.profileList.innerHTML = state.profiles
    .map(
      (profile) => `
        <button type="button" class="profile-pill ${profile.id === active.id ? "active" : ""}" data-profile-id="${escapeHtml(profile.id)}" style="--profile-color:${profile.color}">
          <span class="profile-dot"></span>
          <span>${escapeHtml(profile.name)}</span>
        </button>
      `,
    )
    .join("");

  els.profileList.querySelectorAll(".profile-pill").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeProfileId = button.dataset.profileId;
      localStorage.setItem(STORAGE_KEYS.activeProfileId, state.activeProfileId);
      rerenderActiveView();
    });
  });

  els.activeProfileName.value = active.name;
  els.activeProfileGate.textContent = `Allowed: ${active.maturity}`;
  els.renameProfileButton.textContent = state.editingProfileName ? "Save" : "Rename";
}

function getAllowedItems(items, profile = getActiveProfile()) {
  return items.filter((item) => MATURITY_ORDER[inferRating(item)] <= MATURITY_ORDER[profile.maturity]);
}

function isFavoriteItem(item, profile = getActiveProfile()) {
  return Boolean(state.favorites[profile.id]?.[item.url]);
}

function getLibraryItems() {
  const active = getActiveProfile();
  return getAllowedItems(state.catalog?.items ?? [], active).filter((item) => !isFavoriteItem(item, active));
}

function getFilteredItems() {
  const items = getLibraryItems();
  return items.filter((item) => {
    const matchesCategory = state.activeCategory === "All" || item.category === state.activeCategory;
    const matchesLetter = state.activeLetter === "All" || normalizedFirstCharacter(item.title) === state.activeLetter;
    const haystack = `${item.title} ${item.rawTitle} ${item.category}`.toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesCategory && matchesLetter && matchesQuery;
  });
}

function getContinueWatchingItems() {
  const active = getActiveProfile();
  const watched = state.progress[active.id] || {};
  const items = getLibraryItems();
  return items.filter((item) => watched[item.url]).sort((a, b) => watched[b.url] - watched[a.url]).slice(0, 12);
}

function getFavoriteItems() {
  const active = getActiveProfile();
  const favorites = state.favorites[active.id] || {};
  const items = getAllowedItems(state.catalog?.items ?? []);
  return items.filter((item) => favorites[item.url]);
}

function getWatchlistItems() {
  const active = getActiveProfile();
  const watchlist = state.watchlist[active.id] || {};
  const items = getLibraryItems();
  return items.filter((item) => watchlist[item.url]).slice(0, 12);
}

function getRecentlyWatchedItems() {
  const active = getActiveProfile();
  const history = state.history[active.id] || [];
  const items = getLibraryItems();
  return history.map((entry) => items.find((item) => item.url === entry.url)).filter(Boolean).slice(0, 12);
}

function sortItemsByCover(items) {
  return items.slice().sort((a, b) => {
    const aHasCover = Number(Boolean(a.posterUrl || a.backdropUrl));
    const bHasCover = Number(Boolean(b.posterUrl || b.backdropUrl));
    if (aHasCover !== bHasCover) return bHasCover - aHasCover;
    return a.title.localeCompare(b.title);
  });
}

function getTrashItems() {
  return (state.trash?.items ?? []).filter((item) => {
    const haystack = `${item.title} ${item.reason} ${item.category}`.toLowerCase();
    return !state.query || haystack.includes(state.query);
  });
}

function getHeroItem() {
  const preferred = state.catalog?.featured ?? [];
  const items = getLibraryItems();
  const coveredItems = items.filter((item) => item.posterUrl || item.backdropUrl);
  const pool = coveredItems.length ? coveredItems : items;
  const title = preferred[state.featuredIndex % Math.max(preferred.length, 1)];
  return pool.find((item) => item.title === title && (item.posterUrl || item.backdropUrl)) ?? pool[0];
}

function renderHero() {
  const heroItem = getHeroItem();
  if (!heroItem) return;
  const gradient = gradientFor(heroItem.title);
  els.heroPanel.style.setProperty("--hero-gradient", gradient);
  els.heroArt.style.setProperty("--hero-gradient", gradient);
  els.heroArt.style.setProperty("--hero-image", heroItem.backdropUrl ? `url("${heroItem.backdropUrl}")` : "none");
  els.detailArt.style.setProperty("--detail-gradient", gradient);
  els.detailArt.style.setProperty("--detail-image", heroItem.posterUrl ? `url("${heroItem.posterUrl}")` : "none");
  els.heroTitle.textContent = heroItem.title;
  els.heroMeta.textContent = `${heroItem.category} • ${heroItem.type === "series" ? "Series" : "Movie"} • ${inferRating(heroItem)}${heroItem.year ? ` • ${heroItem.year}` : ""}`;
  els.heroDescription.textContent = heroItem.overview || buildDescription(heroItem);
  els.heroPlay.href = heroItem.url;
}

function renderChips() {
  const categories = ["All", ...(state.catalog?.categories ?? [])];
  els.genreChips.innerHTML = categories.map((category) => `<button type="button" class="chip ${category === state.activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
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
  els.letterChips.innerHTML = letters.map((letter) => `<button type="button" class="chip letter-chip ${letter === state.activeLetter ? "active" : ""}" data-letter="${escapeHtml(letter)}">${escapeHtml(letter)}</button>`).join("");
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

  const specialRows = [];
  const continueWatching = getContinueWatchingItems();
  if (continueWatching.length) specialRows.push(renderCustomRow("Continue Watching", continueWatching));
  const watchlist = getWatchlistItems();
  if (watchlist.length) specialRows.push(renderCustomRow("My Watchlist", watchlist));
  const recentlyWatched = getRecentlyWatchedItems();
  if (recentlyWatched.length) specialRows.push(renderCustomRow("Recently Watched", recentlyWatched));

  const heading = state.activeCategory === "All" ? "All titles" : state.activeCategory;
  const suffix = state.activeLetter === "All" ? "" : ` • ${state.activeLetter}`;
  els.resultsHeading.textContent = `${heading}${suffix}`;
  els.resultsCount.textContent = `${filtered.length} title${filtered.length === 1 ? "" : "s"}`;

  const categoryRows = Object.keys(grouped)
    .map((category) => {
      const cards = sortItemsByCover(grouped[category]).map(renderCard).join("");
      return `<section class="row"><div class="row-header"><h4>${escapeHtml(category)}</h4><p class="results-count">${grouped[category].length} titles</p></div><div class="row-grid">${cards}</div></section>`;
    })
    .join("");

  els.rows.innerHTML = specialRows.length || categoryRows ? `${specialRows.join("")}${categoryRows}` : `<div class="empty-state">No titles match that search yet. Try a different category or keyword.</div>`;
  bindCardInteractions(els.rows);
}

function renderCustomRow(title, items) {
  return `<section class="row"><div class="row-header"><h4>${escapeHtml(title)}</h4><p class="results-count">${items.length} titles</p></div><div class="row-grid">${sortItemsByCover(items).map(renderCard).join("")}</div></section>`;
}

function renderFavorites() {
  const items = getFavoriteItems().filter((item) => {
    const haystack = `${item.title} ${item.rawTitle} ${item.category}`.toLowerCase();
    return !state.query || haystack.includes(state.query);
  });

  els.favoritesCount.textContent = `${items.length} title${items.length === 1 ? "" : "s"}`;
  if (!items.length) {
    els.favoritesRows.innerHTML = `<div class="empty-state">No favorites yet for ${escapeHtml(getActiveProfile().name)}. Tap the star on any title to move it here.</div>`;
    return;
  }

  const grouped = items.reduce((map, item) => {
    map[item.category] ||= [];
    map[item.category].push(item);
    return map;
  }, {});

  els.favoritesRows.innerHTML = Object.keys(grouped)
    .map((category) => {
      const cards = sortItemsByCover(grouped[category]).map(renderCard).join("");
      return `<section class="row"><div class="row-header"><h4>${escapeHtml(category)}</h4><p class="results-count">${grouped[category].length} titles</p></div><div class="row-grid">${cards}</div></section>`;
    })
    .join("");

  bindCardInteractions(els.favoritesRows);
}

function renderStats() {
  const active = getActiveProfile();
  const history = state.history[active.id] || [];
  const counts = history.reduce((map, entry) => {
    map[entry.title] = (map[entry.title] || 0) + 1;
    return map;
  }, {});
  const mostWatched = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, count]) => `${title} (${count})`).join(", ") || "No watches yet";
  const kidProfiles = state.profiles.filter((profile) => profile.maturity !== "R");
  const kidSummary = kidProfiles.map((profile) => {
    const kidHistory = state.history[profile.id] || [];
    const top = kidHistory[0]?.title || "Nothing yet";
    return `${profile.name}: ${top}`;
  }).join(" • ");
  const totalMinutes = history.reduce((sum, entry) => sum + (entry.runtime || 95), 0);
  els.statsMostWatched.textContent = mostWatched;
  els.statsKidPrefs.textContent = kidSummary || "No kid profile activity yet";
  els.statsTotalHours.textContent = `${(totalMinutes / 60).toFixed(1)} hrs`;
}

function renderTrash() {
  const items = getTrashItems();
  els.trashCount.textContent = `${items.length} candidate${items.length === 1 ? "" : "s"}`;
  els.trashGrid.innerHTML = items.length ? items.map(renderTrashCard).join("") : `<div class="empty-state">No trash review candidates match that search.</div>`;
}

function renderTrashCard(item) {
  return `<article class="review-card"><div class="review-body"><div class="review-title">${escapeHtml(item.title)}</div><div class="review-meta">${escapeHtml(item.category)}${item.year ? ` • ${item.year}` : ""}</div><div class="review-meta">Reason: ${escapeHtml(item.reason || "Unknown")}</div><div class="review-meta">Status: ${escapeHtml(String(item.httpStatus ?? "n/a"))}</div><div class="review-actions"><a class="ghost-button review-link" href="${escapeHtml(item.checkedUrl || item.url || "#")}" target="_blank" rel="noreferrer">Open Checked Link</a></div></div></article>`;
}

function bindCardInteractions(container) {
  container.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => {
      const item = state.catalog.items.find((entry) => entry.url === card.dataset.url);
      if (item) openModal(item);
    });
  });
  container.querySelectorAll(".favorite-button").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleFavorite(button.dataset.url);
  }));
  container.querySelectorAll(".watchlist-button").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleWatchlist(button.dataset.url);
  }));
}

function renderCard(item) {
  const gradient = gradientFor(item.title);
  const active = getActiveProfile();
  const isFavorite = Boolean(state.favorites[active.id]?.[item.url]);
  const inWatchlist = Boolean(state.watchlist[active.id]?.[item.url]);
  const progress = state.progress[active.id]?.[item.url];
  return `
    <article class="card" data-url="${escapeHtml(item.url)}" tabindex="0">
      <div class="card-poster" style='--card-gradient:${gradient};--card-image:${item.posterUrl ? `url("${escapeHtml(item.posterUrl)}")` : "none"}'>
        <div class="card-topline">
          <span class="card-kicker">${item.type === "series" ? "Series" : "Movie"}</span>
          <div class="card-icon-row">
            <button class="watchlist-button ${inWatchlist ? "active" : ""}" data-url="${escapeHtml(item.url)}" type="button" aria-label="Toggle watchlist">+</button>
            <button class="favorite-button ${isFavorite ? "active" : ""}" data-url="${escapeHtml(item.url)}" type="button" aria-label="Toggle favorite">★</button>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        <div class="card-meta">${escapeHtml(item.category)} • ${inferRating(item)}${item.year ? ` • ${item.year}` : ""}</div>
        ${progress ? `<div class="progress-note">Continue watching</div>` : ""}
      </div>
    </article>
  `;
}

function openModal(item) {
  const gradient = gradientFor(item.title);
  const active = getActiveProfile();
  const isFavorite = Boolean(state.favorites[active.id]?.[item.url]);
  const inWatchlist = Boolean(state.watchlist[active.id]?.[item.url]);

  els.detailArt.style.setProperty("--detail-gradient", gradient);
  els.detailArt.style.setProperty("--detail-image", item.posterUrl ? `url("${item.posterUrl}")` : "none");
  els.detailTitle.textContent = item.title;
  els.detailMeta.textContent = `${item.category} • ${item.type === "series" ? "Series or folder" : "Movie"} • ${inferRating(item)}${item.year ? ` • ${item.year}` : ""}`;
  els.detailDescription.textContent = item.overview || buildDescription(item);
  els.detailOpen.href = item.url;
  els.detailOpen.onclick = () => markWatched(item);
  els.detailPreview.href = item.previewUrl || item.url;
  els.detailPreview.style.display = item.previewUrl ? "inline-flex" : "none";

  document.querySelectorAll(".detail-dynamic").forEach((node) => node.remove());
  const infoBlock = document.createElement("div");
  infoBlock.className = "detail-dynamic detail-info-grid";
  infoBlock.innerHTML = `
    <div><span class="eyebrow">Runtime</span><p>${escapeHtml(item.runtime ? `${item.runtime} min` : "Unknown")}</p></div>
    <div><span class="eyebrow">TMDB Rating</span><p>${escapeHtml(item.tmdbRating ? Number(item.tmdbRating).toFixed(1) : "N/A")}</p></div>
    <div><span class="eyebrow">Cast</span><p>${escapeHtml((item.cast || []).join(", ") || "Not loaded yet")}</p></div>
  `;
  els.detailDescription.insertAdjacentElement("afterend", infoBlock);

  const controls = document.createElement("div");
  controls.className = "detail-dynamic detail-actions secondary-actions";
  controls.innerHTML = `
    <button id="detailFavoriteButton" class="ghost-button" type="button">${isFavorite ? "Remove Favorite" : "Favorite"}</button>
    <button id="detailWatchlistButton" class="ghost-button" type="button">${inWatchlist ? "Remove Watchlist" : "Add to Watchlist"}</button>
  `;
  els.detailActions.insertAdjacentElement("beforebegin", controls);
  document.querySelector("#detailFavoriteButton").addEventListener("click", () => toggleFavorite(item.url));
  document.querySelector("#detailWatchlistButton").addEventListener("click", () => toggleWatchlist(item.url));

  if (!els.detailModal.open) els.detailModal.showModal();
}

function runSurprise(mode) {
  const all = getAllowedItems(state.catalog?.items ?? []);
  let pool = all;
  if (mode === "category" && state.activeCategory !== "All") {
    pool = all.filter((item) => item.category === state.activeCategory);
  } else if (mode === "kid-safe") {
    pool = state.catalog.items.filter((item) => MATURITY_ORDER[inferRating(item)] <= MATURITY_ORDER.PG);
  }
  if (!pool.length) return;
  animateShuffle(pool);
}

function animateShuffle(pool) {
  let ticks = 0;
  const interval = setInterval(() => {
    const item = pool[Math.floor(Math.random() * pool.length)];
    setHero(item);
    ticks += 1;
    if (ticks >= 10) {
      clearInterval(interval);
      openModal(item);
    }
  }, 120);
}

function toggleFavorite(url) {
  const active = getActiveProfile();
  state.favorites[active.id] ||= {};
  if (state.favorites[active.id][url]) delete state.favorites[active.id][url];
  else state.favorites[active.id][url] = Date.now();
  persistState(STORAGE_KEYS.favorites, state.favorites);
  rerenderActiveView();
}

function toggleWatchlist(url) {
  const active = getActiveProfile();
  state.watchlist[active.id] ||= {};
  if (state.watchlist[active.id][url]) delete state.watchlist[active.id][url];
  else state.watchlist[active.id][url] = Date.now();
  persistState(STORAGE_KEYS.watchlist, state.watchlist);
  rerenderActiveView();
}

function markWatched(item) {
  const active = getActiveProfile();
  state.progress[active.id] ||= {};
  state.progress[active.id][item.url] = Date.now();
  state.history[active.id] ||= [];
  state.history[active.id] = [
    { url: item.url, title: item.title, runtime: item.runtime || 95, watchedAt: Date.now() },
    ...state.history[active.id].filter((entry) => entry.url !== item.url),
  ].slice(0, 40);
  persistState(STORAGE_KEYS.progress, state.progress);
  persistState(STORAGE_KEYS.history, state.history);
  rerenderActiveView();
}

function updateSurpriseButtons() {
  els.surpriseButtons.forEach((button) => button.classList.toggle("active", button.dataset.surpriseMode === state.surpriseMode));
}

function inferRating(item) {
  const text = `${item.title} ${item.category}`.toLowerCase();
  if (/(terrifier|saw|conjuring|annabelle|halloween|chucky|purge|texas chain|elm street|john wick|deadpool|south park|evil dead)/.test(text)) return "R";
  if (/(harry potter|spider man|marvel|transformers|ghostbusters|gravity falls|teen titans|dragon ball|pokemon detective pikachu|ready player one|superman|oppenheimer|8 mile)/.test(text)) return "PG-13";
  if (/(disney|family|animation|bluey|spongebob|toy story|minions|despicable me|my little pony|garfield|pokemon|dog man)/.test(text)) return "G";
  return "PG";
}

function gradientFor(seedText) {
  const total = [...seedText].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [start, end] = palette[total % palette.length];
  return `linear-gradient(135deg, ${start}, ${end})`;
}

function buildDescription(item) {
  const mode = item.type === "series" ? "Open the collection in Google Drive and jump into the folder like a streaming season shelf." : "Launch this title in Google Drive from your Basement Theater streaming library.";
  return `${mode} Curated from the "${item.category}" section of your catalog for the ${getActiveProfile().name} profile.`;
}

function normalizedFirstCharacter(title) {
  const first = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function persistState(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


function maybeShowWelcome() {
  if (localStorage.getItem(STORAGE_KEYS.welcomeSeen)) return;
  if (!els.welcomeModal || els.welcomeModal.open) return;
  els.welcomeModal.showModal();
}

function dismissWelcome() {
  localStorage.setItem(STORAGE_KEYS.welcomeSeen, "true");
}
