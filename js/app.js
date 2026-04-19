const state = {
  library: [],
  activeGenreId: null,
  activeTrackIndex: -1,
  player: null,
  isPlaying: false,
  theme: localStorage.getItem('theme') || 'light',
  timer: null
};

const refs = {
  genreTabs: document.getElementById("genreTabs"),
  playlistContainer: document.getElementById("playlistContainer"),
  genreHeading: document.getElementById("genreHeading"),
  trackCount: document.getElementById("trackCount"),
  nowTitle: document.getElementById("nowTitle"),
  nowArtist: document.getElementById("nowArtist"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  timeBar: document.getElementById("timeBar"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  themeToggle: document.getElementById("themeToggle")
};

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(state.theme);
  loadLibrary();
  bindEvents();
});

function bindEvents() {
  refs.playPauseBtn.addEventListener("click", togglePlay);
  document.getElementById("prevBtn").addEventListener("click", playPrev);
  document.getElementById("nextBtn").addEventListener("click", playNext);
  
  refs.timeBar.addEventListener("input", (e) => {
    if (state.player) {
      const seekTo = e.target.value;
      state.player.seekTo(seekTo);
    }
  });

  refs.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme(state.theme);
  });
}

// Logic: Fetch & Render
async function loadLibrary() {
  try {
    const res = await fetch("/api/library"); // Sesuaikan dengan endpoint-mu
    const data = await res.json();
    state.library = data.genres || [];
    
    if (state.library.length > 0) {
      state.activeGenreId = state.library[0].id;
      renderGenres();
      renderPlaylist();
    }
  } catch (err) {
    console.error("Gagal memuat library", err);
  }
}

function renderGenres() {
  refs.genreTabs.innerHTML = state.library.map(g => `
    <button class="genre-btn ${g.id === state.activeGenreId ? 'active' : ''}" 
            onclick="switchGenre(${g.id})">${g.name}</button>
  `).join("");
}

window.switchGenre = (id) => {
  state.activeGenreId = id;
  renderGenres();
  renderPlaylist();
};

function renderPlaylist() {
  const genre = state.library.find(g => g.id === state.activeGenreId);
  const tracks = genre?.tracks || [];
  
  refs.genreHeading.textContent = genre?.name || "Playlist";
  refs.trackCount.textContent = `${tracks.length} Track`;
  
  refs.playlistContainer.innerHTML = tracks.map((t, i) => `
    <button class="track-item ${state.activeTrackIndex === i && state.activeGenreId === genre.id ? 'active' : ''}" 
            onclick="playTrack(${i})">
      <div class="track-info">
        <span class="track-name">${t.title}</span>
        <span class="muted-artist">${t.artist}</span>
      </div>
      <span>${state.activeTrackIndex === i && state.isPlaying ? '⏸' : '▶'}</span>
    </button>
  `).join("");
}

// Logic: Player Core
async function playTrack(index) {
  const genre = state.library.find(g => g.id === state.activeGenreId);
  const track = genre.tracks[index];
  
  state.activeTrackIndex = index;
  refs.nowTitle.textContent = track.title;
  refs.nowArtist.textContent = track.artist;

  if (!state.player) {
    initYouTube(track.youtubeVideoId);
  } else {
    state.player.loadVideoById(track.youtubeVideoId);
  }
  
  renderPlaylist();
}

function initYouTube(videoId) {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);

  window.onYouTubeIframeAPIReady = () => {
    state.player = new YT.Player('youtube-player', {
      videoId: videoId,
      playerVars: { 'autoplay': 1, 'controls': 0 },
      events: {
        'onStateChange': onPlayerStateChange,
        'onReady': () => startTimer()
      }
    });
  };
}

function onPlayerStateChange(event) {
  state.isPlaying = (event.data === YT.PlayerState.PLAYING);
  refs.playPauseBtn.textContent = state.isPlaying ? "⏸" : "▶";
  
  if (event.data === YT.PlayerState.ENDED) playNext();
  renderPlaylist();
}

function togglePlay() {
  if (!state.player) return;
  state.isPlaying ? state.player.pauseVideo() : state.player.playVideo();
}

function playNext() {
  const tracks = state.library.find(g => g.id === state.activeGenreId).tracks;
  let next = state.activeTrackIndex + 1;
  if (next >= tracks.length) next = 0;
  playTrack(next);
}

function playPrev() {
  const tracks = state.library.find(g => g.id === state.activeGenreId).tracks;
  let prev = state.activeTrackIndex - 1;
  if (prev < 0) prev = tracks.length - 1;
  playTrack(prev);
}

// Time Management
function startTimer() {
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

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  refs.themeToggle.textContent = t === 'light' ? '☾' : '☀';
  localStorage.setItem('theme', t);
}
