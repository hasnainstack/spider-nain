/* ═══════════════════════════════════════════
   SPIDER-NAIN · filters.js
   Canvas Comic/Art Filter Engine
   ═══════════════════════════════════════════ */

const Filters = (() => {

  const processCanvas = () => document.getElementById('process-canvas');

  // ── Utility: load image → canvas ────────────────
  function loadToCanvas(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
      const c  = processCanvas();
      const W  = img.naturalWidth;
      const H  = img.naturalHeight;
      const scale = Math.min(1, 800 / Math.max(W, H));
      c.width  = Math.floor(W * scale);
      c.height = Math.floor(H * scale);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, c.width, c.height);
      callback(ctx, c.width, c.height);
    };
    img.src = dataUrl;
  }

  // ── COMIC filter ───────────────────────────────
  function comic(dataUrl, callback) {
    loadToCanvas(dataUrl, (ctx, W, H) => {
      const c = processCanvas();
      const stylized = document.createElement('canvas');
      stylized.width = W; stylized.height = H;
      const sctx = stylized.getContext('2d');

      // Smooth color prep before quantization for less noisy transitions.
      sctx.filter = 'saturate(2.1) contrast(1.45) brightness(1.08)';
      sctx.drawImage(c, 0, 0);
      sctx.filter = 'none';

      const baseData = sctx.getImageData(0, 0, W, H);
      const bd = baseData.data;

      // Softer posterization keeps color blocks but avoids harsh flicker.
      for (let i = 0; i < bd.length; i += 4) {
        bd[i]   = Math.round(bd[i]   / 32) * 32;
        bd[i+1] = Math.round(bd[i+1] / 32) * 32;
        bd[i+2] = Math.round(bd[i+2] / 32) * 32;
      }
      sctx.putImageData(baseData, 0, 0);

      // Light blur pass for a more "animated cel" finish.
      ctx.clearRect(0, 0, W, H);
      ctx.filter = 'blur(0.6px)';
      ctx.drawImage(stylized, 0, 0);
      ctx.filter = 'none';

      const edgeData = ctx.getImageData(0, 0, W, H);
      const ed = edgeData.data;
      const gray = new Uint8Array(W * H);

      for (let i = 0; i < W * H; i++) {
        const p = i * 4;
        gray[i] = (0.299 * ed[p] + 0.587 * ed[p + 1] + 0.114 * ed[p + 2]) | 0;
      }

      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = y * W + x;
          const gx = -gray[(y - 1) * W + (x - 1)] - 2 * gray[y * W + (x - 1)] - gray[(y + 1) * W + (x - 1)]
                   + gray[(y - 1) * W + (x + 1)] + 2 * gray[y * W + (x + 1)] + gray[(y + 1) * W + (x + 1)];
          const gy = -gray[(y - 1) * W + (x - 1)] - 2 * gray[(y - 1) * W + x] - gray[(y - 1) * W + (x + 1)]
                   + gray[(y + 1) * W + (x - 1)] + 2 * gray[(y + 1) * W + x] + gray[(y + 1) * W + (x + 1)];
          const mag = Math.sqrt(gx * gx + gy * gy);
          const p = idx * 4;

          // Blend in edge darkness instead of hard black pixels.
          const edgeAlpha = Math.max(0, Math.min(1, (mag - 26) / 38));
          if (edgeAlpha > 0) {
            const keep = 1 - edgeAlpha * 0.92;
            ed[p]     = ed[p] * keep;
            ed[p + 1] = ed[p + 1] * keep;
            ed[p + 2] = ed[p + 2] * keep;
          }

          // Gentle cel shading bands for a smoother animated look.
          const lum = gray[idx];
          const shade = lum < 75 ? 0.90 : lum < 145 ? 0.97 : lum < 210 ? 1.03 : 1.08;
          ed[p]     = Math.max(0, Math.min(255, ed[p] * shade));
          ed[p + 1] = Math.max(0, Math.min(255, ed[p + 1] * shade));
          ed[p + 2] = Math.max(0, Math.min(255, ed[p + 2] * shade));
        }
      }

      ctx.putImageData(edgeData, 0, 0);
      callback(c.toDataURL('image/jpeg', .94));
    });
  }

  // ── NEON filter ───────────────────────────────
  function neon(dataUrl, callback) {
    loadToCanvas(dataUrl, (ctx, W, H) => {
      const c = processCanvas();
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        const lum = 0.299*r + 0.587*g + 0.114*b;
        // Cyan/magenta neon shift
        d[i]   = Math.min(255, b * 0.3 + lum * 0.4);          // push red from blue
        d[i+1] = Math.min(255, lum * 0.2);                     // suppress green
        d[i+2] = Math.min(255, b * 1.8 + r * 0.3);            // pump blue
        // High contrast
        const bright = (d[i] + d[i+1] + d[i+2]) / 3;
        const fac = bright > 128 ? 1.6 : 0.4;
        d[i]   = Math.min(255, d[i]   * fac);
        d[i+1] = Math.min(255, d[i+1] * fac);
        d[i+2] = Math.min(255, d[i+2] * fac);
      }
      ctx.putImageData(imgData, 0, 0);

      // Glow overlay
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      const tctx = tmp.getContext('2d');
      tctx.filter = 'blur(6px) contrast(1.5)';
      tctx.drawImage(c, 0, 0);
      // Blend: lighten
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      callback(c.toDataURL('image/jpeg', .92));
    });
  }

  // ── RETRO filter ─────────────────────────────
  function retro(dataUrl, callback) {
    loadToCanvas(dataUrl, (ctx, W, H) => {
      const c = processCanvas();
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2];
        const lum = 0.299*r + 0.587*g + 0.114*b;
        // Posterize to 3 bands
        const q = Math.round(lum / 85) * 85;
        // Warm sepia tones
        d[i]   = Math.min(255, q * 1.20);
        d[i+1] = Math.min(255, q * 0.82);
        d[i+2] = Math.min(255, q * 0.50);
      }
      ctx.putImageData(imgData, 0, 0);

      // Grain overlay
      const grain = ctx.getImageData(0, 0, W, H);
      const gd = grain.data;
      for (let i = 0; i < gd.length; i += 4) {
        const n = (Math.random() - 0.5) * 40;
        gd[i]   = Math.max(0, Math.min(255, gd[i]   + n));
        gd[i+1] = Math.max(0, Math.min(255, gd[i+1] + n));
        gd[i+2] = Math.max(0, Math.min(255, gd[i+2] + n));
      }
      ctx.putImageData(grain, 0, 0);

      // Vignette
      const vgn = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8);
      vgn.addColorStop(0, 'rgba(0,0,0,0)');
      vgn.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vgn;
      ctx.fillRect(0, 0, W, H);

      callback(c.toDataURL('image/jpeg', .92));
    });
  }

  // ── RAW (no filter) ──────────────────────────
  function bw(dataUrl, callback) {
    loadToCanvas(dataUrl, (ctx, W, H) => {
      const c = processCanvas();
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;
      const size = W * H;

      const gray = new Uint8Array(size);
      const inv = new Uint8Array(size);
      const blur = new Float32Array(size);

      // Grayscale base.
      for (let i = 0; i < size; i++) {
        const p = i * 4;
        const g = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) | 0;
        gray[i] = g;
        inv[i] = 255 - g;
      }

      // Box blur on inverted grayscale (radius 2) for pencil-style dodge blend.
      for (let y = 0; y < H; y++) {
        const yMin = Math.max(0, y - 2);
        const yMax = Math.min(H - 1, y + 2);
        for (let x = 0; x < W; x++) {
          const xMin = Math.max(0, x - 2);
          const xMax = Math.min(W - 1, x + 2);
          let sum = 0;
          let count = 0;
          for (let yy = yMin; yy <= yMax; yy++) {
            const row = yy * W;
            for (let xx = xMin; xx <= xMax; xx++) {
              sum += inv[row + xx];
              count++;
            }
          }
          blur[y * W + x] = sum / count;
        }
      }

      // Build sketch tone with dodge blend + soft ink edge darkening + paper grain.
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          const p = i * 4;

          const dodge = Math.min(255, (gray[i] * 255) / (255 - blur[i] + 1));

          const gx = -gray[(y - 1) * W + (x - 1)] - 2 * gray[y * W + (x - 1)] - gray[(y + 1) * W + (x - 1)]
                   + gray[(y - 1) * W + (x + 1)] + 2 * gray[y * W + (x + 1)] + gray[(y + 1) * W + (x + 1)];
          const gy = -gray[(y - 1) * W + (x - 1)] - 2 * gray[(y - 1) * W + x] - gray[(y - 1) * W + (x + 1)]
                   + gray[(y + 1) * W + (x - 1)] + 2 * gray[(y + 1) * W + x] + gray[(y + 1) * W + (x + 1)];
          const edge = Math.min(255, Math.sqrt(gx * gx + gy * gy));
          const ink = 255 - Math.min(255, edge * 1.25);

          let tone = dodge * 0.84 + ink * 0.16;
          tone += (Math.random() - 0.5) * 10;
          tone = Math.max(0, Math.min(255, tone));

          d[p] = tone;
          d[p + 1] = tone;
          d[p + 2] = tone;
        }
      }

      // Keep border pixels coherent.
      for (let x = 0; x < W; x++) {
        const top = x * 4;
        const bot = ((H - 1) * W + x) * 4;
        const t = gray[x];
        const b = gray[(H - 1) * W + x];
        d[top] = d[top + 1] = d[top + 2] = t;
        d[bot] = d[bot + 1] = d[bot + 2] = b;
      }
      for (let y = 0; y < H; y++) {
        const leftI = y * W;
        const rightI = y * W + (W - 1);
        const lp = leftI * 4;
        const rp = rightI * 4;
        d[lp] = d[lp + 1] = d[lp + 2] = gray[leftI];
        d[rp] = d[rp + 1] = d[rp + 2] = gray[rightI];
      }

      ctx.putImageData(imgData, 0, 0);
      callback(c.toDataURL('image/jpeg', .93));
    });
  }

  function raw(dataUrl, callback) { callback(dataUrl); }

  // ── Dispatcher ───────────────────────────────
  function apply(filterName, dataUrl, callback) {
    const map = { comic, neon, retro, bw, raw };
    (map[filterName] || raw)(dataUrl, callback);
  }

  return { apply };
})();
