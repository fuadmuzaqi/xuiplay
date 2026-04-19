const state = {
  library: [],
  activeGenreId: null,
  activeTrack: null,
  activeTrackIndex: -1,
  player: null,
  playerReady: false,
  isPlaying: false,
  volume: 70,
  youtubeApiPromise: null,
  eqValues: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
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
  volumeRange: document.getElementById("volumeRange"),
  coverArtwork: document.getElementById("coverArtwork"),
  eqPanel: document.getElementById("eqPanel"),
  eqToggleBtn: document.getElementById("eqToggleBtn"),
  eqSliders: document.getElementById("eqSliders"),
  eqVisualizer: document.getElementById("eqVisualizer"),
  themeToggle: document.getElementById("themeToggle")
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
  loadLibrary();
});

function bindEvents() {
  refs.playPauseBtn.addEventListener("click", onPlayPause);
  refs.prevBtn.addEventListener("click", playPrevious);
  refs.nextBtn.addEventListener("click", playNext);
  refs.volumeRange.addEventListener("input", onVolumeChange);

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
      refs.playlistContainer.innerHTML = `
        <div class="empty-state">
          Belum ada genre atau track. Tambahkan dulu dari halaman admin.
        </div>
      `;
      return;
    }

    state.activeGenreId = state.activeGenreId || state.library[0].id;
    renderGenres();
    renderPlaylist();
  } catch (error) {
    refs.playlistContainer.innerHTML = `
      <div class="empty-state">Gagal memuat library. Coba refresh halaman.</div>
    `;
  }
}

function renderGenres() {
  refs.genreTabs.innerHTML = state.library
    .map((genre) => `
      <button
        class="genre-tab ${genre.id === state.activeGenreId ? "active" : ""}"
        type="button"
        data-genre-id="${genre.id}">
        📁 ${escapeHtml(genre.name)}
      </button>
    `)
    .join("");

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
    refs.playlistContainer.innerHTML = `
      <div class="empty-state">Genre ini belum punya lagu.</div>
    `;
    return;
  }

  refs.playlistContainer.innerHTML = tracks.map((track, index) => {
    const activeClass = state.activeTrack?.id === track.id ? "active" : "";
    const initials = getInitials(track.title);
    const thumb = track.coverUrl
      ? `<img src="${escapeAttribute(track.coverUrl)}" alt="${escapeAttribute(track.title)}" loading="lazy" width="56" height="56">`
      : initials;

    return `
      <article class="track-card ${activeClass}" data-track-id="${track.id}">
        <div class="track-thumb" style="--accent:${escapeAttribute(track.accentColor || "#01696f")}">
          ${thumb}
        </div>
        <div class="track-meta">
          <h3>${escapeHtml(track.title)}</h3>
          <p>${escapeHtml(track.artist || "Unknown artist")}</p>
        </div>
        <button class="track-action" type="button" data-track-index="${index}" aria-label="Putar ${escapeAttribute(track.title)}">
          ${state.activeTrack?.id === track.id && state.isPlaying ? "⏸" : "▶"}
        </button>
      </article>
    `;
  }).join("");

  refs.playlistContainer.querySelectorAll(".track-action").forEach((button) => {
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

  await ensureYouTubeApi();
  if (!state.player) {
    createPlayer(track.youtubeVideoId);
    if (autoplay) {
      state.pendingAutoplay = true;
    }
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
  refs.coverArtwork.style.background = `linear-gradient(135deg, ${track.accentColor || "#01696f"}, rgba(161,44,123,0.7))`;
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

function onVolumeChange(event) {
  const value = Number(event.target.value);
  state.volume = value;
  if (state.playerReady && state.player) {
    state.player.setVolume(value);
  }
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
        event.target.setVolume(state.volume);
        if (state.pendingAutoplay) {
          state.pendingAutoplay = false;
          event.target.playVideo();
        }
      },
      onStateChange: (event) => {
        const playing = event.data === window.YT.PlayerState.PLAYING;
        state.isPlaying = playing;
        refs.playPauseBtn.textContent = playing ? "⏸" : "▶";
        refs.eqVisualizer.classList.toggle("playing", playing);

        if (event.data === window.YT.PlayerState.ENDED) {
          playNext();
        }

        renderPlaylist();
      }
    }
  });
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
      updateEqVisualBoost();
    });
  });

  updateEqVisualBoost();
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

  updateEqVisualBoost();
}

function updateEqVisualBoost() {
  const average = state.eqValues.reduce((sum, value) => sum + Math.abs(value), 0) / state.eqValues.length;
  const boost = `${Math.min(52, 20 + average * 5)}%`;
  refs.eqVisualizer.style.setProperty("--eq-boost", boost);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  refs.themeToggle.textContent = theme === "dark" ? "☀" : "☾";
}

function getInitials(text) {
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
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
