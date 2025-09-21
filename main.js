// Lance vs Shuriken — pure static canvas game
// Author: ChatGPT
// Controls: R to reset, P to pause, click to nudge Lance
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const ui = {
    damage: document.getElementById('damage'),
    bounces: document.getElementById('bounces'),
    fps: document.getElementById('fps'),
    resetBtn: document.getElementById('resetBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
  };

  let state;
  let paused = false;
  let lastTime = performance.now();
  let fpsAvg = 0;

  function randIn(min, max){ return Math.random()*(max-min)+min; }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function vecLen(x, y){ return Math.hypot(x, y); }

  function reset(){
    state = {
      bounds: {x:40, y:40, w:W-80, h:H-80},
      bounces: 0,
      damage: 0,
      lance: {
        x: W*0.75, y: H*0.25,
        vx: randIn(-220, -120), vy: randIn(40, 120),
        angle: 0,
        targetTurn: 0,
        len: 70, width: 12, tip: 18
      },
      shuriken: {
        x: W*0.35, y: H*0.6,
        vx: randIn(120, 220), vy: randIn(-140, -60),
        angle: 0, spin: randIn(6, 10), // rad/s
        radius: 26, inner: 12, spikes: 4
      }
    };
  }

  function drawBounds(b){
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  function drawLance(l){
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.angle);
    // shaft
    ctx.fillStyle = '#eee';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-l.len, -l.width*0.35, l.len, l.width*0.7, 4);
    ctx.fill(); ctx.stroke();
    // tip
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(l.tip, 0);
    ctx.lineTo(-4, l.width*0.5);
    ctx.closePath();
    ctx.fillStyle = '#cbd11a';
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawShuriken(s){
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = '#333';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const spikes = s.spikes;
    for(let i=0;i<spikes*2;i++){
      const r = (i%2===0)? s.radius : s.inner;
      const a = i * Math.PI / spikes;
      const px = Math.cos(a)*r;
      const py = Math.sin(a)*r;
      if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function reflectOnBounds(obj, b){
    let bounced = false;
    if(obj.x < b.x){ obj.x = b.x; obj.vx = Math.abs(obj.vx); bounced = true; }
    if(obj.x > b.x + b.w){ obj.x = b.x + b.w; obj.vx = -Math.abs(obj.vx); bounced = true; }
    if(obj.y < b.y){ obj.y = b.y; obj.vy = Math.abs(obj.vy); bounced = true; }
    if(obj.y > b.y + b.h){ obj.y = b.y + b.h; obj.vy = -Math.abs(obj.vy); bounced = true; }
    if(bounced) state.bounces++;
  }

  function circlePointDistance(cx, cy, px, py){ return Math.hypot(px-cx, py-cy); }

  function lanceTip(l){
    // tip in world space
    return { x: l.x + Math.cos(l.angle)*l.tip, y: l.y + Math.sin(l.angle)*l.tip };
  }

  function collide(){
    const l = state.lance, s = state.shuriken;
    const tip = lanceTip(l);
    const d = circlePointDistance(s.x, s.y, tip.x, tip.y);
    if(d < s.radius*0.9){
      // impact — shuriken deflects, lance recoils; damage proportional to closing speed
      const relVx = l.vx - s.vx, relVy = l.vy - s.vy;
      const closing = vecLen(relVx, relVy);
      const dmg = clamp(Math.floor(closing*0.08), 1, 50);
      state.damage += dmg;

      // Simple elastic impulse along normal
      const nx = (tip.x - s.x)/Math.max(d, 0.0001);
      const ny = (tip.y - s.y)/Math.max(d, 0.0001);
      const impulse = 280;
      s.vx -= nx * impulse; s.vy -= ny * impulse;
      l.vx += nx * impulse*0.6; l.vy += ny * impulse*0.6;

      // Add spins / turns
      s.spin *= 1.02;
      l.targetTurn += (Math.random() > 0.5 ? 1 : -1) * 0.6;
    }
  }

  function step(dt){
    if(paused) return;
    const {lance: l, shuriken: s, bounds: b} = state;
    // integrate
    l.x += l.vx * dt; l.y += l.vy * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;

    // subtle air drag
    l.vx *= 0.999; l.vy *= 0.999;
    s.vx *= 0.999; s.vy *= 0.999;

    // rotation
    const desired = Math.atan2(l.vy, l.vx) + l.targetTurn;
    const turn = (desired - l.angle + Math.PI*3)%(Math.PI*2) - Math.PI;
    l.angle += clamp(turn, -4*dt, 4*dt);
    s.angle += s.spin * dt;

    // bounds
    reflectOnBounds(l, b);
    reflectOnBounds(s, b);

    // collide
    collide();
  }

  function render(){
    const {bounds:b, lance:l, shuriken:s, bounces, damage} = state;
    ctx.clearRect(0,0,W,H);
    // board background
    ctx.fillStyle = '#fff8e6';
    ctx.fillRect(b.x-6,b.y-6,b.w+12,b.h+12);
    drawBounds(b);
    drawLance(l);
    drawShuriken(s);

    ui.damage.textContent = damage;
    ui.bounces.textContent = bounces;
  }

  function loop(now){
    const dt = clamp((now - lastTime)/1000, 0, 0.033);
    lastTime = now;
    const fps = 1/dt;
    fpsAvg = fpsAvg*0.9 + fps*0.1;
    ui.fps.textContent = fpsAvg.toFixed(0);

    step(dt);
    render();
    requestAnimationFrame(loop);
  }

  // Interactions
  canvas.addEventListener('click', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const l = state.lance;
    // nudge lance towards click
    const dx = x - l.x, dy = y - l.y;
    const L = Math.hypot(dx, dy) || 1;
    l.vx += dx/L * 200;
    l.vy += dy/L * 200;
    l.targetTurn += 0.5;
  });

  window.addEventListener('keydown', (e)=>{
    if(e.key==='r' || e.key==='R'){ reset(); }
    if(e.key==='p' || e.key==='P'){ paused = !paused; ui.pauseBtn.textContent = paused? 'Resume (P)' : 'Pause (P)'; }
  });

  ui.resetBtn.onclick = () => reset();
  ui.pauseBtn.onclick = () => { paused = !paused; ui.pauseBtn.textContent = paused? 'Resume (P)' : 'Pause (P)'; };

  reset();
  requestAnimationFrame(loop);
})();
