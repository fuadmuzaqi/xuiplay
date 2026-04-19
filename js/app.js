const state = {
  library: [],
  activeGenreId: null,
  activeTrackIndex: -1,
  player: null,
  isPlaying: false,
  theme: 'dark',
  timer: null
};

const refs = {
  timeBar: document.getElementById("timeBar"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  genreTabs: document.getElementById("genreTabs"),
  playlistContainer: document.getElementById("playlistContainer"),
  themeToggle: document.getElementById("themeToggle")
};

// Init
document.addEventListener("DOMContentLoaded", () => {
  setupTheme();
  loadData();
  attachEventListeners();
});

function attachEventListeners() {
  refs.playPauseBtn.addEventListener("click", togglePlayback);
  document.getElementById("nextBtn").addEventListener("click", playNext);
  document.getElementById("prevBtn").addEventListener("click", playPrev);
  
  // FIX UNTUK MOBILE: Gunakan 'change' untuk finalisasi seek 
  // agar tidak bentrok dengan render frame API YouTube
  refs.timeBar.addEventListener("change", (e) => {
    if (state.player) {
      const targetTime = e.target.value;
      state.player.seekTo(targetTime, true);
    }
  });

  // Visual update saat digeser (tanpa memicu seek API terus-menerus)
  refs.timeBar.addEventListener("input", (e) => {
    refs.currentTime.textContent = formatTime(e.target.value);
  });

  refs.themeToggle.addEventListener("click", toggleTheme);
}

async function loadData() {
  try {
    // Simulasi data jika API belum ada
    const data = {
      genres: [
        { id: 1, name: "Chill", tracks: [{ title: "Lofi Study", artist: "Lofi Girl", youtubeVideoId: "jfKfPfyJRdk" }] },
        { id: 2, name: "Pop", tracks: [{ title: "Starboy", artist: "The Weeknd", youtubeVideoId: "34Na4j8AVgA" }] }
      ]
    };
    
    state.library = data.genres;
    state.activeGenreId = state.library[0].id;
    renderAll();
  } catch (e) { console.error("Load failed", e); }
}

function renderAll() {
  renderGenres();
  renderPlaylist();
}

function renderGenres() {
  refs.genreTabs.innerHTML = state.library.map(g => `
    <button class="genre-btn ${g.id === state.activeGenreId ? 'active' : ''}" 
            onclick="selectGenre(${g.id})">${g.name}</button>
  `).join("");
}

window.selectGenre = (id) => {
  state.activeGenreId = id;
  renderAll();
};

function renderPlaylist() {
  const genre = state.library.find(g => g.id === state.activeGenreId);
  const tracks = genre?.tracks || [];
  
  document.getElementById("trackCount").textContent = `${tracks.length} tracks`;
  refs.playlistContainer.innerHTML = tracks.map((t, i) => `
    <button class="track-item ${state.activeTrackIndex === i ? 'active' : ''}" onclick="playTrack(${i})">
      <div class="track-meta">
        <span class="t-title">${t.title}</span>
        <span class="t-artist">${t.artist}</span>
      </div>
      <span class="t-icon">${state.activeTrackIndex === i && state.isPlaying ? '❙❙' : '▶'}</span>
    </button>
  `).join("");
}

function playTrack(index) {
  const genre = state.library.find(g => g.id === state.activeGenreId);
  const track = genre.tracks[index];
  state.activeTrackIndex = index;
  
  document.getElementById("nowTitle").textContent = track.title;
  document.getElementById("nowArtist").textContent = track.artist;

  if (!state.player) {
    initYouTube(track.youtubeVideoId);
  } else {
    state.player.loadVideoById(track.youtubeVideoId);
  }
  renderPlaylist();
}

function initYouTube(id) {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    state.player = new YT.Player('youtube-player', {
      videoId: id,
      playerVars: { 'autoplay': 1, 'controls': 0, 'playsinline': 1 },
      events: {
        'onStateChange': (e) => {
          state.isPlaying = (e.data === YT.PlayerState.PLAYING);
          refs.playPauseBtn.textContent = state.isPlaying ? "❙❙" : "▶";
          if (e.data === YT.PlayerState.PLAYING) startProgressLoop();
          if (e.data === YT.PlayerState.ENDED) playNext();
          renderPlaylist();
        }
      }
    });
  };
}

function startProgressLoop() {
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (state.player && state.isPlaying) {
      const curr = state.player.getCurrentTime();
      const dur = state.player.getDuration();
      refs.timeBar.max = dur;
      refs.timeBar.value = curr;
      refs.currentTime.textContent = formatTime(curr);
      refs.durationTime.textContent = formatTime(dur);
    }
  }, 1000);
}

function formatTime(s) {
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function togglePlayback() {
  if (!state.player) return;
  state.isPlaying ? state.player.pauseVideo() : state.player.playVideo();
}

function playNext() { /* Logika play next */ }
function playPrev() { /* Logika play prev */ }

function setupTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  refs.themeToggle.textContent = state.theme === 'dark' ? '☀' : '☾';
}
