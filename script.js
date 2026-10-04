const state = {
  albums: [],
  filtered: [],
  photos: [],
  photoIndex: 0
};

const $ = (id) => document.getElementById(id);

const albumsEl = $("albums");
const loadingEl = $("loading");
const emptyEl = $("empty");
const resultCountEl = $("resultCount");

function normalizeText(value) {
  return String(value || "").toLocaleLowerCase("pt-BR");
}

function parseDate(value) {
  if (!value) return new Date(0);
  const iso = String(value).includes("-")
    ? new Date(value + (String(value).length === 10 ? "T12:00:00" : ""))
    : new Date(value);
  return isNaN(iso) ? new Date(0) : iso;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date.getTime()) return value || "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "long", year: "numeric"
  }).format(date);
}

function renderAlbums() {
  albumsEl.innerHTML = "";

  resultCountEl.textContent =
    `${state.filtered.length} ${state.filtered.length === 1 ? "álbum encontrado" : "álbuns encontrados"}`;

  if (!state.filtered.length) {
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");

  for (const album of state.filtered) {
    const card = document.createElement("article");
    card.className = "album";

    card.innerHTML = `
      <div class="cover">
        <img src="${album.capa}" alt="${escapeHtml(album.nome)}" loading="lazy">
        <span class="photo-count">▧ ${album.fotos.length}</span>
      </div>
      <div class="album-info">
        <h3>${escapeHtml(album.nome)}</h3>
        <p>${escapeHtml(album.descricao || "")}</p>
        <div class="album-bottom">
          <span class="album-date">${formatDate(album.data)}</span>
          <span class="album-open">Abrir álbum →</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => openAlbum(album));
    albumsEl.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyFilters() {
  const term = normalizeText($("search").value);
  const sort = $("sort").value;
  const period = $("period").value;
  const now = new Date();

  state.filtered = state.albums.filter(album => {
    const haystack = normalizeText(
      `${album.nome} ${album.descricao} ${album.data} ${album.categoria || ""} ${(album.tags || []).join(" ")}`
    );

    if (term && !haystack.includes(term)) return false;

    const date = parseDate(album.data);

    if (period === "year" && date.getFullYear() !== now.getFullYear()) return false;

    if (period === "month" &&
        (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth())) return false;

    if (period === "week") {
      const diff = now - date;
      if (diff < 0 || diff > 7 * 24 * 60 * 60 * 1000) return false;
    }

    return true;
  });

  state.filtered.sort((a, b) => {
    switch (sort) {
      case "oldest": return parseDate(a.data) - parseDate(b.data);
      case "az": return normalizeText(a.nome).localeCompare(normalizeText(b.nome), "pt-BR");
      case "za": return normalizeText(b.nome).localeCompare(normalizeText(a.nome), "pt-BR");
      case "photos-desc": return b.fotos.length - a.fotos.length;
      case "photos-asc": return a.fotos.length - b.fotos.length;
      default: return parseDate(b.data) - parseDate(a.data);
    }
  });

  renderAlbums();
}

function openAlbum(album) {
  state.photos = album.fotos;
  state.photoIndex = 0;
  $("lightboxTitle").textContent = album.nome;
  $("lightbox").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  showPhoto();
}

function showPhoto() {
  if (!state.photos.length) return;

  const src = state.photos[state.photoIndex];
  $("lightboxImage").src = src;
  $("lightboxImage").alt = $("lightboxTitle").textContent;
  $("photoCounter").textContent = `${state.photoIndex + 1} de ${state.photos.length}`;

  $("downloadPhoto").onclick = () => {
    window.open(src, "_blank", "noopener");
  };
}

function nextPhoto() {
  if (!state.photos.length) return;
  state.photoIndex = (state.photoIndex + 1) % state.photos.length;
  showPhoto();
}

function previousPhoto() {
  if (!state.photos.length) return;
  state.photoIndex = (state.photoIndex - 1 + state.photos.length) % state.photos.length;
  showPhoto();
}

function closeLightbox() {
  $("lightbox").classList.add("hidden");
  $("lightboxImage").src = "";
  document.body.style.overflow = "";
}

async function loadAlbums() {
  try {
    const response = await fetch("dados/albuns.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    state.albums = await response.json();

    // A ordenação inicial é por data, do mais recente para o mais antigo.
    applyFilters();
    loadingEl.classList.add("hidden");
  } catch (error) {
    loadingEl.textContent =
      "Não foi possível carregar os álbuns. Verifique se o site está sendo executado por um servidor HTTP.";
    console.error(error);
  }
}

function initTheme() {
  const saved = localStorage.getItem("eden-theme");
  const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (preferredDark ? "dark" : "light");

  document.documentElement.dataset.theme = theme;
  updateThemeButton();

  $("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("eden-theme", next);
    updateThemeButton();
  });
}

function updateThemeButton() {
  $("themeToggle").textContent =
    document.documentElement.dataset.theme === "dark" ? "☀" : "☾";
}

$("search").addEventListener("input", applyFilters);
$("sort").addEventListener("change", applyFilters);
$("period").addEventListener("change", applyFilters);

$("clearFilters").addEventListener("click", () => {
  $("search").value = "";
  $("sort").value = "newest";
  $("period").value = "all";
  applyFilters();
});

$("gridView").addEventListener("click", () => {
  albumsEl.classList.remove("compact");
  $("gridView").classList.add("active");
  $("compactView").classList.remove("active");
});

$("compactView").addEventListener("click", () => {
  albumsEl.classList.add("compact");
  $("compactView").classList.add("active");
  $("gridView").classList.remove("active");
});

$("next").addEventListener("click", nextPhoto);
$("previous").addEventListener("click", previousPhoto);
$("closeLightbox").addEventListener("click", closeLightbox);

$("lightbox").addEventListener("click", (event) => {
  if (event.target === $("lightbox")) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if ($("lightbox").classList.contains("hidden")) return;

  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowRight") nextPhoto();
  if (event.key === "ArrowLeft") previousPhoto();
});

$("year").textContent = new Date().getFullYear();

initTheme();
loadAlbums();
