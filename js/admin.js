const refs = {
  loginCard: document.getElementById("loginCard"),
  dashboard: document.getElementById("dashboard"),
  loginForm: document.getElementById("loginForm"),
  loginMessage: document.getElementById("loginMessage"),
  genreForm: document.getElementById("genreForm"),
  genreMessage: document.getElementById("genreMessage"),
  trackForm: document.getElementById("trackForm"),
  trackMessage: document.getElementById("trackMessage"),
  genreSelect: document.getElementById("genreSelect"),
  libraryPreview: document.getElementById("libraryPreview"),
  logoutBtn: document.getElementById("logoutBtn"),
  themeToggle: document.getElementById("themeToggle")
};

const state = {
  genres: [],
  theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(state.theme);
  bindEvents();
  checkSession();
});

function bindEvents() {
  refs.loginForm.addEventListener("submit", onLogin);
  refs.genreForm.addEventListener("submit", onCreateGenre);
  refs.trackForm.addEventListener("submit", onCreateTrack);
  refs.logoutBtn.addEventListener("click", onLogout);

  refs.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
  });
}

async function checkSession() {
  try {
    const response = await fetch("/api/admin/genres", { credentials: "include" });
    if (!response.ok) return showLogin();

    const data = await response.json();
    state.genres = data.genres || [];
    showDashboard();
    renderGenreOptions();
    await loadLibraryPreview();
  } catch {
    showLogin();
  }
}

async function onLogin(event) {
  event.preventDefault();
  setMessage(refs.loginMessage, "Memeriksa access code...", "");

  const formData = new FormData(refs.loginForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(refs.loginMessage, data.error || "Login gagal.", "error");
      return;
    }

    setMessage(refs.loginMessage, "Login berhasil.", "success");
    refs.loginForm.reset();
    await checkSession();
  } catch {
    setMessage(refs.loginMessage, "Terjadi error saat login.", "error");
  }
}

async function onCreateGenre(event) {
  event.preventDefault();
  setMessage(refs.genreMessage, "Menyimpan genre...", "");

  const formData = new FormData(refs.genreForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/admin/genres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(refs.genreMessage, data.error || "Gagal tambah genre.", "error");
      return;
    }

    setMessage(refs.genreMessage, "Genre berhasil ditambahkan.", "success");
    refs.genreForm.reset();
    await refreshGenres();
    await loadLibraryPreview();
  } catch {
    setMessage(refs.genreMessage, "Terjadi error saat tambah genre.", "error");
  }
}

async function onCreateTrack(event) {
  event.preventDefault();
  setMessage(refs.trackMessage, "Menyimpan track...", "");

  const formData = new FormData(refs.trackForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/admin/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(refs.trackMessage, data.error || "Gagal tambah track.", "error");
      return;
    }

    setMessage(refs.trackMessage, "Track berhasil ditambahkan.", "success");
    refs.trackForm.reset();
    if (state.genres[0]) refs.genreSelect.value = String(state.genres[0].id);
    await loadLibraryPreview();
  } catch {
    setMessage(refs.trackMessage, "Terjadi error saat tambah track.", "error");
  }
}

async function onLogout() {
  await fetch("/api/admin/logout", {
    method: "POST",
    credentials: "include"
  });
  showLogin();
  setMessage(refs.loginMessage, "Logout berhasil.", "success");
}

async function refreshGenres() {
  const response = await fetch("/api/admin/genres", { credentials: "include" });
  const data = await response.json();
  state.genres = data.genres || [];
  renderGenreOptions();
}

function renderGenreOptions() {
  refs.genreSelect.innerHTML = state.genres.length
    ? state.genres.map((genre) => `<option value="${genre.id}">${escapeHtml(genre.name)}</option>`).join("")
    : `<option value="">Belum ada genre</option>`;
}

async function loadLibraryPreview() {
  const response = await fetch("/api/library", { credentials: "include" });
  const data = await response.json();
  const genres = data.genres || [];

  if (!genres.length) {
    refs.libraryPreview.innerHTML = `<div class="empty-state">Belum ada data.</div>`;
    return;
  }

  refs.libraryPreview.innerHTML = genres.map((genre) => `
    <article class="library-group">
      <h3>${escapeHtml(genre.name)} (${genre.tracks.length} track)</h3>
      ${
        genre.tracks.length
          ? `<ul>${genre.tracks.map((track) => `<li>${escapeHtml(track.title)} — ${escapeHtml(track.artist || "Unknown artist")}</li>`).join("")}</ul>`
          : `<p class="muted-text">Belum ada track.</p>`
      }
    </article>
  `).join("");
}

function showLogin() {
  refs.loginCard.hidden = false;
  refs.dashboard.hidden = true;
}

function showDashboard() {
  refs.loginCard.hidden = true;
  refs.dashboard.hidden = false;
}

function setMessage(element, text, type) {
  element.textContent = text;
  element.className = "form-message";
  if (type) element.classList.add(type);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  refs.themeToggle.textContent = theme === "dark" ? "☀" : "☾";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
