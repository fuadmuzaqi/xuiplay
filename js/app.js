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
  progressTimer: null,
  eqValues: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  isSeeking: false
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
  eqPanel: document.getElementById("eqPanel"),
  eqToggleBtn: document.getElementById("eqToggleBtn"),
  eqSliders: document.getElementById("eqSliders"),
  themeToggle: document.getElementById("themeToggle"),
  progressBar: document.getElementById("progressBar"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime")
};

const EQ_FREQUENCIES = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  warm: [2, 3, 2, 1, 0, -1, -1, 0, 1, 1],
  club: [3, 2, 1, 0, -1, 1, 2, 3, 2, 1]
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(state.theme);
  bindEvents();
  renderEqSliders();
  resetProgressUi();
  loadLibrary();
});

function bindEvents() {
  refs.playPauseBtn.addEventListener("click", onPlayPause);
  refs.prevBtn.addEventListener("click", playPrevious);
  refs.nextBtn.addEventListener("click", playNext);

  refs.eqToggleBtn.addEventListener("click", () => {
    const expanded = refs.eqToggleBtn.getAttribute("aria-expanded") === "true";
    refs.eqToggleBtn.setAttribute("aria-expanded", String(!expanded));
    refs.eqPanel.hidden = expanded;
  });

  refs.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
  });

  document.querySelectorAll(".preset-btn").forEach((button) => {
    button.addEventListener("click", () => applyEqPreset(button.dataset.preset));
  });

  refs.progressBar.addEventListener("input", () => {
    state.isSeeking = true;
    const duration = getPlayerDuration();
    const nextTime = (Number(refs.progressBar.value) / 100) * duration;
    refs.currentTime.textContent = formatTime(nextTime);
    paintProgressBar(Number(refs.progressBar.value));
  });

  refs.progressBar.addEventListener("change", () => {
    const duration = getPlayerDuration();
    const nextTime = (Number(refs.progressBar.value) / 100) * duration;

    if (state.playerReady && state.player && duration > 0) {
      state.player.seekTo(nextTime, true);
    }

    state.isSeeking = false;
  });
}

async function loadLibrary() {
  try {
    const response = await fetch("/api/library");
    const data = await response.json();

    state.library = data.genres || [];

    if (!state.library.length) {
      refs.genreTabs.innerHTML = "";
      refs.genreHeading.textContent = "Belum ada genre";
      refs.trackCount.textContent = "0 track";
      refs.playlistContainer.innerHTML = `<div class="empty-state">Belum ada genre atau lagu.</div>`;
      return;
    }

    state.activeGenreId = state.activeGenreId || state.library[0].id;
    renderGenres();
    renderPlaylist();
  } catch (error) {
    refs.playlistContainer.innerHTML = `<div class="empty-state">Gagal memuat playlist.</div>`;
  }
}

function renderGenres() {
  refs.genreTabs.innerHTML = state.library.map((genre) => `
    <button
      class="genre-tab ${genre.id === state.activeGenreId ? "active" : ""}"
      type="button"
      data-genre-id="${genre.id}">
      ${escapeHtml(genre.name)}
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

  if (!tracks.length) {
    refs.playlistContainer.innerHTML = `<div class="empty-state">Genre ini belum punya lagu.</div>`;
    return;
  }

  refs.playlistContainer.innerHTML = tracks.map((track, index) => `
    <button
      class="track-row ${state.activeTrack?.id === track.id ? "active" : ""}"
      type="button"
      data-track-index="${index}"
      aria-label="Putar ${escapeAttribute(track.title)}">
      <span class="track-info">
        <span class="track-title">${escapeHtml(track.title)}</span>
        <span class="track-artist">${escapeHtml(track.artist || "Unknown artist")}</span>
      </span>
      <span class="track-playmark">
        ${state.activeTrack?.id === track.id && state.isPlaying ? "⏸" : "▶"}
      </span>
    </button>
  `).join("");

  refs.playlistContainer.querySelectorAll(".track-row").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.trackIndex);
      selectTrack(index, true);
    });
  });
}

async function selectTrack(index, autoplay = true) {
  const activeGenre = state.library.find((genre) => genre.id === state.activeGenreId);
  const track = activeGenre?.tracks?.[index];
  if (!track) return;

  state.activeTrack = track;
  state.activeTrackIndex = index;
  updateNowPlaying(track);
  resetProgressUi();

  await ensureYouTubeApi();

  if (!state.player) {
    createPlayer(track.youtubeVideoId);
    if (autoplay) state.pendingAutoplay = true;
    renderPlaylist();
    return;
  }

  if (autoplay) {
    state.player.loadVideoById(track.youtubeVideoId);
  } else {
    state.player.cueVideoById(track.youtubeVideoId);
  }

  renderPlaylist();
}

function updateNowPlaying(track) {
  refs.nowTitle.textContent = track.title;
  refs.nowArtist.textContent = track.artist || "Unknown artist";
}

function onPlayPause() {
  if (!state.activeTrack) {
    selectTrack(0, true);
    return;
  }

  if (!state.playerReady || !state.player) return;

  if (state.isPlaying) {
    state.player.pauseVideo();
  } else {
    state.player.playVideo();
  }
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
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  if (state.youtubeApiPromise) {
    return state.youtubeApiPromise;
  }

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
    height: "1",
    width: "1",
    videoId,
    playerVars: {
      autoplay: 0,
      controls: 0,
      rel: 0,
      modestbranding: 1,
      playsinline: 1
    },
    events: {
      onReady: (event) => {
        state.playerReady = true;
        updateProgressUi();
        if (state.pendingAutoplay) {
          state.pendingAutoplay = false;
          event.target.playVideo();
        }
      },
      onStateChange: (event) => {
        const playing = event.data === window.YT.PlayerState.PLAYING;
        state.isPlaying = playing;
        refs.playPauseBtn.textContent = playing ? "⏸" : "▶";

        if (playing) {
          startProgressLoop();
        } else {
          stopProgressLoop();
          updateProgressUi();
        }

        if (event.data === window.YT.PlayerState.ENDED) {
          playNext();
        }

        renderPlaylist();
      }
    }
  });
}

function startProgressLoop() {
  stopProgressLoop();
  state.progressTimer = window.setInterval(updateProgressUi, 500);
}

function stopProgressLoop() {
  if (state.progressTimer) {
    window.clearInterval(state.progressTimer);
    state.progressTimer = null;
  }
}

function updateProgressUi() {
  if (!state.playerReady || !state.player || state.isSeeking) return;

  const duration = getPlayerDuration();
  const current = Number(state.player.getCurrentTime?.() || 0);

  refs.currentTime.textContent = formatTime(current);
  refs.durationTime.textContent = formatTime(duration);

  if (duration > 0) {
    const percent = Math.min(100, (current / duration) * 100);
    refs.progressBar.value = String(percent);
    paintProgressBar(percent);
  } else {
    refs.progressBar.value = "0";
    paintProgressBar(0);
  }
}

function resetProgressUi() {
  refs.progressBar.value = "0";
  refs.currentTime.textContent = "0:00";
  refs.durationTime.textContent = "0:00";
  paintProgressBar(0);
}

function getPlayerDuration() {
  if (!state.playerReady || !state.player) return 0;
  return Number(state.player.getDuration?.() || 0);
}

function paintProgressBar(percent) {
  refs.progressBar.style.setProperty("--progress", `${percent}%`);
}

function renderEqSliders() {
  refs.eqSliders.innerHTML = EQ_FREQUENCIES.map((freq, index) => `
    <div class="eq-band">
      <input
        type="range"
        min="-6"
        max="6"
        value="${state.eqValues[index]}"
        step="1"
        data-band-index="${index}"
        aria-label="Band ${freq} Hz"
      />
      <label>${freq}</label>
    </div>
  `).join("");

  refs.eqSliders.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      const index = Number(input.dataset.bandIndex);
      state.eqValues[index] = Number(input.value);
    });
  });
}

function applyEqPreset(name) {
  const preset = EQ_PRESETS[name];
  if (!preset) return;

  state.eqValues = [...preset];

  refs.eqSliders.querySelectorAll("input").forEach((input, index) => {
    input.value = String(state.eqValues[index]);
  });

  document.querySelectorAll(".preset-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === name);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  refs.themeToggle.textContent = theme === "dark" ? "☀" : "☾";
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}
