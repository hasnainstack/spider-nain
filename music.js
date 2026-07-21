/* ═══════════════════════════════════════════
   SPIDER-NAIN · music.js
   Web Audio API — Procedural Chiptune Engine
   ═══════════════════════════════════════════ */

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let bgTrack = null;
  let playing = false;
  let schedulerTimer = null;
  let nextNoteTime = 0;
  let currentBeat = 0;

  // ── Palette of synth "instruments" ──────────────
  const BPM = 148;
  const BEAT = 60 / BPM;
  const BAR  = BEAT * 4;

  // ── Song patterns (note frequencies in Hz, 0 = rest) ──
  const C3=130.81,D3=146.83,E3=164.81,F3=174.61,G3=196,A3=220,B3=246.94;
  const C4=261.63,D4=293.66,E4=329.63,F4=349.23,G4=392,A4=440,B4=493.88;
  const C5=523.25,D5=587.33,E5=659.25,F5=698.46,G5=784,A5=880;

  // Hero melody — 16 beats
  const MELODY = [
    C4,0,E4,0, G4,0,E4,C4, D4,0,F4,0, E4,C4,0,0,
    G4,0,A4,0, C5,0,A4,G4, E4,0,D4,0, C4,0,0,0
  ];

  // Bass line — 16 beats
  const BASS = [
    C3,0,C3,0, G3,0,G3,0, F3,0,F3,0, G3,0,G3,0,
    A3,0,A3,0, E3,0,E3,0, F3,0,F3,0, G3,0,C3,0
  ];

  // Chord stabs — every 2 beats
  const CHORDS = [
    [C4,E4,G4], 0, [F3,A3,C4], 0,
    [G3,B3,D4], 0, [C4,E4,G4], 0
  ];

  // Drum pattern — 1=kick, 2=snare, 3=hat, 4=hat+snare
  const DRUMS = [
    1,3,3,3, 2,3,1,3, 1,3,2,3, 1,3,3,4,
    1,3,3,3, 2,3,1,3, 1,3,2,3, 1,2,3,4
  ];

  let melodyIdx = 0, bassIdx = 0, drumIdx = 0, chordIdx = 0;
  let beatCount = 0;

  // ── Tone generators ─────────────────────────────
  function playTone(freq, startTime, duration, type='square', vol=0.18) {
    if (!freq || !ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.95);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  function playChord(freqs, startTime, duration, vol=0.10) {
    if (!freqs || !ctx) return;
    freqs.forEach(f => playTone(f, startTime, duration, 'triangle', vol));
  }

  function playKick(startTime) {
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(180, startTime);
    osc.frequency.exponentialRampToValueAtTime(30, startTime + 0.12);
    gain.gain.setValueAtTime(0.8, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(startTime); osc.stop(startTime + 0.22);
  }

  function playSnare(startTime) {
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.12;
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 1800;
    src.buffer = buf;
    gain.gain.setValueAtTime(0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);
    src.connect(filt); filt.connect(gain); gain.connect(masterGain);
    src.start(startTime); src.stop(startTime + 0.15);
  }

  function playHat(startTime, vol=0.18) {
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.04;
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) d[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 7000;
    src.buffer = buf;
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);
    src.connect(filt); filt.connect(gain); gain.connect(masterGain);
    src.start(startTime); src.stop(startTime + 0.06);
  }

  // ── SFX ─────────────────────────────────────────
  function sfx_thwip() {
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain); gain.connect(masterGain);
    osc.start(now); osc.stop(now + 0.3);
  }

  function sfx_pow() {
    if (!ctx) return;
    const now = ctx.currentTime;
    playKick(now);
    playSnare(now + 0.03);
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g); g.connect(masterGain);
    osc.start(now); osc.stop(now + 0.2);
  }

  function sfx_unlock() {
    if (!ctx) return;
    const now = ctx.currentTime;
    [C5, E5, G5].forEach((f, i) => playTone(f, now + i*0.08, 0.2, 'triangle', 0.3));
  }

  function sfx_upload() {
    if (!ctx) return;
    const now = ctx.currentTime;
    [C4, E4, G4, C5].forEach((f, i) => {
      playTone(f, now + i*0.06, 0.25, 'square', 0.2);
    });
  }

  function sfx_click() {
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone(G4, now, 0.06, 'square', 0.12);
  }

  function sfx_titleClick() {
    if (!ctx) return;
    const now = ctx.currentTime;
    sfx_thwip();
    setTimeout(() => sfx_pow(), 120);
  }

  // ── Scheduler ───────────────────────────────────
  function scheduleBeat(time) {
    const b16 = beatCount % 32; // 32 sixteenth-note cycle

    // Melody (eighth notes)
    if (beatCount % 2 === 0) {
      const mNote = MELODY[melodyIdx % MELODY.length];
      if (mNote) playTone(mNote, time, BEAT * 1.8, 'square', 0.14);
      melodyIdx++;
    }

    // Bass (quarter notes)
    if (beatCount % 4 === 0) {
      const bNote = BASS[bassIdx % BASS.length];
      if (bNote) playTone(bNote, time, BEAT * 3.5, 'sawtooth', 0.12);
      bassIdx++;
    }

    // Chord stabs (half notes)
    if (beatCount % 8 === 0) {
      const chord = CHORDS[chordIdx % CHORDS.length];
      if (chord) playChord(chord, time, BEAT * 1.2, 0.08);
      chordIdx++;
    }

    // Drums (16th notes)
    const drum = DRUMS[b16 % DRUMS.length];
    if (drum === 1) playKick(time);
    else if (drum === 2) playSnare(time);
    else if (drum === 3) playHat(time);
    else if (drum === 4) { playSnare(time); playHat(time, 0.1); }

    beatCount++;
    nextNoteTime += BEAT / 2; // 16th notes
  }

  function scheduler() {
    while (nextNoteTime < ctx.currentTime + 0.2) {
      scheduleBeat(nextNoteTime);
    }
    schedulerTimer = setTimeout(scheduler, 25);
  }

  // ── Public API ─────────────────────────────────
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.6;
    masterGain.connect(ctx.destination);

    bgTrack = new Audio('music.mp3');
    bgTrack.loop = true;
    bgTrack.preload = 'auto';
    bgTrack.volume = masterGain.gain.value;
  }

  function start() {
    if (!ctx) init();
    if (ctx.state === 'suspended') ctx.resume();

    if (bgTrack) {
      const playPromise = bgTrack.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((err) => {
          console.warn('Could not start background music:', err);
        });
      }
    }

    playing = true;
    // Update UI
    document.getElementById('music-icon').textContent = '⏸️';
    document.querySelector('.music-bars').classList.remove('paused');
    document.getElementById('music-hud').classList.remove('hud-hidden');
  }

  function stop() {
    playing = false;
    clearTimeout(schedulerTimer);
    if (bgTrack) bgTrack.pause();
    document.getElementById('music-icon').textContent = '🎵';
    document.querySelector('.music-bars').classList.add('paused');
  }

  function toggle() {
    if (!ctx) init();
    playing ? stop() : start();
  }

  function setVolume(val) {
    if (!masterGain) init();
    const volume = Math.max(0, Math.min(100, Number(val))) / 100;
    masterGain.gain.value = volume;
    if (bgTrack) bgTrack.volume = volume;
  }

  function isPlaying() { return playing; }

  return { init, start, stop, toggle, setVolume, isPlaying,
           sfx: { thwip: sfx_thwip, pow: sfx_pow, unlock: sfx_unlock,
                  upload: sfx_upload, click: sfx_click, titleClick: sfx_titleClick } };
})();
