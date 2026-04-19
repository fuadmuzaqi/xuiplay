const state = {
  library: [],
  activeGenreId: null,
  activeTrack: null,
  activeTrackIndex: -1,
  player: null,
  playerReady: false,
  isPlaying: false,
  theme: localStorage.getItem('theme') || "dark",
  progressInterval: null,
  deferredPrompt: null
};

const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
};

const refs = {
  genreTabs: document.getElementById("genreTabs"),
  playlistContainer: document.getElementById("playlistContainer"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  timeBar: document.getElementById("timeBar"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  themeToggle: document.getElementById("themeToggle"),
  refreshBtn: document.getElementById("refreshBtn"),
  clearCacheBtn: document.getElementById("clearCacheBtn"),
  installBtn: document.getElementById("installBtn")
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(state.theme);
  bindEvents();
  loadLibrary();
  registerServiceWorker();
});

function bindEvents() {
  refs.playPauseBtn.addEventListener("click", onPlayPause);
  document.getElementById("prevBtn").addEventListener("click", playPrevious);
  document.getElementById("nextBtn").addEventListener("click", playNext);

  // Refresh & Clear Cache
  refs.refreshBtn.addEventListener("click", () => location.reload());
  refs.clearCacheBtn.addEventListener("click", clearAppCache);

  // Seek Logic
  refs.timeBar.addEventListener("change", (e) => {
    if (state.player && state.playerReady) state.player.seekTo(e.target.value, true);
  });
  refs.timeBar.addEventListener("input", (e) => {
    refs.currentTime.textContent = formatTime(e.target.value);
  });

  // Theme
  refs.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
    localStorage.setItem('theme', state.theme);
  });

  // PWA Install
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    refs.installBtn.style.display = 'grid';
  });

  refs.installBtn.addEventListener('click', async () => {
    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      const { outcome } = await state.deferredPrompt.userChoice;
      if (outcome === 'accepted') refs.installBtn.style.display = 'none';
      state.deferredPrompt = null;
    }
  });
}

async function clearAppCache() {
  if (confirm("Hapus cache dan reset aplikasi?")) {
    localStorage.clear();
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    location.reload();
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
  }
}

// Player Logic (Sesuai kode asli Anda namun dengan icon SVG)
function startProgressTimer() {
  if (state.progressInterval) clearInterval(state.progressInterval);
  state.progressInterval = setInterval(() => {
    if (state.player && state.isPlaying) {
      const current = state.player.getCurrentTime();
      const duration = state.player.getDuration();
      refs.timeBar.max = duration;
      refs.timeBar.value = current;
      refs.currentTime.textContent = formatTime(current);
      refs.durationTime.textContent = formatTime(duration);
    }
  }, 500);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sc = Math.floor(s % 60);
  return `${m}:${sc < 10 ? '0' : ''}${sc}`;
}

async function loadLibrary() {
  try {
    const response = await fetch("/api/library");
    const data = await response.json();
    state.library = data.genres || [];
    if (state.library.length) {
      state.activeGenreId = state.library[0].id;
      renderGenres();
      renderPlaylist();
    }
  } catch (e) { console.error("Library error"); }
}

function renderGenres() {
  refs.genreTabs.innerHTML = state.library.map(g => `
    <button class="genre-tab ${g.id === state.activeGenreId ? "active" : ""}" 
            onclick="switchGenre(${g.id})">${g.name}</button>
  `).join("");
}

window.switchGenre = (id) => {
  state.activeGenreId = id;
  renderGenres();
  renderPlaylist();
};

function renderPlaylist() {
  const activeGenre = state.library.find(g => g.id === state.activeGenreId);
  const tracks = activeGenre?.tracks || [];
  document.getElementById("genreHeading").textContent = activeGenre?.name || "Genre";
  document.getElementById("trackCount").textContent = `${tracks.length} track`;

  refs.playlistContainer.innerHTML = tracks.map((t, i) => `
    <button class="track-row ${state.activeTrack?.id === t.id ? "active" : ""}" 
            onclick="selectTrack(${i})">
      <span class="track-info">
        <span class="track-title">${t.title}</span>
        <span class="track-artist">${t.artist || "Unknown"}</span>
      </span>
      <span style="width:18px">${state.activeTrack?.id === t.id && state.isPlaying ? ICONS.pause : ICONS.play}</span>
    </button>
  `).join("");
}

window.selectTrack = async (index) => {
  const genre = state.library.find(g => g.id === state.activeGenreId);
  const track = genre.tracks[index];
  state.activeTrack = track;
  state.activeTrackIndex = index;
  document.getElementById("nowTitle").textContent = track.title;
  document.getElementById("nowArtist").textContent = track.artist;

  if (!state.player) {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
    window.onYouTubeIframeAPIReady = () => createPlayer(track.youtubeVideoId);
  } else {
    state.player.loadVideoById(track.youtubeVideoId);
  }
  renderPlaylist();
};

function createPlayer(videoId) {
  state.player = new YT.Player("youtube-player", {
    height: "1", width: "1", videoId,
    playerVars: { autoplay: 1, controls: 0, playsinline: 1 },
    events: {
      onReady: () => state.playerReady = true,
      onStateChange: (e) => {
        state.isPlaying = (e.data === YT.PlayerState.PLAYING);
        refs.playPauseBtn.innerHTML = state.isPlaying ? ICONS.pause : ICONS.play;
        if (state.isPlaying) startProgressTimer();
        if (e.data === YT.PlayerState.ENDED) playNext();
        renderPlaylist();
      }
    }
  });
}

function onPlayPause() {
  if (!state.player) return;
  state.isPlaying ? state.player.pauseVideo() : state.player.playVideo();
}

function playNext() { /* Logika Next */ }
function playPrevious() { /* Logika Prev */ }

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  refs.themeToggle.textContent = t === "dark" ? "☀" : "☾";
}
