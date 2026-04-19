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
  deferredPrompt: null,
  searchQuery: ""
};

const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  playing_icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m11.4 11.4l.7.7M5.6 18.4l.7-.7m11.4-11.4l.7-.7"/></svg>`
};

const refs = {
  genreTabs: document.getElementById("genreTabs"),
  playlistContainer: document.getElementById("playlistContainer"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  timeBar: document.getElementById("timeBar"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  themeToggle: document.getElementById("themeToggle"),
  searchInput: document.getElementById("searchInput"),
  genreNav: document.getElementById("genreNav"),
  genreHeading: document.getElementById("genreHeading"),
  installBtn: document.getElementById("installBtn")
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(state.theme);
  bindEvents();
  loadLibrary();
});

function bindEvents() {
  refs.playPauseBtn.addEventListener("click", onPlayPause);
  document.getElementById("prevBtn").addEventListener("click", () => navigateTrack(-1));
  document.getElementById("nextBtn").addEventListener("click", () => navigateTrack(1));
  document.getElementById("refreshBtn").addEventListener("click", () => location.reload());
  
  // LOGIKA SEARCH
  refs.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderPlaylist();
    // Sembunyikan navigasi genre jika sedang mencari
    refs.genreNav.style.opacity = state.searchQuery ? "0" : "1";
    refs.genreNav.style.pointerEvents = state.searchQuery ? "none" : "auto";
  });

  // Time Bar Logic
  refs.timeBar.addEventListener("change", (e) => {
    if (state.player && state.playerReady) state.player.seekTo(e.target.value, true);
  });
  refs.timeBar.addEventListener("input", (e) => {
    refs.currentTime.textContent = formatTime(e.target.value);
  });

  refs.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
    localStorage.setItem('theme', state.theme);
  });
}

async function loadLibrary() {
  try {
    const res = await fetch("/api/library");
    const data = await res.json();
    state.library = data.genres || [];
    if (state.library.length) {
      state.activeGenreId = state.library[0].id;
      renderGenres();
      renderPlaylist();
    }
  } catch (e) { console.error("Library failed"); }
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
  let tracksToShow = [];
  
  if (state.searchQuery) {
    // Cari di SEMUA genre
    refs.genreHeading.textContent = "Hasil Pencarian";
    state.library.forEach(genre => {
      genre.tracks.forEach(track => {
        if (track.title.toLowerCase().includes(state.searchQuery) || 
            track.artist.toLowerCase().includes(state.searchQuery)) {
          tracksToShow.push(track);
        }
      });
    });
  } else {
    // Tampilkan genre aktif
    const genre = state.library.find(g => g.id === state.activeGenreId);
    refs.genreHeading.textContent = genre?.name || "Genre";
    tracksToShow = genre?.tracks || [];
  }

  document.getElementById("trackCount").textContent = `${tracksToShow.length} track`;

  if (tracksToShow.length === 0) {
    refs.playlistContainer.innerHTML = `<p class="muted" style="text-align:center; padding: 20px;">Lagu tidak ditemukan.</p>`;
    return;
  }

  refs.playlistContainer.innerHTML = tracksToShow.map((t, i) => {
    const isActive = state.activeTrack?.id === t.id;
    return `
      <button class="track-row ${isActive ? 'active' : ''}" onclick="playSpecificTrack('${t.id}', ${i})">
        <span class="track-index">${i + 1}</span>
        <div class="track-info">
          <span class="track-title">${t.title}</span>
          <span class="track-artist">${t.artist || "Unknown"}</span>
        </div>
        <div class="track-icon-wrap">
          ${isActive && state.isPlaying ? ICONS.playing_icon : ICONS.play}
        </div>
      </button>
    `;
  }).join("");
}

// Play track berdasarkan ID (berguna saat pencarian)
window.playSpecificTrack = async (trackId, indexInView) => {
  let foundTrack = null;
  state.library.forEach(g => {
    const t = g.tracks.find(track => track.id === trackId);
    if (t) foundTrack = t;
  });

  if (!foundTrack) return;

  state.activeTrack = foundTrack;
  state.activeTrackIndex = indexInView; // Index saat ini di tampilan
  document.getElementById("nowTitle").textContent = foundTrack.title;
  document.getElementById("nowArtist").textContent = foundTrack.artist;

  if (!state.player) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => createPlayer(foundTrack.youtubeVideoId);
  } else {
    state.player.loadVideoById(foundTrack.youtubeVideoId);
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
        if (state.isPlaying) startTimer();
        if (e.data === YT.PlayerState.ENDED) navigateTrack(1);
        renderPlaylist();
      }
    }
  });
}

function navigateTrack(dir) {
  const genre = state.library.find(g => g.id === state.activeGenreId);
  if (!genre) return;
  let nextIndex = state.activeTrackIndex + dir;
  if (nextIndex >= genre.tracks.length) nextIndex = 0;
  if (nextIndex < 0) nextIndex = genre.tracks.length - 1;
  window.playSpecificTrack(genre.tracks[nextIndex].id, nextIndex);
}

function startTimer() {
  if (state.progressInterval) clearInterval(state.progressInterval);
  state.progressInterval = setInterval(() => {
    if (state.player && state.isPlaying) {
      const cur = state.player.getCurrentTime();
      const dur = state.player.getDuration();
      refs.timeBar.max = dur;
      refs.timeBar.value = cur;
      refs.currentTime.textContent = formatTime(cur);
      refs.durationTime.textContent = formatTime(dur);
    }
  }, 500);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sc = Math.floor(s % 60);
  return `${m}:${sc < 10 ? '0' : ''}${sc}`;
}

function onPlayPause() { if(state.player) state.isPlaying ? state.player.pauseVideo() : state.player.playVideo(); }

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  refs.themeToggle.innerHTML = t === "dark" ? "☀" : "☾";
}
