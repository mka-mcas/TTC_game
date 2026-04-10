/**
 * MCAS — Hazard Detection Simulator
 * game.js — Full Phaser 3 simulation engine
 *
 * Features:
 *  - 3-lane road with animated markings & parallax
 *  - Player car with keyboard + button lane switching
 *  - Randomly spawned obstacle vehicles (varied colours & speeds)
 *  - Physics-based TTC calculation (distance / relative speed)
 *  - LED alert system (GREEN / YELLOW / RED)
 *  - Collision detection with flash & speed penalty
 *  - Live Chart.js TTC history graph
 *  - Circular arc speedometer on canvas
 *  - Session stats: distance, hazards, collisions, score
 *  - Event log panel
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const GAME_W        = 560;
const GAME_H        = 420;
const LANE_COUNT    = 3;
const LANE_W        = 90;
const ROAD_OFFSET   = (GAME_W - LANE_COUNT * LANE_W) / 2;  // 145
const ROAD_RIGHT    = ROAD_OFFSET + LANE_COUNT * LANE_W;   // 415
const PLAYER_Y      = GAME_H - 85;
const CAR_W         = 42;
const CAR_H         = 66;

// TTC thresholds (seconds)
const TTC_SAFE      = 4.0;
const TTC_CAUTION   = 2.0;

// Speed scale: 1 km/h → pixels/second on screen
const PX_PER_KMH    = 72;

// Spawn interval range (ms)
const SPAWN_MIN     = 1400;
const SPAWN_MAX     = 3200;

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let playerSpeed     = 85;   // km/h
let playerLane      = 1;    // 0 | 1 | 2
let sessionTime     = 0;    // ms
let statDistance    = 0;    // metres
let statHazards     = 0;
let statCollisions  = 0;
let statScore       = 0;
let gameRunning     = true;

/* ═══════════════════════════════════════════════════════════
   TTC CHART (Chart.js)
═══════════════════════════════════════════════════════════ */
const TTC_HISTORY_LEN = 80;
const ttcHistory      = new Array(TTC_HISTORY_LEN).fill(null);
let ttcChart          = null;

function initChart() {
  const ctx = document.getElementById('ttcCanvas').getContext('2d');

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0,   'rgba(0,229,255,0.35)');
  grad.addColorStop(1,   'rgba(0,229,255,0.01)');

  ttcChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(TTC_HISTORY_LEN).fill(''),
      datasets: [
        {
          label: 'TTC (s)',
          data: [...ttcHistory],
          borderColor: '#00e5ff',
          backgroundColor: grad,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Caution',
          data: Array(TTC_HISTORY_LEN).fill(TTC_CAUTION),
          borderColor: 'rgba(255,214,0,0.4)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Safe',
          data: Array(TTC_HISTORY_LEN).fill(TTC_SAFE),
          borderColor: 'rgba(0,230,118,0.3)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'none' },
      scales: {
        y: {
          min: 0, max: 12,
          grid:  { color: 'rgba(42,74,110,0.5)', lineWidth: 1 },
          ticks: { color: '#3a5068', font: { family: "'Share Tech Mono'" }, stepSize: 2 },
          border: { color: '#1e3048' }
        },
        x: {
          display: false
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });
}

function pushTTCSample(ttc) {
  const val = (ttc > 0 && ttc < 99) ? Math.min(ttc, 12) : null;
  ttcHistory.push(val);
  if (ttcHistory.length > TTC_HISTORY_LEN) ttcHistory.shift();
  if (ttcChart) {
    ttcChart.data.datasets[0].data = [...ttcHistory];
    ttcChart.update('none');
  }
}

/* ═══════════════════════════════════════════════════════════
   SPEEDOMETER (arc canvas)
═══════════════════════════════════════════════════════════ */
function drawSpeedometer(speed) {
  const canvas = document.getElementById('speedCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2 + 10;
  const R = 72;
  ctx.clearRect(0, 0, W, H);

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI * 0.75, Math.PI * 2.25);
  ctx.strokeStyle = '#1e3048';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Coloured fill arc
  const pct   = Math.min(speed / 120, 1);
  const start = Math.PI * 0.75;
  const end   = start + pct * Math.PI * 1.5;
  const color = speed < 60 ? '#00e676' : speed < 90 ? '#f5a623' : '#ff1744';

  ctx.beginPath();
  ctx.arc(cx, cy, R, start, end);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Tick marks
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * 0.75 + (i / 12) * Math.PI * 1.5;
    const isMajor = i % 3 === 0;
    const r1 = R - (isMajor ? 14 : 9);
    const r2 = R - 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.strokeStyle = isMajor ? '#3a5068' : '#1e3048';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.stroke();

    if (isMajor) {
      const label = Math.round(i / 12 * 120);
      const lr = R - 26;
      ctx.fillStyle = '#3a5068';
      ctx.font = "9px 'Share Tech Mono'";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx + Math.cos(a) * lr, cy + Math.sin(a) * lr);
    }
  }

  // Needle
  const needleA = Math.PI * 0.75 + pct * Math.PI * 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleA) * (R - 12), cy + Math.sin(needleA) * (R - 12));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Centre dot
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#f5a623';
  ctx.shadowColor = '#f5a623';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
}

/* ═══════════════════════════════════════════════════════════
   LED + TTC BAR UPDATE
═══════════════════════════════════════════════════════════ */
function updateAlertUI(ttc) {
  const g = document.getElementById('led-green');
  const y = document.getElementById('led-yellow');
  const r = document.getElementById('led-red');
  const bar = document.getElementById('ttc-bar');
  const banner = document.getElementById('alert-banner');

  g.classList.add('inactive');
  y.classList.add('inactive');
  r.classList.add('inactive');
  bar.className = 'ttc-bar';

  if (ttc <= 0 || ttc >= 99) {
    // No threat
    g.classList.remove('inactive');
    bar.classList.add('safe');
    bar.style.width = '100%';
    banner.classList.add('hidden');
  } else if (ttc > TTC_SAFE) {
    g.classList.remove('inactive');
    bar.classList.add('safe');
    bar.style.width = Math.min(100, (ttc / 10) * 100) + '%';
    banner.classList.add('hidden');
  } else if (ttc > TTC_CAUTION) {
    y.classList.remove('inactive');
    bar.classList.add('caution');
    bar.style.width = (ttc / TTC_SAFE) * 100 + '%';
    banner.classList.add('hidden');
  } else {
    r.classList.remove('inactive');
    bar.classList.add('danger');
    bar.style.width = Math.max(5, (ttc / TTC_CAUTION) * 60) + '%';
    banner.classList.remove('hidden');
  }
}

/* ═══════════════════════════════════════════════════════════
   EVENT LOG
═══════════════════════════════════════════════════════════ */
const MAX_LOG_ENTRIES = 30;

function logEvent(msg, type = 'info') {
  const log = document.getElementById('event-log');
  if (!log) return;

  const t = new Date();
  const ts = `${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;

  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="log-time">${ts}</span><span class="log-msg">${msg}</span>`;
  log.prepend(entry);

  // Trim old entries
  while (log.children.length > MAX_LOG_ENTRIES) {
    log.removeChild(log.lastChild);
  }
}

/* ═══════════════════════════════════════════════════════════
   STAT DISPLAY
═══════════════════════════════════════════════════════════ */
function updateStats() {
  document.getElementById('stat-distance').textContent  = Math.round(statDistance) + ' m';
  document.getElementById('stat-hazards').textContent   = statHazards;
  document.getElementById('stat-collisions').textContent = statCollisions;
  document.getElementById('stat-score').textContent     = statScore;
}

function updateLanePips(lane) {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById(`lane-${i}`);
    if (el) el.classList.toggle('active', i === lane);
  }
}

/* ═══════════════════════════════════════════════════════════
   PHASER SCENE
═══════════════════════════════════════════════════════════ */
class RoadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RoadScene' });
    this.obstacles   = [];
    this.roadOffset  = 0;
    this.spawnTimer  = 0;
    this.nextSpawn   = 2000;
    this.ttcSampleTimer = 0;
    this.laneChangeCooldown = 0;
  }

  /* ── Preload ───────────────────────────────────────────── */
  preload() {
    // All graphics drawn procedurally — nothing to preload
  }

  /* ── Create ────────────────────────────────────────────── */
  create() {
    // Layers (bottom → top)
    this.bgLayer       = this.add.graphics();
    this.roadLayer     = this.add.graphics();
    this.obstacleLayer = this.add.group();
    this.fxLayer       = this.add.graphics();
    this.playerGfx     = this.add.graphics();

    this._drawPlayer();
    this._repositionPlayer();

    // Keyboard
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA    = this.input.keyboard.addKey('A');
    this.keyD    = this.input.keyboard.addKey('D');

    // Wire UI controls
    this._bindControls();

    logEvent('System initialised', 'ok');
    logEvent(`Speed: ${playerSpeed} km/h`, 'info');
    drawSpeedometer(playerSpeed);

    // Start spawn timer
    this.time.addEvent({
      delay: this.nextSpawn,
      callback: this._spawnObstacle,
      callbackScope: this,
      loop: false
    });
  }

  /* ── Update loop ───────────────────────────────────────── */
  update(time, delta) {
    if (!gameRunning) return;

    const dt = delta / 1000; // seconds

    // ── Speed updates via keyboard ─────────────────────────
    if (this.cursors.up.isDown)   this._setSpeed(Math.min(120, playerSpeed + 30 * dt));
    if (this.cursors.down.isDown) this._setSpeed(Math.max(0,   playerSpeed - 40 * dt));

    // ── Lane switching (debounced) ─────────────────────────
    if (this.laneChangeCooldown > 0) this.laneChangeCooldown -= delta;

    if (this.laneChangeCooldown <= 0) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.left) ||
          Phaser.Input.Keyboard.JustDown(this.keyA)) {
        this._changeLane(-1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.cursors.right) ||
          Phaser.Input.Keyboard.JustDown(this.keyD)) {
        this._changeLane(1);
      }
    }

    // ── Road scroll ────────────────────────────────────────
    this.roadOffset = (this.roadOffset + playerSpeed * PX_PER_KMH * dt) % 80;
    this._drawBackground();
    this._drawRoad();

    // ── Move obstacles ─────────────────────────────────────
    const playerPxSpeed = playerSpeed * PX_PER_KMH;

    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      const obsPxSpeed  = obs.speedKmh * PX_PER_KMH;
      const relPxSpeed  = playerPxSpeed - obsPxSpeed;
      obs.container.y  += relPxSpeed * dt;

      if (obs.container.y > GAME_H + 100) {
        obs.container.destroy();
        obs.active = false;
        statScore += 10;
      }
    }

    // Clean dead obstacles
    this.obstacles = this.obstacles.filter(o => o.active);

    // ── TTC calculation ────────────────────────────────────
    const ttc = this._calcTTC();
    document.getElementById('ttc-value').textContent = ttc < 99 ? ttc.toFixed(1) : '—';
    updateAlertUI(ttc);

    // ── Collision check ────────────────────────────────────
    this._checkCollisions();

    // ── TTC chart sample (every 200ms) ─────────────────────
    this.ttcSampleTimer += delta;
    if (this.ttcSampleTimer >= 200) {
      this.ttcSampleTimer = 0;
      pushTTCSample(ttc < 99 ? ttc : 0);
    }

    // ── Session stats ──────────────────────────────────────
    sessionTime  += delta;
    statDistance += playerSpeed / 3.6 * dt;
    updateStats();
    drawSpeedometer(playerSpeed);

    // ── Re-draw player on top ──────────────────────────────
    this.playerGfx.clear();
    this._drawPlayer();
  }

  /* ══════════════════════════════════════════════════════
     PRIVATE HELPERS
  ══════════════════════════════════════════════════════ */

  /** Calculate TTC for nearest in-lane threat */
  _calcTTC() {
    let minTTC = 99;
    const playerPxPerSec = playerSpeed / 3.6;

    for (const obs of this.obstacles) {
      if (!obs.active || obs.lane !== playerLane) continue;

      const dy = obs.container.y - PLAYER_Y;
      if (dy < 0) continue;  // already behind

      const obsPxPerSec  = obs.speedKmh / 3.6;
      const relMPerSec   = playerPxPerSec - obsPxPerSec;
      if (relMPerSec <= 0) continue;  // not closing

      // 1 pixel ≈ 0.25 metres (calibrated)
      const distM = Math.max(0, (dy - CAR_H * 0.5)) * 0.25;
      const ttc   = distM / relMPerSec;

      if (ttc < minTTC) {
        minTTC = ttc;
        // Update hazard count when first detected
        if (ttc < TTC_SAFE && !obs.detected) {
          obs.detected = true;
          statHazards++;
          logEvent(`Hazard detected — TTC ${ttc.toFixed(1)}s`, ttc < TTC_CAUTION ? 'danger' : 'warn');
        }
      }
    }
    return minTTC;
  }

  /** Collision check — overlap in same lane */
  _checkCollisions() {
    for (const obs of this.obstacles) {
      if (!obs.active || obs.lane !== playerLane) continue;

      const dy = Math.abs(obs.container.y - PLAYER_Y);
      if (dy < CAR_H * 0.65) {
        this._handleCollision(obs);
      }
    }
  }

  _handleCollision(obs) {
    if (obs.colliding) return;  // one-shot
    obs.colliding = true;
    obs.active    = false;
    obs.container.destroy();

    statCollisions++;
    statScore = Math.max(0, statScore - 50);

    // Flash DOM overlay
    const flash = document.getElementById('collision-flash');
    flash.classList.add('flash');
    setTimeout(() => flash.classList.remove('flash'), 600);

    // Speed penalty
    this._setSpeed(Math.max(0, playerSpeed * 0.45));

    logEvent('⚠ COLLISION — speed reduced', 'danger');
    updateStats();
  }

  /** Spawn a new obstacle car */
  _spawnObstacle() {
    if (!gameRunning) return;

    const lane     = Phaser.Math.Between(0, LANE_COUNT - 1);
    const speedKmh = Phaser.Math.FloatBetween(20, playerSpeed * 0.75);
    const colours  = [0xe53935, 0xfb8c00, 0x43a047, 0x1e88e5, 0x8e24aa, 0xfdd835];
    const color    = Phaser.Math.RND.pick(colours);

    const container = this.add.container(this._laneX(lane), -CAR_H);
    const gfx       = this.add.graphics();
    this._drawCar(gfx, color, true);
    container.add(gfx);

    this.obstacles.push({ container, lane, speedKmh, active: true, detected: false, colliding: false });

    // Schedule next spawn
    const nextDelay = Phaser.Math.Between(SPAWN_MIN, SPAWN_MAX);
    this.time.addEvent({
      delay: nextDelay,
      callback: this._spawnObstacle,
      callbackScope: this,
      loop: false
    });
  }

  /** Draw obstacle or player car onto a Graphics object */
  _drawCar(g, bodyColor, isObstacle) {
    const W = CAR_W, H = CAR_H;
    const halfW = W / 2, halfH = H / 2;

    // Body shadow
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-halfW + 3, -halfH + 3, W, H, 8);

    // Main body
    g.fillStyle(bodyColor, 1);
    g.fillRoundedRect(-halfW, -halfH, W, H, 8);

    // Roof / cabin
    g.fillStyle(bodyColor, 0.6);
    g.fillRoundedRect(-halfW + 6, -halfH + 12, W - 12, H * 0.45, 5);

    // Front windscreen
    g.fillStyle(0x0d1117, 0.9);
    g.fillRoundedRect(-halfW + 7, isObstacle ? (halfH - 20) : (-halfH + 8), W - 14, 18, 4);

    // Rear windscreen
    g.fillStyle(0x0d1117, 0.7);
    g.fillRoundedRect(-halfW + 7, isObstacle ? (-halfH + 6) : (halfH - 20), W - 14, 14, 4);

    // Wheels
    g.fillStyle(0x111111, 1);
    [[-halfW - 3, -halfH + 10], [halfW - 5, -halfH + 10],
     [-halfW - 3, halfH - 18],  [halfW - 5, halfH - 18]].forEach(([wx, wy]) => {
      g.fillRoundedRect(wx, wy, 8, 16, 3);
    });

    // Lights
    if (isObstacle) {
      // Brake lights (rear = bottom)
      g.fillStyle(0xff1744, 1);
      g.fillRect(-halfW + 5, halfH - 8, 12, 5);
      g.fillRect(halfW - 17, halfH - 8, 12, 5);
    } else {
      // Headlights (front = top)
      g.fillStyle(0xfffde7, 1);
      g.fillRect(-halfW + 5, -halfH + 4, 14, 5);
      g.fillRect(halfW - 19, -halfH + 4, 14, 5);
      // Light beams
      g.fillStyle(0xfffde7, 0.08);
      g.fillTriangle(
        -halfW + 5, -halfH + 9,
        -halfW - 30, 40,
        -halfW + 19, 40
      );
      g.fillTriangle(
        halfW - 5, -halfH + 9,
        halfW + 30, 40,
        halfW - 19, 40
      );
    }
  }

  _drawPlayer() {
    this._drawCar(this.playerGfx, 0x1565c0, false);
    this.playerGfx.x = this._laneX(playerLane);
    this.playerGfx.y = PLAYER_Y;
  }

  _repositionPlayer() {
    this.playerGfx.x = this._laneX(playerLane);
    this.playerGfx.y = PLAYER_Y;
  }

  _laneX(lane) {
    return ROAD_OFFSET + lane * LANE_W + LANE_W / 2;
  }

  /** Draw distant sky / background (once per frame) */
  _drawBackground() {
    const g = this.bgLayer;
    g.clear();

    // Sky gradient via fillGradientStyle
    g.fillGradientStyle(0x0a0e14, 0x0a0e14, 0x0d1520, 0x0d1520, 1);
    g.fillRect(0, 0, GAME_W, GAME_H * 0.38);

    // Ground
    g.fillStyle(0x090c10, 1);
    g.fillRect(0, GAME_H * 0.38, GAME_W, GAME_H * 0.62);

    // Far roadside strips
    g.fillStyle(0x0d1520, 1);
    g.fillRect(0, 0, ROAD_OFFSET, GAME_H);
    g.fillRect(ROAD_RIGHT, 0, GAME_W - ROAD_RIGHT, GAME_H);

    // Side grass/dirt texture lines
    for (let y = 0; y < GAME_H; y += 24) {
      const yy = (y + this.roadOffset * 0.3) % GAME_H;
      g.fillStyle(0x0f1a10, 0.4);
      g.fillRect(4, yy, ROAD_OFFSET - 8, 2);
      g.fillRect(ROAD_RIGHT + 4, yy, GAME_W - ROAD_RIGHT - 8, 2);
    }

    // Horizon glow
    g.fillGradientStyle(0x0a1a2a, 0x0a1a2a, 0x080c10, 0x080c10, 1);
    g.fillRect(0, 0, GAME_W, GAME_H * 0.15);
  }

  /** Draw road surface, edges, lane markings */
  _drawRoad() {
    const g = this.roadLayer;
    g.clear();

    // Road surface
    g.fillStyle(0x1a1e26, 1);
    g.fillRect(ROAD_OFFSET, 0, LANE_COUNT * LANE_W, GAME_H);

    // Road edge kerbs
    g.fillStyle(0xeeeeee, 1);
    g.fillRect(ROAD_OFFSET - 5, 0, 5, GAME_H);
    g.fillRect(ROAD_RIGHT, 0, 5, GAME_H);

    // Kerb alternate colours
    for (let y = (this.roadOffset * 0.5) % 40 - 40; y < GAME_H + 40; y += 40) {
      g.fillStyle(0xff1744, 0.55);
      g.fillRect(ROAD_OFFSET - 5, y, 5, 20);
      g.fillRect(ROAD_RIGHT, y, 5, 20);
    }

    // Dashed centre lines (animated)
    for (let lane = 1; lane < LANE_COUNT; lane++) {
      const x = ROAD_OFFSET + lane * LANE_W;
      for (let y = (this.roadOffset % 80) - 80; y < GAME_H + 80; y += 80) {
        g.fillStyle(0xffffff, 0.18);
        g.fillRect(x - 2, y, 4, 44);
      }
    }

    // Road centre texture (subtle)
    for (let i = 0; i < 3; i++) {
      const x = ROAD_OFFSET + (i + 0.5) * LANE_W;
      for (let y = (this.roadOffset * 1.2) % 120 - 120; y < GAME_H + 120; y += 120) {
        g.fillStyle(0x252a34, 0.4);
        g.fillRect(x - 1, y, 2, 60);
      }
    }
  }

  /* ── UI bindings ─────────────────────────────────────── */
  _bindControls() {
    const slider = document.getElementById('speed-slider');
    slider.addEventListener('input', (e) => {
      this._setSpeed(parseInt(e.target.value));
    });

    document.getElementById('brake').addEventListener('click', () => {
      this._setSpeed(Math.max(0, playerSpeed - 15));
    });
    document.getElementById('accelerate').addEventListener('click', () => {
      this._setSpeed(Math.min(120, playerSpeed + 15));
    });
    document.getElementById('btn-left').addEventListener('click', () => {
      this._changeLane(-1);
    });
    document.getElementById('btn-right').addEventListener('click', () => {
      this._changeLane(1);
    });
  }

  _setSpeed(v) {
    const prev  = Math.round(playerSpeed);
    playerSpeed = Math.round(Math.max(0, Math.min(120, v)));
    document.getElementById('speed-value').textContent  = playerSpeed;
    document.getElementById('speed-slider').value       = playerSpeed;
    drawSpeedometer(playerSpeed);
    if (Math.abs(playerSpeed - prev) >= 5) {
      logEvent(`Speed → ${playerSpeed} km/h`, 'info');
    }
  }

  _changeLane(dir) {
    const next = playerLane + dir;
    if (next < 0 || next >= LANE_COUNT) return;
    playerLane = next;
    this.playerGfx.x = this._laneX(playerLane);
    updateLanePips(playerLane);
    this.laneChangeCooldown = 320;
    logEvent(`Lane change → ${['LEFT','CENTRE','RIGHT'][playerLane]}`, 'info');
  }
}

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP
═══════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // Init chart first
  initChart();

  // Draw initial speedometer
  drawSpeedometer(playerSpeed);

  // Boot Phaser
  const config = {
    type:            Phaser.AUTO,
    width:           GAME_W,
    height:          GAME_H,
    parent:          'game-container',
    backgroundColor: '#080c10',
    scene:           [RoadScene],
    input: {
      keyboard: { capture: [37, 38, 39, 40] }
    }
  };

  const game = new Phaser.Game(config);
  logEvent('Phaser engine started', 'ok');

  // Prevent arrow-key page scroll
  window.addEventListener('keydown', (e) => {
    if ([37, 38, 39, 40].includes(e.keyCode)) e.preventDefault();
  });
});
