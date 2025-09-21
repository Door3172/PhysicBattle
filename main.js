(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ui = {
    collisions: document.getElementById('collisions'),
    wallBounces: document.getElementById('wallBounces'),
    simTime: document.getElementById('simTime'),
    fps: document.getElementById('fps'),
    result: document.getElementById('resultMessage'),
    restart: document.getElementById('restartButton'),
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
    constructor({
      x,
      y,
      vx = 0,
      vy = 0,
      mass = 1,
      drag = 0.998,
      radius = 30,
      collisionRadius = null,
      hp = 10,
    }) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.mass = mass;
      this.drag = drag;
      this.radius = radius;
      this.collisionRadius = collisionRadius ?? radius;
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
    ensureMomentum(minSpeed = 220) {
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
    bounce(bounds, elasticity = 0.92, minRebound = 20) {
      let bounced = false;
      const r = this.collisionRadius;
      const minX = bounds.x + r;
      const maxX = bounds.x + bounds.width - r;
      const minY = bounds.y + r;
      const maxY = bounds.y + bounds.height - r;
      const speedBefore = Math.hypot(this.vx, this.vy);

      if (this.x < minX) {
        this.x = minX;
        const rebound = Math.max(Math.abs(this.vx) * elasticity, minRebound);
        this.vx = rebound;
        this.vy += randRange(-24, 24);  // 增加隨機擾動，提升趣味
        bounced = true;
      } else if (this.x > maxX) {
        this.x = maxX;
        const rebound = Math.max(Math.abs(this.vx) * elasticity, minRebound);
        this.vx = -rebound;
        this.vy += randRange(-24, 24);
        bounced = true;
      }

      if (this.y < minY) {
        this.y = minY;
        const rebound = Math.max(Math.abs(this.vy) * elasticity, minRebound);
        this.vy = rebound;
        this.vx += randRange(-24, 24);
        bounced = true;
      } else if (this.y > maxY) {
        this.y = maxY;
        const rebound = Math.max(Math.abs(this.vy) * elasticity, minRebound);
        this.vy = -rebound;
        this.vx += randRange(-24, 24);
        bounced = true;
      }

      if (bounced) {
        const maxSpeed = Math.max(speedBefore * 1.05, minRebound);  // 輕微上限，避免過快
        const speedAfter = Math.hypot(this.vx, this.vy);
        if (speedAfter > maxSpeed) {
          const scale = maxSpeed / (speedAfter || 1);
          this.vx *= scale;
          this.vy *= scale;
        }
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
        drag: 0.998,
        radius: 38,
        collisionRadius: 34,
        hp: 12,
      });
      this.bodyRadius = 38;
      this.handRadius = 12;
      this.handleLength = 26;
      this.handleWidth = 10;
      this.guardWidth = 28;
      this.guardHeight = 16;
      this.bladeLength = 54;
      this.bladeWidth = 20;
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

      const bodyRadius = this.bodyRadius;

      const bodyGradient = ctx.createRadialGradient(
        -bodyRadius * 0.35,
        -bodyRadius * 0.45,
        bodyRadius * 0.3,
        0,
        0,
        bodyRadius
      );
      bodyGradient.addColorStop(0, '#fff7dc');
      bodyGradient.addColorStop(0.55, '#f6d274');
      bodyGradient.addColorStop(1, '#f1aa56');

      ctx.beginPath();
      ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2);
      ctx.fillStyle = bodyGradient;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(36, 30, 48, 0.85)';
      ctx.stroke();

      ctx.save();
      ctx.translate(-bodyRadius * 0.36, 0);
      const crestRadius = bodyRadius * 0.32;
      const crestGradient = ctx.createLinearGradient(0, -crestRadius, 0, crestRadius);
      crestGradient.addColorStop(0, '#fdfaf4');
      crestGradient.addColorStop(1, '#d8d5ea');
      ctx.beginPath();
      ctx.arc(0, 0, crestRadius, 0, Math.PI * 2);
      ctx.fillStyle = crestGradient;
      ctx.fill();
      ctx.strokeStyle = 'rgba(47, 38, 62, 0.55)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -crestRadius * 0.75);
      ctx.lineTo(crestRadius * 0.45, 0);
      ctx.lineTo(0, crestRadius * 0.75);
      ctx.quadraticCurveTo(-crestRadius * 0.35, crestRadius * 0.15, -crestRadius * 0.32, 0);
      ctx.quadraticCurveTo(-crestRadius * 0.35, -crestRadius * 0.15, 0, -crestRadius * 0.75);
      ctx.fillStyle = 'rgba(52, 43, 71, 0.9)';
      ctx.fill();
      ctx.restore();

      const eyeWidth = bodyRadius * 0.14;
      const eyeHeight = bodyRadius * 0.36;
      ctx.beginPath();
      ctx.ellipse(bodyRadius * 0.18, 0, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(43, 35, 60, 0.85)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(251, 236, 200, 0.8)';
      ctx.stroke();

      const highlightGradient = ctx.createLinearGradient(-bodyRadius, -bodyRadius, 0, bodyRadius * 0.5);
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.beginPath();
      ctx.arc(0, 0, bodyRadius * 0.9, Math.PI * 0.7, Math.PI * 1.3);
      ctx.strokeStyle = highlightGradient;
      ctx.lineWidth = 6;
      ctx.stroke();

      const armLength = bodyRadius * 0.8;
      const armWidth = this.handRadius * 1.2;
      const armStart = bodyRadius * 0.2;
      ctx.fillStyle = 'rgba(224, 204, 255, 0.9)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(armStart, -armWidth / 2, armLength, armWidth, armWidth / 2);
      } else {
        const h = armWidth / 2;
        ctx.moveTo(armStart, -h);
        ctx.lineTo(armStart + armLength, -h);
        ctx.lineTo(armStart + armLength, h);
        ctx.lineTo(armStart, h);
        ctx.closePath();
      }
      ctx.fill();

      const handX = bodyRadius + this.handRadius * 0.75;
      ctx.beginPath();
      ctx.arc(handX, 0, this.handRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#f7e4bd';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(42, 34, 54, 0.4)';
      ctx.stroke();

      const handleStart = bodyRadius * 0.55;
      const handleGradient = ctx.createLinearGradient(handleStart, 0, handleStart + this.handleLength, 0);
      handleGradient.addColorStop(0, '#3a2f4d');
      handleGradient.addColorStop(1, '#51446a');
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(handleStart, -this.handleWidth / 2, this.handleLength, this.handleWidth, this.handleWidth / 2);
      } else {
        const h = this.handleWidth / 2;
        ctx.moveTo(handleStart, -h);
        ctx.lineTo(handleStart + this.handleLength, -h);
        ctx.lineTo(handleStart + this.handleLength, h);
        ctx.lineTo(handleStart, h);
        ctx.closePath();
      }
      ctx.fillStyle = handleGradient;
      ctx.fill();

      const guardX = handleStart + this.handleLength - this.guardHeight / 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(guardX, -this.guardWidth / 2, this.guardHeight, this.guardWidth, 6);
      } else {
        const h = this.guardWidth / 2;
        ctx.moveTo(guardX, -h);
        ctx.lineTo(guardX + this.guardHeight, -h);
        ctx.lineTo(guardX + this.guardHeight, h);
        ctx.lineTo(guardX, h);
        ctx.closePath();
      }
      const guardGradient = ctx.createLinearGradient(guardX, -this.guardWidth, guardX, this.guardWidth);
      guardGradient.addColorStop(0, '#fbe8b6');
      guardGradient.addColorStop(1, '#f1c66f');
      ctx.fillStyle = guardGradient;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(43, 35, 60, 0.55)';
      ctx.stroke();

      const guardEnd = guardX + this.guardHeight;
      const bladeTip = guardEnd + this.bladeLength;
      const bladeHalf = this.bladeWidth / 2;
      const bladeGradient = ctx.createLinearGradient(guardEnd, 0, bladeTip, 0);
      bladeGradient.addColorStop(0, '#fefefe');
      bladeGradient.addColorStop(0.5, '#d5d7e7');
      bladeGradient.addColorStop(1, '#8d95b4');
      ctx.beginPath();
      ctx.moveTo(guardEnd, -bladeHalf);
      ctx.lineTo(bladeTip, 0);
      ctx.lineTo(guardEnd, bladeHalf);
      ctx.closePath();
      ctx.fillStyle = bladeGradient;
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(26, 22, 38, 0.55)';
      ctx.stroke();

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
        drag: 0.998,
        radius: 38,
        collisionRadius: 32,
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
      const outer = 44;

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
    gameOver: false,
    winner: null,
  };

  function setResultMessage(text = '') {
    if (ui.result) {
      ui.result.textContent = text;
    }
  }

  function declareWinner(label) {
    if (state.gameOver) return;
    state.gameOver = true;
    state.winner = label;
    setResultMessage(`${label}方獲勝了！`);
  }

  function declareDraw() {
    if (state.gameOver) return;
    state.gameOver = true;
    state.winner = 'draw';
    setResultMessage('雙方同歸於盡，戰成平手！');
  }

  function resetGame() {
    state.lancer = new Lancer();
    state.shuriken = new Shuriken();
    state.stats.collisions = 0;
    state.stats.wallBounces = 0;
    state.simulationTime = 0;
    state.collisionCooldown = 0;
    state.gameOver = false;
    state.winner = null;
    setResultMessage('');
    updateUI();
  }

  if (ui.restart) {
    ui.restart.addEventListener('click', () => {
      resetGame();
    });
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
    const minDist = lancer.collisionRadius + shuriken.collisionRadius;

    if (dist === 0 || dist >= minDist) {
      return 'none';
    }

    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);

    const penetration = minDist - dist;
    if (penetration > 0) {
      const totalMass = lancer.mass + shuriken.mass;
      const correction = (penetration + 1.5) / totalMass;
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

    const restitution = 0.95;
    let impulse = (-(1 + restitution) * relativeVelocity) / (1 / lancer.mass + 1 / shuriken.mass);
    const minImpulse = 20;  // 最小衝量，確保彈開
    impulse = Math.max(Math.abs(impulse), minImpulse) * Math.sign(impulse);
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

    // 基於相對速度計算傷害（更物理）
    const impactSpeed = Math.abs(relativeVelocity);
    const baseDamage = clamp(impactSpeed / 200, 0.5, 2);  // 速度越大，傷害越高

    const lancerPressure = Math.max(0, lancerVelocityAlongNormal);
    const shurikenPressure = Math.max(0, -shurikenVelocityAlongNormal);

    if (lancerPressure > shurikenPressure + 4) {
      return { damaged: 'shuriken', damage: baseDamage };
    }
    if (shurikenPressure > lancerPressure + 4) {
      return { damaged: 'lancer', damage: baseDamage };
    }
    return { damaged: 'both', damage: baseDamage };
  }

  function update(dt) {
    if (dt <= 0) {
      return;
    }
    if (state.gameOver) {
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

    const lancerBounced = state.lancer.bounce(ARENA, 0.92, 20);
    const shurikenBounced = state.shuriken.bounce(ARENA, 0.92, 20);

    if (lancerBounced) {
      state.stats.wallBounces += 1;
      state.lancer.turnAssist += randRange(-0.6, 0.6);
    }
    if (shurikenBounced) {
      state.stats.wallBounces += 1;
      state.shuriken.spin += randRange(-2.5, 2.5);
    }

    const collisionResult = resolveCollision(state.collisionCooldown <= 0);
    if (typeof collisionResult === 'object' && state.collisionCooldown <= 0) {
      const { damaged, damage } = collisionResult;
      if (damaged === 'lancer' || damaged === 'both') {
        state.lancer.hp = Math.max(0, state.lancer.hp - damage);
      }
      if (damaged === 'shuriken' || damaged === 'both') {
        state.shuriken.hp = Math.max(0, state.shuriken.hp - damage);
      }
      state.stats.collisions += 1;
      state.collisionCooldown = 0.2;
    }

    if (state.lancer.hp <= 0 && state.shuriken.hp <= 0) {
      declareDraw();
      return;
    }
    if (state.lancer.hp <= 0) {
      declareWinner('手裡劍');
      return;
    }
    if (state.shuriken.hp <= 0) {
      declareWinner('騎槍手');
      return;
    }

    state.lancer.ensureMomentum(220);
    state.shuriken.ensureMomentum(220);
  }

  function frame(now) {
    const { dt, fps } = state.fpsMeter.sample(now);
    update(dt);
    render();
    updateUI(fps);
    requestAnimationFrame(frame);
  }

  resetGame();
  requestAnimationFrame((now) => {
    state.fpsMeter.last = now;
    requestAnimationFrame(frame);
  });
})();