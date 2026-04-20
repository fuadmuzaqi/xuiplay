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
  searchQuery: ""
};

const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  playing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m11.4 11.4l.7.7M5.6 18.4l.7-.7m11.4-11.4l.7-.7"/></svg>`
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
  clearCacheBtn: document.getElementById("clearCacheBtn"),
  nowTitle: document.getElementById("nowTitle"),
  nowArtist: document.getElementById("nowArtist")
};

// LOAD YOUTUBE API
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

window.onYouTubeIframeAPIReady = () => {
  state.player = new YT.Player("youtube-player", {
    height: "1", width: "1",
    playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0 },
    events: {
      onReady: () => { state.playerReady = true; },
      onStateChange: (e) => {
        state.isPlaying = (e.data === YT.PlayerState.PLAYING);
        refs.playPauseBtn.innerHTML = state.isPlaying ? ICONS.pause : ICONS.play;
        if (state.isPlaying) startTimer();
        if (e.data === YT.PlayerState.ENDED) navigateTrack(1);
        renderPlaylist();
      }
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(state.theme);
  loadLibrary();
  bindEvents();
});

function bindEvents() {
  refs.playPauseBtn.addEventListener("click", onPlayPause);
  document.getElementById("prevBtn").addEventListener("click", () => navigateTrack(-1));
  document.getElementById("nextBtn").addEventListener("click", () => navigateTrack(1));
  document.getElementById("refreshBtn").addEventListener("click", () => location.reload());
  
  // FIX HAPUS CACHE
  refs.clearCacheBtn.addEventListener("click", () => {
    if (confirm("Reset aplikasi dan hapus cache?")) {
      localStorage.clear();
      if ('caches' in window) {
        caches.keys().then(names => {
          for (let name of names) caches.delete(name);
        }).finally(() => {
          window.location.href = window.location.pathname + '?r=' + Date.now();
        });
      } else {
        location.reload();
      }
    }
  });

  refs.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    refs.genreNav.style.display = state.searchQuery ? "none" : "block";
    renderPlaylist();
  });

  refs.timeBar.addEventListener("change", (e) => {
    if (state.playerReady && state.player) state.player.seekTo(e.target.value, true);
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
  } catch (e) { console.error("API error"); }
}

function renderGenres() {
  refs.genreTabs.innerHTML = state.library.map(g => `
    <button class="genre-tab ${g.id === state.activeGenreId ? "active" : ""}" 
            onclick="window.switchGenre(${g.id})">${g.name}</button>
  `).join("");
}

window.switchGenre = (id) => {
  state.activeGenreId = id;
  renderGenres();
  renderPlaylist();
};

function renderPlaylist() {
  let list = [];
  if (state.searchQuery) {
    refs.genreHeading.textContent = "Hasil Pencarian";
    state.library.forEach(g => {
      g.tracks.forEach(t => {
        if (t.title.toLowerCase().includes(state.searchQuery) || t.artist.toLowerCase().includes(state.searchQuery)) {
          list.push(t);
        }
      });
    });
  } else {
    const genre = state.library.find(g => g.id === state.activeGenreId);
    refs.genreHeading.textContent = genre?.name || "Folder";
    list = genre?.tracks || [];
  }

  document.getElementById("trackCount").textContent = `${list.length} track`;

  refs.playlistContainer.innerHTML = list.map((t, i) => {
    const active = state.activeTrack?.id === t.id;
    return `
      <button class="track-row ${active ? 'active' : ''}" onclick="window.playById('${t.id}', ${i})">
        <span class="track-index">${i + 1}</span>
        <div class="track-info">
          <span class="track-title">${t.title}</span>
          <span class="track-artist">${t.artist || "Unknown"}</span>
        </div>
        <div class="track-icon-wrap" style="width:18px;height:18px;">
          ${active && state.isPlaying ? ICONS.playing : ICONS.play}
        </div>
      </button>
    `;
  }).join("");
}

// FUNGSI UTAMA - DAFTARKAN KE WINDOW AGAR BISA DIPANGGIL DARI HTML
window.playById = (id, idx) => {
  let trackFound = null;
  state.library.forEach(g => {
    const t = g.tracks.find(x => x.id === id);
    if (t) trackFound = t;
  });

  if (trackFound) {
    state.activeTrack = trackFound;
    state.activeTrackIndex = idx;
    
    // UPDATE UI SEKETIKA
    refs.nowTitle.textContent = trackFound.title;
    refs.nowArtist.textContent = trackFound.artist;

    if (state.playerReady && state.player) {
      state.player.loadVideoById(trackFound.youtubeVideoId);
    } else {
      alert("Pemutar video sedang disiapkan, silakan coba lagi dalam 2 detik.");
    }
    renderPlaylist();
  }
};

function onPlayPause() {
  if (!state.playerReady || !state.player) return;
  state.isPlaying ? state.player.pauseVideo() : state.player.playVideo();
}

function navigateTrack(dir) {
  const genre = state.library.find(g => g.id === state.activeGenreId);
  if (!genre) return;
  let next = state.activeTrackIndex + dir;
  if (next >= genre.tracks.length) next = 0;
  if (next < 0) next = genre.tracks.length - 1;
  const t = genre.tracks[next];
  if (t) window.playById(t.id, next);
}

function startTimer() {
  if (state.progressInterval) clearInterval(state.progressInterval);
  state.progressInterval = setInterval(() => {
    if (state.player && state.player.getCurrentTime) {
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

function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  refs.themeToggle.innerHTML = t === "dark" ? "☀" : "☾";
}
