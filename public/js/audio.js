/**
 * Safari Frenzy — Procedural Audio Engine
 *
 * 100% Web Audio API, no audio files.
 * - Chiptune-style sound effects (square/triangle/sawtooth oscillators + noise)
 * - Background music: simple bass + melody loop in pentatonic, ~120 BPM
 * - Master volume + mute persistence via localStorage
 * - Lazy init: AudioContext only created on first user interaction (browser policy)
 */

(() => {
  const STORAGE_KEY = 'safari_frenzy_audio_v1';

  const settings = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { muted: false, volume: 0.6 };
    } catch {
      return { muted: false, volume: 0.6 };
    }
  })();

  function persistSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }

  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let musicBpm = 120;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = settings.muted ? 0 : settings.volume;
      master.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.85;
      sfxGain.connect(master);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.35;
      musicGain.connect(master);
    } catch (err) {
      console.warn('Audio init failed:', err);
      ctx = null;
    }
    return ctx;
  }

  /* ============ Sound primitives ============ */

  function noteHz(semitone) {
    // semitone offset from A4 (440Hz)
    return 440 * Math.pow(2, semitone / 12);
  }

  /**
   * Play a single tone with envelope.
   * @param {object} opts
   *   freq:        Hz
   *   duration:    seconds
   *   type:        'square'|'sawtooth'|'triangle'|'sine'
   *   attack/decay/sustain/release (ADSR)
   *   gain:        0–1
   *   bend:        target frequency at end (for swoop)
   */
  function tone({ freq, duration = 0.15, type = 'square', attack = 0.005, decay = 0.05, sustain = 0.4, release = 0.05, gain = 0.5, bend = null, target = sfxGain }) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (bend !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, bend), now + duration);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + attack);
    env.gain.linearRampToValueAtTime(gain * sustain, now + attack + decay);
    env.gain.setValueAtTime(gain * sustain, now + duration - release);
    env.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(env);
    env.connect(target);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * Play a noise burst (used for explosions, wind).
   */
  function noise({ duration = 0.2, gain = 0.4, lowpass = 4000, highpass = null }) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    let last = src;
    if (lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      last.connect(lp); last = lp;
    }
    if (highpass) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = highpass;
      last.connect(hp); last = hp;
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    last.connect(env);
    env.connect(sfxGain);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  /* ============ SFX library ============ */

  const SFX = {
    catchCommon() {
      tone({ freq: noteHz(7),  duration: 0.06, type: 'square',   gain: 0.25, attack: 0.002, decay: 0.02, sustain: 0.3, release: 0.04 });
      setTimeout(() => tone({ freq: noteHz(12), duration: 0.08, type: 'square', gain: 0.3, attack: 0.002, decay: 0.02, sustain: 0.3, release: 0.05 }), 50);
    },
    catchUncommon() {
      tone({ freq: noteHz(7),  duration: 0.06, type: 'square', gain: 0.3 });
      setTimeout(() => tone({ freq: noteHz(11), duration: 0.06, type: 'square', gain: 0.3 }), 60);
      setTimeout(() => tone({ freq: noteHz(14), duration: 0.10, type: 'square', gain: 0.35 }), 120);
    },
    catchRare() {
      // Triumphant arpeggio
      [0, 4, 7, 12].forEach((semi, i) => {
        setTimeout(() => tone({ freq: noteHz(semi + 7), duration: 0.10, type: 'square', gain: 0.4 }), i * 70);
      });
    },
    miss() {
      tone({ freq: noteHz(-5), duration: 0.18, type: 'sawtooth', gain: 0.18, bend: noteHz(-15), attack: 0.005, decay: 0.05, sustain: 0.4, release: 0.08 });
    },
    boomb() {
      // Explosion: low rumble + noise
      noise({ duration: 0.35, gain: 0.5, lowpass: 800 });
      tone({ freq: 80, duration: 0.4, type: 'sawtooth', gain: 0.5, bend: 30, attack: 0.005, release: 0.15 });
    },
    powerup() {
      [0, 4, 7, 12, 16, 19].forEach((semi, i) => {
        setTimeout(() => tone({ freq: noteHz(semi + 12), duration: 0.06, type: 'triangle', gain: 0.35 }), i * 40);
      });
    },
    levelComplete() {
      [0, 4, 7, 12].forEach((semi, i) => {
        setTimeout(() => tone({ freq: noteHz(semi + 7), duration: 0.18, type: 'square', gain: 0.4 }), i * 120);
      });
      setTimeout(() => tone({ freq: noteHz(19), duration: 0.4, type: 'square', gain: 0.45 }), 480);
    },
    levelUp() {
      [0, 7, 12].forEach((semi, i) => {
        setTimeout(() => tone({ freq: noteHz(semi + 12), duration: 0.10, type: 'square', gain: 0.4 }), i * 80);
      });
    },
    gameOver() {
      [0, -3, -7, -12].forEach((semi, i) => {
        setTimeout(() => tone({ freq: noteHz(semi), duration: 0.25, type: 'sawtooth', gain: 0.3, bend: noteHz(semi - 4) }), i * 200);
      });
    },
    bonusStart() {
      // Anticipation rise
      for (let i = 0; i < 8; i++) {
        setTimeout(() => tone({ freq: noteHz(i * 2), duration: 0.05, type: 'square', gain: 0.3 }), i * 60);
      }
    },
    achievement() {
      [0, 7, 12, 19].forEach((semi, i) => {
        setTimeout(() => tone({ freq: noteHz(semi + 7), duration: 0.08, type: 'triangle', gain: 0.4 }), i * 70);
      });
    },
    click() {
      tone({ freq: noteHz(4), duration: 0.04, type: 'square', gain: 0.18 });
    },
    freeze() {
      // Glassy descending
      for (let i = 0; i < 5; i++) {
        setTimeout(() => tone({ freq: noteHz(20 - i * 3), duration: 0.12, type: 'sine', gain: 0.22 }), i * 60);
      }
    },
    masterBall() {
      // Thicker capture sound
      tone({ freq: noteHz(0), duration: 0.12, type: 'square', gain: 0.4 });
      setTimeout(() => tone({ freq: noteHz(7), duration: 0.12, type: 'square', gain: 0.4 }), 100);
      setTimeout(() => tone({ freq: noteHz(14), duration: 0.18, type: 'square', gain: 0.45 }), 200);
      setTimeout(() => tone({ freq: noteHz(19), duration: 0.30, type: 'square', gain: 0.5 }), 380);
    },
  };

  /* ============ Background music ============ */

  // Pentatonic minor in A: A C D E G (semitones 0, 3, 5, 7, 10 from A)
  // Bass pattern: 16 steps. Each step is a 16th note.
  const BASS_PATTERN = [
    -24, null, -24, null, -17, null, -24, null,
    -22, null, -22, null, -19, null, -15, null,
  ];

  // Melody pattern: 32 steps (2 bars).
  const MELODY_PATTERN = [
    0, null, 3, null, 7, null, 5, 3,
    7, null, null, 10, 12, null, 7, null,
    5, null, 3, null, 0, null, -2, null,
    3, null, 5, null, 7, null, null, null,
  ];

  function playMusicStep() {
    if (!ctx || settings.muted) return;
    const bassNote = BASS_PATTERN[musicStep % BASS_PATTERN.length];
    const melodyNote = MELODY_PATTERN[musicStep % MELODY_PATTERN.length];

    if (bassNote !== null && bassNote !== undefined) {
      tone({
        freq: noteHz(bassNote), duration: 0.18, type: 'triangle',
        gain: 0.35, attack: 0.002, decay: 0.04, sustain: 0.5, release: 0.05,
        target: musicGain,
      });
    }
    if (melodyNote !== null && melodyNote !== undefined) {
      tone({
        freq: noteHz(melodyNote + 12), duration: 0.14, type: 'square',
        gain: 0.18, attack: 0.002, decay: 0.03, sustain: 0.5, release: 0.04,
        target: musicGain,
      });
    }
    musicStep++;
  }

  function startMusic() {
    if (!ensureContext()) return;
    if (musicTimer) return;
    if (ctx.state === 'suspended') ctx.resume();
    const stepMs = (60 * 1000) / musicBpm / 4; // 16th notes
    musicStep = 0;
    musicTimer = setInterval(playMusicStep, stepMs);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function setMusicTempo(bpm) {
    musicBpm = bpm;
    if (musicTimer) {
      stopMusic();
      startMusic();
    }
  }

  /* ============ Public API ============ */

  function play(name) {
    if (!ensureContext() || settings.muted) return;
    if (ctx.state === 'suspended') ctx.resume();
    const fn = SFX[name];
    if (fn) fn();
  }

  function setMuted(m) {
    settings.muted = !!m;
    persistSettings();
    if (master) master.gain.value = settings.muted ? 0 : settings.volume;
    if (settings.muted) stopMusic();
  }

  function setVolume(v) {
    settings.volume = Math.max(0, Math.min(1, v));
    persistSettings();
    if (master && !settings.muted) master.gain.value = settings.volume;
  }

  function isMuted() { return settings.muted; }
  function getVolume() { return settings.volume; }

  // Auto-resume context on first user interaction (browser policy)
  function unlock() {
    ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  ['pointerdown', 'keydown'].forEach(ev =>
    document.addEventListener(ev, unlock, { once: true, passive: true })
  );

  window.SafariAudio = {
    play,
    startMusic,
    stopMusic,
    setMusicTempo,
    setMuted,
    setVolume,
    isMuted,
    getVolume,
  };
})();
