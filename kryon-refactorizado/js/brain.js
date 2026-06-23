/**
 * brain.js — Fondo de "cerebro vivo": canvas con neuronas, venas y pulsos.
 * Módulo cargado como script clásico (sin import/export) para funcionar
 * abriendo index.html directamente con file://.
 */

/** Punto luminoso flotante que representa una neurona. */
class Neuron {
  constructor(canvas) {
    this.c = canvas;
    this.reset();
  }
  reset() {
    this.x = Math.random() * (this.c?.width || 1000);
    this.y = Math.random() * (this.c?.height || 800);
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.3;
    this.r = Math.random() * 2.2 + 0.8;
    this.o = Math.random() * 0.4 + 0.08;
    this.phase = Math.random() * Math.PI * 2;
    this.color = Math.random() < 0.7 ? 'rgba(165,240,252,' : 'rgba(232,201,122,';
  }
  update(time) {
    this.x += this.vx * 0.5;
    this.y += this.vy * 0.5;
    if (this.x < 0 || this.x > (this.c?.width || 1000)) this.vx *= -1;
    if (this.y < 0 || this.y > (this.c?.height || 800)) this.vy *= -1;
    this.o = 0.08 + Math.sin(time * 2 + this.phase) * 0.06;
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.color + this.o + ')';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${this.o * 1.5})`;
    ctx.fill();
  }
}

/** Destello que viaja a lo largo de una "vena" del cerebro. */
class Pulse {
  constructor(veins, canvas) {
    const v = veins[Math.floor(Math.random() * veins.length)];
    if (v && v.points.length > 1) {
      this.vein = v;
      this.progress = 0;
      this.speed = 0.005 + Math.random() * 0.015;
      this.life = 1;
    } else {
      this.life = 0;
    }
  }
  update() {
    if (!this.vein) { this.life = 0; return; }
    this.progress += this.speed;
    if (this.progress >= 1) this.life = 0;
  }
  draw(ctx) {
    if (!this.vein || this.life <= 0) return;
    const pts = this.vein.points;
    const idx = Math.floor(this.progress * (pts.length - 1));
    const nIdx = Math.min(idx + 1, pts.length - 1);
    const t = this.progress * (pts.length - 1) - idx;
    const x = pts[idx].x + (pts[nIdx].x - pts[idx].x) * t;
    const y = pts[idx].y + (pts[nIdx].y - pts[idx].y) * t;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, 12);
    grad.addColorStop(0, 'rgba(77, 240, 255, 0.9)');
    grad.addColorStop(0.5, 'rgba(77, 240, 255, 0.3)');
    grad.addColorStop(1, 'rgba(77, 240, 255, 0)');
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

const BrainEngine = {
  canvas: null, ctx: null, neurons: [], veins: [], pulses: [], time: 0, running: false,

  init() {
    this.canvas = document.getElementById('brainCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    for (let i = 0; i < 80; i++) this.neurons.push(new Neuron(this.canvas));
    this.generateVeins();
    for (let i = 0; i < 15; i++) this.pulses.push(new Pulse(this.veins, this.canvas));
    this.running = true;
    this.animate();
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.generateVeins();
  },

  generateVeins() {
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    this.veins = [];
    for (let i = 0; i < 5; i++) {
      this.veins.push({ points: this.generateVeinPath(cx - 200 - i * 30, cy - 100, cx - 100, cy + 100, 6 + i), color: `rgba(139, 26, 43, ${0.15 + i * 0.02})`, width: 1.5 + i * 0.4 });
      this.veins.push({ points: this.generateVeinPath(cx + 200 + i * 30, cy - 100, cx + 100, cy + 100, 6 + i), color: `rgba(26, 58, 92, ${0.15 + i * 0.02})`, width: 1.5 + i * 0.4 });
    }
    for (let i = 0; i < 8; i++) this.veins.push({ points: this.generateVeinPath(cx - 150 + i * 40, cy + 50, cx + 100 - i * 30, cy + 150, 4), color: `rgba(77, 240, 255, ${0.06 + i * 0.01})`, width: 1 + i * 0.2 });
  },

  generateVeinPath(sx, sy, ex, ey, seg) {
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      pts.push({ x: sx + (ex - sx) * t + (Math.random() - 0.5) * 60, y: sy + (ey - sy) * t + (Math.random() - 0.5) * 60 });
    }
    return pts;
  },

  animate(timestamp = 0) {
    if (!this.running) return;
    requestAnimationFrame((t) => this.animate(t));
    this.time = timestamp * 0.001;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
    ctx.beginPath(); ctx.ellipse(cx - 60, cy, 280, 320, 0.15, 0, Math.PI * 2); ctx.fillStyle = 'rgba(8, 14, 30, 0.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(77, 240, 255, 0.06)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + 60, cy, 280, 320, -0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 250); ctx.quadraticCurveTo(cx - 30, cy, cx, cy + 250); ctx.strokeStyle = 'rgba(77, 240, 255, 0.05)'; ctx.lineWidth = 3; ctx.stroke();
    this.veins.forEach(v => {
      ctx.beginPath();
      ctx.moveTo(v.points[0].x, v.points[0].y);
      for (let i = 1; i < v.points.length; i++) {
        const xc = (v.points[i].x + v.points[i - 1].x) / 2, yc = (v.points[i].y + v.points[i - 1].y) / 2;
        ctx.quadraticCurveTo(v.points[i - 1].x, v.points[i - 1].y, xc, yc);
      }
      ctx.strokeStyle = v.color; ctx.lineWidth = v.width; ctx.stroke();
    });
    this.neurons.forEach(n => { n.update(this.time); n.draw(ctx); });
    for (let i = 0; i < this.neurons.length; i++) {
      for (let j = i + 1; j < this.neurons.length; j++) {
        const dx = this.neurons[i].x - this.neurons[j].x, dy = this.neurons[i].y - this.neurons[j].y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          const alpha = 0.07 * (1 - dist / 110) * (0.7 + 0.3 * Math.sin(this.time * 3 + i));
          ctx.beginPath(); ctx.moveTo(this.neurons[i].x, this.neurons[i].y); ctx.lineTo(this.neurons[j].x, this.neurons[j].y);
          ctx.strokeStyle = `rgba(77, 240, 255, ${alpha})`; ctx.lineWidth = 0.4; ctx.stroke();
        }
      }
    }
    this.pulses.forEach(p => { p.update(); p.draw(ctx); });
    if (this.pulses.length < 20 && Math.random() < 0.05) this.pulses.push(new Pulse(this.veins, this.canvas));
    this.pulses = this.pulses.filter(p => p.life > 0);
  },

  /** Health check usado por healer.js: ¿el motor sigue animando? */
  isHealthy() { return this.running && this.neurons.length > 0; }
};

(function (g) {
  g.BrainEngine = BrainEngine;
  g.Neuron = Neuron;
  g.Pulse = Pulse;
})(typeof window !== 'undefined' ? window : globalThis);
