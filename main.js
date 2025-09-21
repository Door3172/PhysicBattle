(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ui = {
    damage: document.getElementById('damage'),
    bounces: document.getElementById('bounces'),
    combo: document.getElementById('combo'),
    energy: document.getElementById('energy'),
    fps: document.getElementById('fps'),
  };

  const buttons = {
    reset: document.getElementById('resetBtn'),
    pause: document.getElementById('pauseBtn'),
    slow: document.getElementById('slowBtn'),
    trail: document.getElementById('trailBtn'),
  };

  const ARENA = {
    x: 70,
    y: 70,
    width: canvas.width - 140,
    height: canvas.height - 140,
  };

  const randRange = (min, max) => Math.random() * (max - min) + min;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const wrapAngle = (angle) => (angle + Math.PI * 3) % (Math.PI * 2) - Math.PI;

  class FpsMeter {
    constructor() {
      this.last = performance.now();
      this.smoothed = 0;
    }
    sample(now) {
      const dt = (now - this.last) / 1000;
      this.last = now;
      const fps = dt > 0 ? 1 / dt : 0;
      this.smoothed = this.smoothed ? mix(this.smoothed, fps, 0.12) : fps;
      return { dt: clamp(dt, 0, 0.05), fps: this.smoothed };
    }
  }

  class Body {
    constructor({ x, y, vx = 0, vy = 0, mass = 1, drag = 0.996, radius = 30 }) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.mass = mass;
      this.drag = drag;
      this.radius = radius;
    }
    integrate(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const dragFactor = Math.pow(this.drag, dt * 60);
      this.vx *= dragFactor;
      this.vy *= dragFactor;
    }
    applyImpulse(ix, iy) {
      this.vx += ix / this.mass;
      this.vy += iy / this.mass;
    }
    bounce(bounds, elasticity = 0.86) {
      let bounced = false;
      const minX = bounds.x + this.radius;
      const maxX = bounds.x + bounds.width - this.radius;
      const minY = bounds.y + this.radius;
      const maxY = bounds.y + bounds.height - this.radius;

      if (this.x < minX) {
        this.x = minX;
        this.vx = Math.abs(this.vx) * elasticity;
        bounced = true;
      } else if (this.x > maxX) {
        this.x = maxX;
        this.vx = -Math.abs(this.vx) * elasticity;
        bounced = true;
      }

      if (this.y < minY) {
        this.y = minY;
        this.vy = Math.abs(this.vy) * elasticity;
        bounced = true;
      } else if (this.y > maxY) {
        this.y = maxY;
        this.vy = -Math.abs(this.vy) * elasticity;
        bounced = true;
      }

      return bounced;
    }
  }

  class Lancer extends Body {
    constructor() {
      super({
        x: mix(ARENA.x, ARENA.x + ARENA.width, 0.72),
        y: mix(ARENA.y, ARENA.y + ARENA.height, 0.28),
        vx: randRange(-240, -120),
        vy: randRange(80, 120),
        mass: 1.4,
        drag: 0.995,
        radius: 42,
      });
      this.length = 180;
      this.shaftWidth = 18;
      this.tipLength = 46;
      this.tailWidth = 26;
      this.angle = -Math.PI / 4;
      this.angularVelocity = 0;
      this.turnAssist = 0;
    }
    tipPosition() {
      return {
        x: this.x + Math.cos(this.angle) * (this.tipLength + this.length * 0.5),
        y: this.y + Math.sin(this.angle) * (this.tipLength + this.length * 0.5),
      };
    }
    alignToVelocity(dt) {
      const speed = Math.hypot(this.vx, this.vy);
      if (speed < 10) {
        this.angularVelocity *= Math.pow(0.6, dt * 60);
        return;
      }
      const target = Math.atan2(this.vy, this.vx) + this.turnAssist;
      const delta = wrapAngle(target - this.angle);
      const maxTurn = mix(4.2, 6.6, clamp(speed / 480, 0, 1));
      this.angle += clamp(delta, -maxTurn * dt, maxTurn * dt);
      this.angularVelocity = clamp(this.angularVelocity + delta * dt, -6, 6);
      this.turnAssist = mix(this.turnAssist, 0, dt * 2.2);
    }
    draw(ctx, energy) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const shaftGradient = ctx.createLinearGradient(-this.length * 0.5, 0, this.tipLength, 0);
      shaftGradient.addColorStop(0, '#f3f3f3');
      shaftGradient.addColorStop(0.45, '#c0c6d6');
      shaftGradient.addColorStop(1, '#ffe169');

      ctx.fillStyle = shaftGradient;
      ctx.strokeStyle = 'rgba(31,27,41,0.45)';
      ctx.lineWidth = 2.4;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-this.length * 0.5, -this.shaftWidth / 2, this.length, this.shaftWidth, 9);
      } else {
        const h = this.shaftWidth / 2;
        ctx.moveTo(-this.length * 0.5, -h);
        ctx.lineTo(this.length * 0.5, -h);
        ctx.lineTo(this.length * 0.5, h);
        ctx.lineTo(-this.length * 0.5, h);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(this.tipLength, 0);
      ctx.lineTo(this.length * 0.5 + this.tipLength, 0);
      ctx.lineTo(this.tipLength - 10, this.shaftWidth * 0.55);
      ctx.closePath();
      ctx.fillStyle = '#ffe169';
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-this.length * 0.5, 0);
      ctx.lineTo(-this.length * 0.5 - this.tailWidth, -this.shaftWidth * 0.7);
      ctx.lineTo(-this.length * 0.5 - this.tailWidth * 0.25, 0);
      ctx.lineTo(-this.length * 0.5 - this.tailWidth, this.shaftWidth * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#35324c';
      ctx.fill();

      const aura = clamp(energy / 140, 0, 1);
      if (aura > 0.05) {
        const gradient = ctx.createRadialGradient(
          this.length * 0.45,
          0,
          4,
          this.length * 0.45,
          0,
          mix(18, 68, aura)
        );
        gradient.addColorStop(0, 'rgba(255, 225, 105, 0.9)');
        gradient.addColorStop(1, 'rgba(255, 79, 109, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.length * 0.45, 0, mix(18, 68, aura), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  class Shuriken extends Body {
    constructor() {
      super({
        x: mix(ARENA.x, ARENA.x + ARENA.width, 0.32),
        y: mix(ARENA.y, ARENA.y + ARENA.height, 0.62),
        vx: randRange(180, 260),
        vy: randRange(-200, -90),
        mass: 1,
        drag: 0.992,
        radius: 38,
      });
      this.spin = randRange(5, 8);
      this.angle = randRange(0, Math.PI * 2);
      this.spikes = 5;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const inner = 15;
      const outer = 42;

      ctx.beginPath();
      for (let i = 0; i < this.spikes * 2; i++) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = (i * Math.PI) / this.spikes;
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const gradient = ctx.createRadialGradient(0, 0, 4, 0, 0, outer);
      gradient.addColorStop(0, '#dadef6');
      gradient.addColorStop(0.55, '#74799b');
      gradient.addColorStop(1, '#3a3656');
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(18, 16, 33, 0.65)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      ctx.restore();
    }
  }

  const input = {
    shift: false,
    focus: false,
  };

  const state = {
    lancer: new Lancer(),
    shuriken: new Shuriken(),
    stats: {
      damage: 0,
      bounces: 0,
      comboChain: 0,
      maxCombo: 0,
      energy: 70,
    },
    lastImpactTime: 0,
    comboTimer: 0,
    fpsMeter: new FpsMeter(),
    paused: false,
    slowMotion: false,
    trail: false,
  };

  function resetGame() {
    state.lancer = new Lancer();
    state.shuriken = new Shuriken();
    state.stats.damage = 0;
    state.stats.bounces = 0;
    state.stats.comboChain = 0;
    state.stats.maxCombo = 0;
    state.stats.energy = 70;
    state.lastImpactTime = 0;
    state.comboTimer = 0;
  }

  function updateUI(fps) {
    ui.damage.textContent = Math.round(state.stats.damage);
    ui.bounces.textContent = state.stats.bounces;
    ui.combo.textContent = state.stats.maxCombo;
    ui.energy.textContent = Math.round(state.stats.energy);
    ui.fps.textContent = fps ? Math.round(fps) : '0';

    buttons.pause.textContent = state.paused ? '繼續 (P)' : '暫停 (P)';
    buttons.slow.dataset.active = state.slowMotion ? 'true' : 'false';
    buttons.trail.dataset.active = state.trail ? 'true' : 'false';
  }

  function drawArena() {
    if (state.trail) {
      ctx.fillStyle = 'rgba(248, 246, 255, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const gradient = ctx.createLinearGradient(0, ARENA.y, 0, ARENA.y + ARENA.height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(1, 'rgba(210, 222, 255, 0.92)');

    ctx.fillStyle = gradient;
    ctx.fillRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);

    ctx.strokeStyle = 'rgba(42, 34, 54, 0.7)';
    ctx.lineWidth = 5;
    ctx.strokeRect(ARENA.x, ARENA.y, ARENA.width, ARENA.height);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(42, 34, 54, 0.08)';
    ctx.beginPath();
    const step = 60;
    for (let x = ARENA.x + step; x < ARENA.x + ARENA.width; x += step) {
      ctx.moveTo(x, ARENA.y);
      ctx.lineTo(x, ARENA.y + ARENA.height);
    }
    for (let y = ARENA.y + step; y < ARENA.y + ARENA.height; y += step) {
      ctx.moveTo(ARENA.x, y);
      ctx.lineTo(ARENA.x + ARENA.width, y);
    }
    ctx.stroke();
  }

  function drawEnergyRing() {
    const { lancer } = state;
    const radius = mix(48, 82, clamp(state.stats.energy / 140, 0, 1));
    ctx.save();
    ctx.translate(lancer.x, lancer.y);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 79, 109, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    drawArena();
    drawEnergyRing();
    state.shuriken.draw(ctx);
    state.lancer.draw(ctx, state.stats.energy);
  }

  function resolveImpact() {
    const tip = state.lancer.tipPosition();
    const dx = state.shuriken.x - tip.x;
    const dy = state.shuriken.y - tip.y;
    const dist = Math.hypot(dx, dy);
    const minDist = state.shuriken.radius * 0.9;

    if (dist > minDist) return;

    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);

    const relVx = state.lancer.vx - state.shuriken.vx;
    const relVy = state.lancer.vy - state.shuriken.vy;
    const closing = relVx * nx + relVy * ny;
    if (closing <= 0) return;

    const impactStrength = clamp(closing * 0.9 + 260, 120, 540);
    const damage = clamp(8 + closing * 0.2, 5, 160);

    const penetration = minDist - dist;
    if (penetration > 0) {
      state.shuriken.x += nx * penetration * 0.7;
      state.shuriken.y += ny * penetration * 0.7;
      state.lancer.x -= nx * penetration * 0.3;
      state.lancer.y -= ny * penetration * 0.3;
    }

    state.shuriken.applyImpulse(nx * impactStrength, ny * impactStrength);
    state.lancer.applyImpulse(-nx * impactStrength * 0.55, -ny * impactStrength * 0.55);
    state.shuriken.spin += closing * 0.02 + 5;
    state.lancer.turnAssist += (Math.random() > 0.5 ? 1 : -1) * 0.6;

    state.stats.damage += damage;
    const energyBoost = 14 + Math.sqrt(damage) * 2.5;
    state.stats.energy = clamp(state.stats.energy + energyBoost, 0, 160);

    const now = performance.now();
    if (now - state.lastImpactTime < 1100) {
      state.stats.comboChain += 1;
    } else {
      state.stats.comboChain = 1;
    }
    state.lastImpactTime = now;
    state.comboTimer = 1.2;
    state.stats.maxCombo = Math.max(state.stats.maxCombo, state.stats.comboChain);
  }

  function applyFocusEffect(dt) {
    if (!input.focus || state.stats.energy <= 0) return;
    const slowFactor = Math.pow(0.9, dt * 60);
    state.shuriken.vx *= slowFactor;
    state.shuriken.vy *= slowFactor;
    state.stats.energy = clamp(state.stats.energy - dt * 18, 0, 160);
    if (state.stats.energy <= 0) {
      input.focus = false;
    }
  }

  function update(dt) {
    if (state.paused) {
      return;
    }

    if (input.shift && state.stats.energy > 5) {
      input.focus = true;
    } else if (!input.shift) {
      input.focus = false;
    }

    const timeScale = state.slowMotion ? 0.35 : 1;
    const scaledDt = dt * timeScale;

    state.lancer.vy += 18 * scaledDt;
    state.shuriken.vy += 24 * scaledDt;

    state.lancer.integrate(scaledDt);
    state.shuriken.integrate(scaledDt);

    state.lancer.alignToVelocity(scaledDt);
    state.shuriken.angle += state.shuriken.spin * scaledDt;
    state.shuriken.spin *= Math.pow(0.99, scaledDt * 60);

    applyFocusEffect(scaledDt);

    if (state.lancer.bounce(ARENA)) state.stats.bounces += 1;
    if (state.shuriken.bounce(ARENA)) state.stats.bounces += 1;

    resolveImpact();

    if (state.stats.comboChain > 0) {
      state.comboTimer -= scaledDt;
      if (state.comboTimer <= 0) {
        state.stats.comboChain = 0;
        state.comboTimer = 0;
      }
    }

    state.stats.energy = clamp(state.stats.energy + scaledDt * 2.2, 0, 160);
  }

  function frame(now) {
    const { dt, fps } = state.fpsMeter.sample(now);
    update(state.paused ? 0 : dt);
    render();
    updateUI(fps);
    requestAnimationFrame(frame);
  }

  function impulseLancer(x, y) {
    const lancer = state.lancer;
    const dx = x - lancer.x;
    const dy = y - lancer.y;
    const dist = Math.hypot(dx, dy) || 1;
    const directionX = dx / dist;
    const directionY = dy / dist;

    const energyFactor = clamp(state.stats.energy / 90, 0.6, 2.4);
    const impulsePower = 240 * energyFactor;
    lancer.applyImpulse(directionX * impulsePower, directionY * impulsePower);
    lancer.turnAssist += directionY * 0.5 - directionX * 0.2;

    state.stats.energy = clamp(state.stats.energy - 22, 0, 160);
  }

  function canvasPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    impulseLancer(x, y);
  }

  buttons.reset.addEventListener('click', () => {
    resetGame();
  });

  buttons.pause.addEventListener('click', () => {
    state.paused = !state.paused;
    updateUI(state.fpsMeter.smoothed);
  });

  buttons.slow.addEventListener('click', () => {
    state.slowMotion = !state.slowMotion;
    updateUI(state.fpsMeter.smoothed);
  });

  buttons.trail.addEventListener('click', () => {
    state.trail = !state.trail;
    updateUI(state.fpsMeter.smoothed);
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    switch (event.key) {
      case 'r':
      case 'R':
        resetGame();
        break;
      case 'p':
      case 'P':
        state.paused = !state.paused;
        break;
      case 's':
      case 'S':
        state.slowMotion = !state.slowMotion;
        break;
      case 't':
      case 'T':
        state.trail = !state.trail;
        break;
      case 'Shift':
        input.shift = true;
        input.focus = state.stats.energy > 0;
        break;
      default:
        break;
    }
    updateUI(state.fpsMeter.smoothed);
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === 'Shift') {
      input.shift = false;
      input.focus = false;
    }
  });

  let pointerActive = false;

  canvas.addEventListener('pointerdown', (event) => {
    pointerActive = true;
    canvasPointer(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!pointerActive) return;
    canvasPointer(event);
  });

  window.addEventListener('pointerup', () => {
    pointerActive = false;
  });

  window.addEventListener('pointercancel', () => {
    pointerActive = false;
  });

  canvas.addEventListener('pointerleave', () => {
    pointerActive = false;
  });

  canvas.addEventListener('pointercancel', () => {
    pointerActive = false;
  });

  resetGame();
  updateUI();
  requestAnimationFrame((now) => {
    state.fpsMeter.last = now;
    requestAnimationFrame(frame);
  });
})();
