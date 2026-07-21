/* ═══════════════════════════════════════════
   SPIDER-NAIN · app.js
   Main App: Comics, FX, Cursor, Confetti,
             Stickers, Scroll-unlock, Score
   ═══════════════════════════════════════════ */

'use strict';

// ─── Constants ──────────────────────────────────────────
const TOTAL_PANELS    = 5;
const ACTION_WORDS    = ['POW!','ZAP!','WOW!','BOOM!','YAY!','THWIP!','BAM!','SNAP!'];
const STICKER_LIST    = ['🕷️','🕸️','🦸','🦸‍♂️','🦹','🦹‍♂️','💪','👊','✊','🤜','🤛','⚡','💥','💫','✨','⭐','🌟','🔥','💢','💨'];

// ─── State ──────────────────────────────────────────────
const rawImages     = {};
const filters       = {1:'comic',2:'comic',3:'comic',4:'comic',5:'comic'};
let filledPanels    = 0;
let selectedSticker = null;
let webShootActive  = false;
let webLines        = [];

// ─────────────────────────────────────────────────────────
//  BOOT: Loading Screen
// ─────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  const bar = document.getElementById('load-bar');
  let pct   = 0;
  const iv  = setInterval(() => {
    pct += Math.random() * 18;
    if (pct >= 100) { pct = 100; clearInterval(iv); finishLoad(); }
    bar.style.width = pct + '%';
  }, 120);
});

function finishLoad() {
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('out');
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('score-hud').classList.add('visible');
      document.getElementById('sticker-bar').classList.add('visible');
      document.getElementById('music-hud').classList.remove('hud-hidden');
      buildStickerBar();
      ScrollUnlock.init();
      Cursor.init();
      Confetti.init();
      // Auto-start music after first interaction
      document.addEventListener('click', () => { if (!AudioEngine.isPlaying()) AudioEngine.start(); }, {once:true});
    }, 650);
  }, 400);
}

// ─────────────────────────────────────────────────────────
//  STICKER BAR
// ─────────────────────────────────────────────────────────
function buildStickerBar() {
  const list = document.getElementById('sticker-list');
  STICKER_LIST.forEach(s => {
    const el = document.createElement('div');
    el.className = 'sticker-item';
    el.textContent = s;
    el.title = 'Click panel to place sticker';
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', s);
      e.dataTransfer.effectAllowed = 'copy';
    });
    el.addEventListener('click', () => {
      document.querySelectorAll('.sticker-item').forEach(x => x.classList.remove('selected'));
      if (selectedSticker === s) {
        selectedSticker = null;
      } else {
        selectedSticker = s;
        el.classList.add('selected');
        AudioEngine.sfx.click();
      }
    });
    list.appendChild(el);
  });
}

// ─────────────────────────────────────────────────────────
//  SCROLL UNLOCK
// ─────────────────────────────────────────────────────────
const ScrollUnlock = {
  init() {
    const panels = document.querySelectorAll('.panel');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const panel = entry.target;
          if (panel.classList.contains('panel-locked')) {
            setTimeout(() => {
              panel.classList.remove('panel-locked');
              panel.classList.add('unlocked');
              AudioEngine.sfx.unlock();
              obs.unobserve(panel);
            }, 200);
          }
        }
      });
    }, { threshold: 0.25 });
    panels.forEach(p => obs.observe(p));
  }
};

// ─────────────────────────────────────────────────────────
//  COMIC MODULE
// ─────────────────────────────────────────────────────────
const Comics = {

  dragIcon(e, icon) {
    e.dataTransfer.setData('text/plain', icon);
    e.dataTransfer.effectAllowed = 'copy';
  },

  changeIcon(e, panelId) {
    e.preventDefault();
    e.stopPropagation();
    const icon = e.dataTransfer.getData('text/plain');
    if (icon) {
      document.getElementById(`icon-${panelId}`).textContent = icon;
      AudioEngine.sfx.click();
    }
  },

  openFolder(panelId) {
    document.getElementById(`file-${panelId}`).click();
  },

  handleSingleUpload(input, panelId) {
    const file = input.files[0];
    if (file) {
      Comics._loadFile(file, panelId);
    }
    input.value = '';
  },

  handleBulkUpload(input) {
    Array.from(input.files).forEach((file, i) => {
      if (i < TOTAL_PANELS) {
        setTimeout(() => Comics._loadFile(file, i + 1), i * 180);
      }
    });
    input.value = '';
  },

  dragOver(e, el) {
    e.preventDefault();
    el.querySelector('.drop-zone')?.classList.add('over');
  },

  dragLeave(el) {
    el.querySelector('.drop-zone')?.classList.remove('over');
  },

  dropFile(e, el, panelId) {
    e.preventDefault();
    el.querySelector('.drop-zone')?.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      Comics._loadFile(file, panelId);
    }
  },

  setFilter(panelId, name, btn) {
    if (!rawImages[panelId]) return;
    filters[panelId] = name;
    const fb = document.getElementById(`fb-${panelId}`);
    fb.querySelectorAll('.fb').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Comics._showOverlay();
    Filters.apply(name, rawImages[panelId], (url) => {
      Comics._setArtImage(panelId, url, false);
      Comics._hideOverlay();
    });
    AudioEngine.sfx.click();
  },

  resetAll() {
    for (let i = 1; i <= TOTAL_PANELS; i++) {
      document.getElementById(`art-${i}`).innerHTML     = '';
      document.getElementById(`art-${i}`).classList.remove('revealed');
      const dz = document.getElementById(`dz-${i}`);
      dz.style.cssText = '';
      document.getElementById(`fb-${i}`).classList.remove('visible');
      delete rawImages[i];
      filters[i] = 'comic';
      document.querySelectorAll(`#fb-${i} .fb`).forEach((b,idx) => b.classList.toggle('active', idx===0));
    }
    filledPanels = 0;
    Comics._updateScore();
    AudioEngine.sfx.pow();
    Confetti.burst(window.innerWidth/2, window.innerHeight/2, 30, '#ff1744');
  },

  saveComic() {
    AudioEngine.sfx.thwip();
    window.print();
  },

  // ── Private ────────────────────────────────────
  _loadFile(file, panelId) {
    const reader = new FileReader();
    Comics._showOverlay();
    reader.onload = (e) => {
      rawImages[panelId] = e.target.result;
      Filters.apply(filters[panelId], e.target.result, (url) => {
        Comics._setArtImage(panelId, url, true);
        Comics._hideOverlay();
        Comics._markFilled(panelId);
        AudioEngine.sfx.upload();
        Confetti.panelBurst(panelId);
      });
    };
    reader.readAsDataURL(file);
  },

  _setArtImage(panelId, url, showPop) {
    const art = document.getElementById(`art-${panelId}`);
    const dz  = document.getElementById(`dz-${panelId}`);
    const fb  = document.getElementById(`fb-${panelId}`);
    const previous = art.querySelector('img.art-current') || art.querySelector('img');
    const incoming = document.createElement('img');
    incoming.src = url;
    incoming.alt = `Panel ${panelId}`;
    incoming.draggable = false;
    incoming.className = 'art-incoming';
    art.appendChild(incoming);

    requestAnimationFrame(() => {
      incoming.classList.add('art-current');
      incoming.classList.remove('art-incoming');
    });

    if (previous && previous !== incoming) {
      previous.classList.remove('art-current', 'art-incoming');
      previous.classList.add('art-outgoing');
      setTimeout(() => {
        if (previous.parentNode) previous.remove();
      }, 620);
    }

    art.classList.remove('revealed');
    void art.offsetWidth;
    art.classList.add('revealed');
    dz.style.opacity = '0';
    dz.style.pointerEvents = 'none';
    setTimeout(() => dz.style.display = 'none', 350);
    fb.classList.add('visible');
    if (showPop) Comics._actionPop(panelId);
  },

  _actionPop(panelId) {
    const panel = document.getElementById(`panel-${panelId}`);
    const word  = ACTION_WORDS[Math.floor(Math.random() * ACTION_WORDS.length)];
    const pop   = document.createElement('div');
    pop.className = 'action-pop';
    pop.innerHTML = `<div class="action-pop-txt">${word}</div>`;
    panel.appendChild(pop);
    AudioEngine.sfx.pow();
    setTimeout(() => pop.remove(), 900);
  },

  _markFilled(panelId) {
    if (!rawImages[panelId]) return;
    filledPanels = Object.keys(rawImages).length;
    Comics._updateScore();
    if (filledPanels >= TOTAL_PANELS) {
      setTimeout(() => {
        const vibes = [
          'Classic Peter Parker Vibe 🕷️ - Friendly neighborhood hero!',
          'Miles Morales Energy ⚡ - Fresh, bold, and unstoppable!',
          'Gwen Stacy Style 💃 - Graceful yet fierce!',
          'Spider-Noir Aesthetic 🎭 - Dark, mysterious, and vintage!',
          'Spider-Ham Chaos 🐷 - Fun, wacky, and unpredictable!',
          'Spider-Punk Rebellion 🎸 - Anarchic and unapologetically cool!',
          'Ultimate Spider-Man Vibes 🎆 - Young, energetic, and heroic!'
        ];
        const randomVibe = vibes[Math.floor(Math.random() * vibes.length)];
        document.getElementById('vibe-text').textContent = `You're giving: ${randomVibe}`;
        document.getElementById('celebrate-modal').classList.remove('modal-hidden');
        Confetti.full();
        AudioEngine.sfx.unlock();
      }, 600);
    }
  },

  _updateScore() {
    document.getElementById('score-num').textContent = filledPanels;
    const stars = '⭐'.repeat(filledPanels) + '☆'.repeat(TOTAL_PANELS - filledPanels);
    document.getElementById('score-stars').textContent = stars;
  },

  _showOverlay()  { document.getElementById('proc-overlay').classList.add('active'); },
  _hideOverlay()  { document.getElementById('proc-overlay').classList.remove('active'); },
  _showAlert(msg) { setTimeout(() => alert(msg), 100); },
};

// ─────────────────────────────────────────────────────────
//  FX: Web Shoot & Panel Sticker placement
// ─────────────────────────────────────────────────────────
const FX = {
  webShootMode() {
    webShootActive = !webShootActive;
    const btn = document.getElementById('web-shoot-btn');
    if (webShootActive) {
      btn.classList.add('pulsing');
      btn.textContent = '🕸️ STOP WEBS';
      AudioEngine.sfx.thwip();
    } else {
      btn.classList.remove('pulsing');
      btn.textContent = '🕸️ WEB MODE';
      webLines = [];
    }
  }
};

// ─────────────────────────────────────────────────────────
//  CUSTOM CURSOR
// ─────────────────────────────────────────────────────────
const Cursor = {
  canvas: null, ctx: null,
  trail: [],
  mx: -100, my: -100,

  init() {
    this.canvas = document.getElementById('cursor-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('mousemove', (e) => {
      this.mx = e.clientX; this.my = e.clientY;
      this.trail.push({ x: e.clientX, y: e.clientY, life: 1 });
      if (this.trail.length > 28) this.trail.shift();
    });
    document.addEventListener('click', (e) => {
      if (webShootActive) this._shootWeb(e);
      else this._clickBurst(e.clientX, e.clientY);
    });
    this._loop();
  },

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  _loop() {
    const c   = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    c.clearRect(0, 0, W, H);

    // Draw web lines
    if (webShootActive && webLines.length >= 2) {
      c.save();
      c.strokeStyle = 'rgba(255,234,0,0.6)';
      c.lineWidth   = 1.5;
      c.shadowColor = 'rgba(255,234,0,0.8)';
      c.shadowBlur  = 6;
      c.beginPath();
      webLines.forEach((pt, i) => {
        if (i === 0) c.moveTo(pt.x, pt.y);
        else         c.lineTo(pt.x, pt.y);
      });
      c.stroke();
      c.restore();
    }

    // Decay + draw trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t   = this.trail[i];
      t.life   -= 0.06;
      if (t.life <= 0) { this.trail.splice(i, 1); continue; }
      const sz  = t.life * 7;
      const col = webShootActive ? `rgba(255,234,0,${t.life * 0.8})` : `rgba(255,23,68,${t.life * 0.6})`;
      c.beginPath();
      c.arc(t.x, t.y, sz, 0, Math.PI * 2);
      c.fillStyle = col;
      c.fill();
    }

    // Main cursor dot
    c.save();
    c.beginPath();
    c.arc(this.mx, this.my, 8, 0, Math.PI * 2);
    c.fillStyle   = webShootActive ? '#ffea00' : '#ff1744';
    c.shadowColor = webShootActive ? '#ffea00' : '#ff1744';
    c.shadowBlur  = 12;
    c.fill();

    // Cross-hair
    c.strokeStyle = 'white';
    c.lineWidth   = 1.5;
    c.globalAlpha = .8;
    c.beginPath();
    c.moveTo(this.mx - 12, this.my); c.lineTo(this.mx + 12, this.my);
    c.moveTo(this.mx, this.my - 12); c.lineTo(this.mx, this.my + 12);
    c.stroke();
    c.restore();

    requestAnimationFrame(() => this._loop());
  },

  _shootWeb(e) {
    webLines.push({ x: e.clientX, y: e.clientY });
    AudioEngine.sfx.thwip();
    // Particles
    Confetti.burst(e.clientX, e.clientY, 8, '#ffea00');
  },

  _clickBurst(x, y) {
    for (let i = 0; i < 6; i++) {
      this.trail.push({
        x: x + (Math.random()-0.5)*20,
        y: y + (Math.random()-0.5)*20,
        life: 1
      });
    }
  }
};

// ─────────────────────────────────────────────────────────
//  CONFETTI
// ─────────────────────────────────────────────────────────
const Confetti = {
  canvas: null, ctx: null,
  particles: [],

  init() {
    this.canvas = document.getElementById('confetti-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._loop();
  },

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  burst(x, y, count = 40, color = null) {
    const colors = ['#ff1744','#ffea00','#00e5ff','#ff4081','#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      this.particles.push({
        x, y,
        vx:    Math.cos(angle) * speed,
        vy:    Math.sin(angle) * speed - 3,
        color: color || colors[Math.floor(Math.random() * colors.length)],
        size:  3 + Math.random() * 5,
        life:  1,
        decay: 0.018 + Math.random() * 0.015,
        shape: Math.random() > 0.5 ? 'circle' : 'rect',
        rot:   Math.random() * Math.PI * 2,
        rotV:  (Math.random() - 0.5) * 0.2,
      });
    }
  },

  panelBurst(panelId) {
    const panel = document.getElementById(`panel-${panelId}`);
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    this.burst(rect.left + rect.width/2, rect.top + rect.height/2, 50);
  },

  full() {
    const W = this.canvas.width;
    for (let i = 0; i < 180; i++) {
      setTimeout(() => this.burst(Math.random() * W, 0, 1), i * 15);
    }
  },

  _loop() {
    const c = this.ctx;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const H = this.canvas.height;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p  = this.particles[i];
      p.vy    += 0.18;  // gravity
      p.vx    *= 0.99;  // drag
      p.x     += p.vx;
      p.y     += p.vy;
      p.life  -= p.decay;
      p.rot   += p.rotV;

      if (p.life <= 0 || p.y > H + 20) { this.particles.splice(i, 1); continue; }

      c.save();
      c.globalAlpha = p.life;
      c.fillStyle   = p.color;
      c.translate(p.x, p.y);
      c.rotate(p.rot);

      if (p.shape === 'circle') {
        c.beginPath();
        c.arc(0, 0, p.size/2, 0, Math.PI*2);
        c.fill();
      } else {
        c.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
      }
      c.restore();
    }

    requestAnimationFrame(() => this._loop());
  }
};

// ─────────────────────────────────────────────────────────
//  PANEL STICKER PLACEMENT
// ─────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (!selectedSticker) return;
  const panel = e.target.closest('.panel');
  if (!panel) return;
  if (e.target.closest('.drop-zone, .filter-bar, .ctrl-btn')) return;

  const rect = panel.getBoundingClientRect();
  const sEl  = document.createElement('div');
  sEl.className   = 'placed-sticker';
  sEl.textContent = selectedSticker;
  sEl.style.left  = (e.clientX - rect.left - 16) + 'px';
  sEl.style.top   = (e.clientY - rect.top  - 16) + 'px';

  let dragging = false, offX = 0, offY = 0;
  sEl.addEventListener('mousedown', (ev) => {
    dragging = true;
    offX = ev.offsetX; offY = ev.offsetY;
    ev.stopPropagation();
  });
  document.addEventListener('mousemove', (ev) => {
    if (!dragging) return;
    const r   = panel.getBoundingClientRect();
    sEl.style.left = (ev.clientX - r.left - offX) + 'px';
    sEl.style.top  = (ev.clientY - r.top  - offY) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  sEl.addEventListener('dblclick', (ev) => { sEl.remove(); ev.stopPropagation(); });

  panel.appendChild(sEl);
  AudioEngine.sfx.click();
  Confetti.burst(e.clientX, e.clientY, 12);
});

// Handle drag and drop for panel icons
document.addEventListener('dragover', (e) => {
  const panel = e.target.closest('.panel');
  const dzIcon = e.target.closest('.dz-icon');
  if ((panel && !e.target.closest('.drop-zone')) || dzIcon) {
    e.preventDefault();
  }
});

document.addEventListener('drop', (e) => {
  const dzIcon = e.target.closest('.dz-icon');
  if (dzIcon) {
    e.preventDefault();
    const icon = e.dataTransfer.getData('text/plain');
    if (icon) {
      dzIcon.textContent = icon;
      AudioEngine.sfx.click();
    }
    return;
  }

  const panel = e.target.closest('.panel');
  if (!panel || e.target.closest('.drop-zone, .filter-bar')) return;
  
  e.preventDefault();
  const icon = e.dataTransfer.getData('text/plain');
  if (!icon) return;

  const rect = panel.getBoundingClientRect();
  const sEl = document.createElement('div');
  sEl.className = 'placed-sticker';
  sEl.textContent = icon;
  sEl.style.left = (e.clientX - rect.left - 16) + 'px';
  sEl.style.top = (e.clientY - rect.top - 16) + 'px';

  let dragging = false, offX = 0, offY = 0;
  sEl.addEventListener('mousedown', (ev) => {
    dragging = true;
    offX = ev.offsetX; offY = ev.offsetY;
    ev.stopPropagation();
  });
  document.addEventListener('mousemove', (ev) => {
    if (!dragging) return;
    const r = panel.getBoundingClientRect();
    sEl.style.left = (ev.clientX - r.left - offX) + 'px';
    sEl.style.top = (ev.clientY - r.top - offY) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
  sEl.addEventListener('dblclick', (ev) => { sEl.remove(); ev.stopPropagation(); });

  panel.appendChild(sEl);
  AudioEngine.sfx.click();
  Confetti.burst(e.clientX, e.clientY, 12);
});

// ─────────────────────────────────────────────────────────
//  TITLE CLICK EASTER EGG
// ─────────────────────────────────────────────────────────
document.getElementById('main-title').addEventListener('click', () => {
  AudioEngine.sfx.titleClick();
  Confetti.burst(window.innerWidth/2, 100, 60);
});

// ─────────────────────────────────────────────────────────
//  KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') AudioEngine.toggle();
  if (e.key === 'w' || e.key === 'W') FX.webShootMode();
  if (e.key === 'Escape') {
    selectedSticker = null;
    webShootActive  = false;
    document.getElementById('web-shoot-btn').classList.remove('pulsing');
    document.getElementById('web-shoot-btn').textContent = '🕸️ WEB MODE';
    document.querySelectorAll('.sticker-item').forEach(x => x.classList.remove('selected'));
  }
});

// ─────────────────────────────────────────────────────────
//  EXPOSE GLOBALS (used by HTML onclick handlers)
// ─────────────────────────────────────────────────────────
window.Comics = Comics;
window.FX     = FX;
