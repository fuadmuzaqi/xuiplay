const state = {
  library: [],
  activeGenreId: null,
  activeTrack: null,
  activeTrackIndex: -1,
  player: null,
  playerReady: false,
  isPlaying: false,
  youtubeApiPromise: null,
  pendingAutoplay: false,
  theme: localStorage.getItem('theme') || "dark",
  progressInterval: null
};

const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
};

const refs = {
  genreTabs: document.getElementById("genreTabs"),
  playlistContainer: document.getElementById("playlistContainer"),
  genreHeading: document.getElementById("genreHeading"),
  trackCount: document.getElementById("trackCount"),
  nowTitle: document.getElementById("nowTitle"),
  nowArtist: document.getElementById("nowArtist"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  timeBar: document.getElementById("timeBar"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  themeToggle: document.getElementById("themeToggle")
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(state.theme);
  bindEvents();
  loadLibrary();
});

function bindEvents() {
  refs.playPauseBtn.addEventListener("click", onPlayPause);
  refs.prevBtn.addEventListener("click", playPrevious);
  refs.nextBtn.addEventListener("click", playNext);

  refs.timeBar.addEventListener("change", (e) => {
    if (state.player && state.playerReady) {
      state.player.seekTo(e.target.value, true);
    }
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

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

async function loadLibrary() {
  try {
    const response = await fetch("/api/library");
    const data = await response.json();
    state.library = data.genres || [];
    if (!state.library.length) return;

    state.activeGenreId = state.activeGenreId || state.library[0].id;
    renderGenres();
    renderPlaylist();
  } catch (error) {
    console.error("Gagal memuat library");
  }
}

function renderGenres() {
  refs.genreTabs.innerHTML = state.library.map((genre) => `
    <button class="genre-tab ${genre.id === state.activeGenreId ? "active" : ""}" 
            type="button" data-genre-id="${genre.id}">
      ${genre.name}
    </button>
  `).join("");

  refs.genreTabs.querySelectorAll(".genre-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeGenreId = Number(button.dataset.genreId);
      renderGenres();
      renderPlaylist();
    });
  });
}

function renderPlaylist() {
  const activeGenre = state.library.find((genre) => genre.id === state.activeGenreId);
  const tracks = activeGenre?.tracks || [];
  refs.genreHeading.textContent = activeGenre?.name || "Genre";
  refs.trackCount.textContent = `${tracks.length} track`;

  refs.playlistContainer.innerHTML = tracks.map((track, index) => {
    const isActive = state.activeTrack?.id === track.id;
    return `
      <button class="track-row ${isActive ? "active" : ""}" 
              type="button" data-track-index="${index}">
        <span class="track-info">
          <span class="track-title">${track.title}</span>
          <span class="track-artist">${track.artist || "Unknown artist"}</span>
        </span>
        <span class="track-play-icon">
          ${isActive && state.isPlaying ? ICONS.pause : ICONS.play}
        </span>
      </button>
    `;
  }).join("");

  refs.playlistContainer.querySelectorAll(".track-row").forEach((button) => {
    button.addEventListener("click", () => selectTrack(Number(button.dataset.trackIndex), true));
  });
}

async function selectTrack(index, autoplay = true) {
  const activeGenre = state.library.find((genre) => genre.id === state.activeGenreId);
  const track = activeGenre?.tracks?.[index];
  if (!track) return;

  state.activeTrack = track;
  state.activeTrackIndex = index;
  refs.nowTitle.textContent = track.title;
  refs.nowArtist.textContent = track.artist || "Unknown artist";

  await ensureYouTubeApi();
  if (!state.player) {
    createPlayer(track.youtubeVideoId);
    if (autoplay) state.pendingAutoplay = true;
  } else {
    autoplay ? state.player.loadVideoById(track.youtubeVideoId) : state.player.cueVideoById(track.youtubeVideoId);
  }
  renderPlaylist();
}

function onPlayPause() {
  if (!state.activeTrack) { selectTrack(0, true); return; }
  if (!state.playerReady || !state.player) return;
  state.isPlaying ? state.player.pauseVideo() : state.player.playVideo();
}

function playPrevious() {
  const activeGenre = state.library.find((genre) => genre.id === state.activeGenreId);
  if (!activeGenre?.tracks?.length) return;
  const nextIndex = state.activeTrackIndex > 0 ? state.activeTrackIndex - 1 : activeGenre.tracks.length - 1;
  selectTrack(nextIndex, true);
}

function playNext() {
  const activeGenre = state.library.find((genre) => genre.id === state.activeGenreId);
  if (!activeGenre?.tracks?.length) return;
  const nextIndex = state.activeTrackIndex < activeGenre.tracks.length - 1 ? state.activeTrackIndex + 1 : 0;
  selectTrack(nextIndex, true);
}

function ensureYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (state.youtubeApiPromise) return state.youtubeApiPromise;
  state.youtubeApiPromise = new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return state.youtubeApiPromise;
}

function createPlayer(videoId) {
  state.player = new window.YT.Player("youtube-player", {
    height: "1", width: "1", videoId,
    playerVars: { autoplay: 0, controls: 0, rel: 0, playsinline: 1 },
    events: {
      onReady: (event) => {
        state.playerReady = true;
        if (state.pendingAutoplay) { state.pendingAutoplay = false; event.target.playVideo(); }
      },
      onStateChange: (event) => {
        state.isPlaying = (event.data === window.YT.PlayerState.PLAYING);
        refs.playPauseBtn.innerHTML = state.isPlaying ? ICONS.pause : ICONS.play;
        if (state.isPlaying) startProgressTimer();
        else clearInterval(state.progressInterval);
        if (event.data === window.YT.PlayerState.ENDED) playNext();
        renderPlaylist();
      }
    }
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  refs.themeToggle.textContent = theme === "dark" ? "☀" : "☾";
}
