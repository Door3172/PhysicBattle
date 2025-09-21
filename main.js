(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ui = {
    collisions: document.getElementById('collisions'),
    wallBounces: document.getElementById('wallBounces'),
    simTime: document.getElementById('simTime'),
    fps: document.getElementById('fps'),
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
    constructor({ x, y, vx = 0, vy = 0, mass = 1, drag = 1, radius = 30, hp = 10 }) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.mass = mass;
      this.drag = drag;
      this.radius = radius;
      this.maxHp = hp;
      this.hp = hp;
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
    ensureMomentum(minSpeed = 160) {
      const speed = Math.hypot(this.vx, this.vy);
      if (speed >= minSpeed) return;
      if (speed === 0) {
        const angle = randRange(0, Math.PI * 2);
        this.vx = Math.cos(angle) * minSpeed;
        this.vy = Math.sin(angle) * minSpeed;
        return;
      }
      const scale = minSpeed / speed;
      this.vx *= scale;
      this.vy *= scale;
    }
    bounce(bounds, elasticity = 1.05, minRebound = 210) {
      let bounced = false;
      const minX = bounds.x + this.radius;
      const maxX = bounds.x + bounds.width - this.radius;
      const minY = bounds.y + this.radius;
      const maxY = bounds.y + bounds.height - this.radius;

      if (this.x < minX) {
        this.x = minX;
        const rebound = Math.max(Math.abs(this.vx) * elasticity, minRebound);
        this.vx = rebound;
        this.vy += randRange(-18, 18);
        bounced = true;
      } else if (this.x > maxX) {
        this.x = maxX;
        const rebound = Math.max(Math.abs(this.vx) * elasticity, minRebound);
        this.vx = -rebound;
        this.vy += randRange(-18, 18);
        bounced = true;
      }

      if (this.y < minY) {
        this.y = minY;
        const rebound = Math.max(Math.abs(this.vy) * elasticity, minRebound);
        this.vy = rebound;
        this.vx += randRange(-18, 18);
        bounced = true;
      } else if (this.y > maxY) {
        this.y = maxY;
        const rebound = Math.max(Math.abs(this.vy) * elasticity, minRebound);
        this.vy = -rebound;
        this.vx += randRange(-18, 18);
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
        vx: randRange(-260, -140),
        vy: randRange(120, 220),
        mass: 1.4,
        drag: 1,
        radius: 44,
        hp: 12,
      });
      this.length = 190;
      this.shaftWidth = 20;
      this.tipLength = 58;
      this.tailWidth = 32;
      this.angle = -Math.PI / 4;
      this.angularVelocity = 0;
      this.turnAssist = 0;
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
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const half = this.length * 0.5;
      const shaftGradient = ctx.createLinearGradient(-half, 0, this.tipLength + 18, 0);
      shaftGradient.addColorStop(0, '#f8f8fb');
      shaftGradient.addColorStop(0.25, '#d2d7e6');
      shaftGradient.addColorStop(0.6, '#8f96b2');
      shaftGradient.addColorStop(1, '#fbe8a6');

      ctx.fillStyle = shaftGradient;
      ctx.strokeStyle = 'rgba(31, 27, 41, 0.45)';
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-half, -this.shaftWidth / 2, this.length, this.shaftWidth, 12);
      } else {
        const h = this.shaftWidth / 2;
        ctx.moveTo(-half, -h);
        ctx.lineTo(half, -h);
        ctx.lineTo(half, h);
        ctx.lineTo(-half, h);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();

      const ringPositions = [-half + 26, -half + 64, half - 40];
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(58, 50, 82, 0.45)';
      ringPositions.forEach((pos) => {
        ctx.beginPath();
        ctx.moveTo(pos, -this.shaftWidth * 0.55);
        ctx.lineTo(pos - 4, this.shaftWidth * 0.55);
        ctx.stroke();
      });

      ctx.beginPath();
      ctx.moveTo(this.tipLength + half, 0);
      ctx.lineTo(this.tipLength + half - 28, -this.shaftWidth * 0.9);
      ctx.lineTo(this.tipLength - 16, -this.shaftWidth * 0.55);
      ctx.lineTo(this.tipLength - 16, this.shaftWidth * 0.55);
      ctx.lineTo(this.tipLength + half - 28, this.shaftWidth * 0.9);
      ctx.closePath();

      const tipGradient = ctx.createLinearGradient(this.tipLength - 20, 0, this.tipLength + half, 0);
      tipGradient.addColorStop(0, '#fef6d8');
      tipGradient.addColorStop(0.4, '#ffe28a');
      tipGradient.addColorStop(1, '#ff9f68');
      ctx.fillStyle = tipGradient;
      ctx.fill();
      ctx.strokeStyle = 'rgba(31, 27, 41, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-half, 0);
      ctx.lineTo(-half - this.tailWidth * 0.8, -this.shaftWidth * 0.8);
      ctx.lineTo(-half - this.tailWidth, 0);
      ctx.lineTo(-half - this.tailWidth * 0.8, this.shaftWidth * 0.8);
      ctx.closePath();
      const tailGradient = ctx.createLinearGradient(-half - this.tailWidth, 0, -half, 0);
      tailGradient.addColorStop(0, '#403a64');
      tailGradient.addColorStop(1, '#665c8f');
      ctx.fillStyle = tailGradient;
      ctx.fill();

      ctx.restore();
    }
  }

  class Shuriken extends Body {
    constructor() {
      super({
        x: mix(ARENA.x, ARENA.x + ARENA.width, 0.32),
        y: mix(ARENA.y, ARENA.y + ARENA.height, 0.62),
        vx: randRange(220, 320),
        vy: randRange(-220, -140),
        mass: 1,
        drag: 1,
        radius: 40,
        hp: 10,
      });
      this.spin = randRange(6, 9);
      this.angle = randRange(0, Math.PI * 2);
      this.spikes = 5;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      const inner = 18;
      const outer = 46;

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

      const gradient = ctx.createRadialGradient(0, 0, 6, 0, 0, outer);
      gradient.addColorStop(0, '#f0f3ff');
      gradient.addColorStop(0.55, '#7f87a7');
      gradient.addColorStop(1, '#393550');
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.lineWidth = 3.2;
      ctx.strokeStyle = 'rgba(18, 16, 33, 0.65)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    }
  }

  const state = {
    lancer: new Lancer(),
    shuriken: new Shuriken(),
    stats: {
      collisions: 0,
      wallBounces: 0,
    },
    fpsMeter: new FpsMeter(),
    simulationTime: 0,
    collisionCooldown: 0,
  };

  function resetGame() {
    state.lancer = new Lancer();
    state.shuriken = new Shuriken();
    state.stats.collisions = 0;
    state.stats.wallBounces = 0;
    state.simulationTime = 0;
    state.collisionCooldown = 0;
  }

  function updateUI(fps) {
    ui.collisions.textContent = state.stats.collisions;
    ui.wallBounces.textContent = state.stats.wallBounces;
    ui.simTime.textContent = state.simulationTime.toFixed(1);
    ui.fps.textContent = fps ? Math.round(fps) : '0';
  }

  function drawArena() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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

  function drawHealthLabel(body, color) {
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 20px "Noto Sans TC", "Segoe UI", sans-serif';
    const hpText = `HP ${Math.max(0, Math.round(body.hp))}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.strokeText(hpText, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(hpText, 0, 0);
    ctx.restore();
  }

  function render() {
    drawArena();
    state.shuriken.draw(ctx);
    state.lancer.draw(ctx);
    drawHealthLabel(state.lancer, '#2a2236');
    drawHealthLabel(state.shuriken, '#2a2236');
  }

  function resolveCollision(canApplyDamage) {
    const lancer = state.lancer;
    const shuriken = state.shuriken;

    const dx = shuriken.x - lancer.x;
    const dy = shuriken.y - lancer.y;
    const dist = Math.hypot(dx, dy);
    const minDist = lancer.radius + shuriken.radius - 4;

    if (dist === 0 || dist >= minDist) {
      return 'none';
    }

    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);

    const penetration = minDist - dist;
    if (penetration > 0) {
      const totalMass = lancer.mass + shuriken.mass;
      const correction = penetration / totalMass;
      lancer.x -= nx * correction * shuriken.mass;
      lancer.y -= ny * correction * shuriken.mass;
      shuriken.x += nx * correction * lancer.mass;
      shuriken.y += ny * correction * lancer.mass;
    }

    const lancerVelocityAlongNormal = lancer.vx * nx + lancer.vy * ny;
    const shurikenVelocityAlongNormal = shuriken.vx * nx + shuriken.vy * ny;
    const relativeVelocity = shurikenVelocityAlongNormal - lancerVelocityAlongNormal;

    if (relativeVelocity >= 0) {
      return 'none';
    }

    const restitution = 1.02;
    const impulse = (-(1 + restitution) * relativeVelocity) / (1 / lancer.mass + 1 / shuriken.mass);
    const ix = impulse * nx;
    const iy = impulse * ny;

    lancer.vx -= ix / lancer.mass;
    lancer.vy -= iy / lancer.mass;
    shuriken.vx += ix / shuriken.mass;
    shuriken.vy += iy / shuriken.mass;

    shuriken.spin += clamp(-relativeVelocity * 0.015, -8, 8);
    lancer.turnAssist += clamp(nx * 0.3 - ny * 0.5, -1.2, 1.2);

    if (!canApplyDamage) {
      return 'contact';
    }

    const lancerPressure = Math.max(0, lancerVelocityAlongNormal);
    const shurikenPressure = Math.max(0, -shurikenVelocityAlongNormal);

    if (lancerPressure > shurikenPressure + 4) {
      return 'shuriken';
    }
    if (shurikenPressure > lancerPressure + 4) {
      return 'lancer';
    }
    return 'both';
  }

  function update(dt) {
    if (dt <= 0) {
      return;
    }

    state.simulationTime += dt;
    state.collisionCooldown = Math.max(0, state.collisionCooldown - dt);

    state.lancer.integrate(dt);
    state.shuriken.integrate(dt);

    state.lancer.alignToVelocity(dt);
    state.shuriken.angle += state.shuriken.spin * dt;
    state.shuriken.spin *= Math.pow(0.995, dt * 60);
    state.shuriken.spin = clamp(state.shuriken.spin, -24, 24);

    const lancerBounced = state.lancer.bounce(ARENA, 1.05, 220);
    const shurikenBounced = state.shuriken.bounce(ARENA, 1.06, 220);

    if (lancerBounced) {
      state.stats.wallBounces += 1;
      state.lancer.turnAssist += randRange(-0.6, 0.6);
    }
    if (shurikenBounced) {
      state.stats.wallBounces += 1;
      state.shuriken.spin += randRange(-2.5, 2.5);
    }

    const collisionResult = resolveCollision(state.collisionCooldown <= 0);
    if (collisionResult === 'lancer' && state.collisionCooldown <= 0) {
      state.lancer.hp = Math.max(0, state.lancer.hp - 1);
      state.stats.collisions += 1;
      state.collisionCooldown = 0.2;
    } else if (collisionResult === 'shuriken' && state.collisionCooldown <= 0) {
      state.shuriken.hp = Math.max(0, state.shuriken.hp - 1);
      state.stats.collisions += 1;
      state.collisionCooldown = 0.2;
    } else if (collisionResult === 'both' && state.collisionCooldown <= 0) {
      state.lancer.hp = Math.max(0, state.lancer.hp - 1);
      state.shuriken.hp = Math.max(0, state.shuriken.hp - 1);
      state.stats.collisions += 1;
      state.collisionCooldown = 0.2;
    }

    state.lancer.ensureMomentum(200);
    state.shuriken.ensureMomentum(200);
  }

  function frame(now) {
    const { dt, fps } = state.fpsMeter.sample(now);
    update(dt);
    render();
    updateUI(fps);
    requestAnimationFrame(frame);
  }

  resetGame();
  updateUI();
  requestAnimationFrame((now) => {
    state.fpsMeter.last = now;
    requestAnimationFrame(frame);
  });
})();
