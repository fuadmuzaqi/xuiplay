const state = {
  // ... (state awal sama seperti sebelumnya)
  player: null,
  isPlaying: false,
  progressInterval: null
};

const refs = {
  // ... (refs lainnya)
  timeBar: document.getElementById("timeBar"),
  currentTime: document.getElementById("currentTime"),
  durationTime: document.getElementById("durationTime"),
  genreTabs: document.getElementById("genreTabs"),
  playlistContainer: document.getElementById("playlistContainer"),
  playPauseBtn: document.getElementById("playPauseBtn"),
  // ... tambahkan refs baru sesuai ID di HTML
};

// Fungsi Baru: Update Progress Bar
function startProgressTimer() {
  state.progressInterval = setInterval(() => {
    if (state.player && state.isPlaying) {
      const current = state.player.getCurrentTime();
      const duration = state.player.getDuration();
      
      refs.timeBar.max = duration;
      refs.timeBar.value = current;
      
      refs.currentTime.textContent = formatTime(current);
      refs.durationTime.textContent = formatTime(duration);
    }
  }, 1000);
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

// Event Listener untuk Seek (Klik pada Time Bar)
refs.timeBar.addEventListener("input", (e) => {
  if (state.player) {
    state.player.seekTo(e.target.value);
  }
});

// Update fungsi createPlayer untuk menghidupkan timer
function createPlayer(videoId) {
  state.player = new window.YT.Player("youtube-player", {
    videoId,
    events: {
      onReady: (event) => {
        state.playerReady = true;
        if (state.pendingAutoplay) event.target.playVideo();
      },
      onStateChange: (event) => {
        state.isPlaying = event.data === window.YT.PlayerState.PLAYING;
        refs.playPauseBtn.textContent = state.isPlaying ? "⏸" : "▶";
        
        if (state.isPlaying) {
          startProgressTimer();
        } else {
          clearInterval(state.progressInterval);
        }

        if (event.data === window.YT.PlayerState.ENDED) playNext();
        renderPlaylist();
      }
    }
  });
}

// Tambahkan sisa fungsi (renderPlaylist, renderGenres, loadLibrary) 
// yang logika pengolah datanya sama seperti kode asli Anda.
