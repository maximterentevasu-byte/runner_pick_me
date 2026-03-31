
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  tg.setBackgroundColor?.('#f7e4f1');
  tg.setHeaderColor?.('#f7e4f1');
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestInlineEl = document.getElementById('bestInline');
const coinsInlineEl = document.getElementById('coinsInline');
const statusEl = document.getElementById('status');
const currentScoreEl = document.getElementById('currentScore');
const bestScoreEl = document.getElementById('bestScore');
const coinsValueEl = document.getElementById('coinsValue');
const timeValueEl = document.getElementById('timeValue');
const leaderboardEl = document.getElementById('leaderboard');
const playerNameEl = document.getElementById('playerName');
const jumpBtn = document.getElementById('jumpBtn');
const restartBtn = document.getElementById('restartBtn');
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const recordBadge = document.getElementById('recordBadge');

const assets = {
  bg: [],
  run: [],
  jump: new Image(),
  puddle: new Image(),
  bucket: new Image(),
  bucketMop: new Image(),
  sign: new Image(),
  coin: new Image(),
};
for (let i = 1; i <= 4; i++) {
  const img = new Image();
  img.src = `./assets/store-bg-${i}.jpg`;
  assets.bg.push(img);
}
for (let i = 1; i <= 8; i++) {
  const img = new Image();
  img.src = `./assets/run-${i}.png`;
  assets.run.push(img);
}
assets.jump.src = './assets/jump.png';
assets.puddle.src = './assets/obstacle-puddle.png';
assets.bucket.src = './assets/obstacle-bucket.png';
assets.bucketMop.src = './assets/obstacle-bucket-mop.png';
assets.sign.src = './assets/obstacle-sign.png';
assets.coin.src = './assets/coin.png';

const WORLD = { width: 420, height: 640, floorY: 530, playerX: 64 };
canvas.width = WORLD.width;
canvas.height = WORLD.height;

const state = {
  running: false,
  gameOver: false,
  score: 0,
  coins: 0,
  bestScore: 0,
  timeMs: 0,
  speed: 6.3,
  spawnTimer: 850,
  coinTimer: 1200,
  sentScore: false,
  frame: 0,
  cameraX: 0,
  obstacles: [],
  coinsList: [],
  particles: [],
  player: {
    x: WORLD.playerX,
    y: WORLD.floorY - 124,
    w: 78,
    h: 124,
    vy: 0,
    onGround: true,
    jumpBufferMs: 0
  }
};

function getTelegramUser() {
  return tg?.initDataUnsafe?.user || null;
}
function setPlayerName() {
  const user = getTelegramUser();
  playerNameEl.textContent = user?.username ? `@${user.username}` : (user?.first_name || 'Гость');
}
function updateBest(score) {
  state.bestScore = Math.max(state.bestScore, score);
  bestInlineEl.textContent = String(state.bestScore);
  bestScoreEl.textContent = String(state.bestScore);
}
function showStartOverlay(show) { startOverlay.classList.toggle('visible', show); }
function showGameOver(show) { gameOverOverlay.classList.toggle('visible', show); }

function resetGame() {
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.coins = 0;
  state.timeMs = 0;
  state.speed = 6.3;
  state.spawnTimer = 900;
  state.coinTimer = 1100;
  state.sentScore = false;
  state.frame = 0;
  state.cameraX = 0;
  state.obstacles = [];
  state.coinsList = [];
  state.particles = [];
  state.player.y = WORLD.floorY - state.player.h;
  state.player.vy = 0;
  state.player.onGround = true;
  state.player.jumpBufferMs = 0;
  scoreEl.textContent = '0';
  coinsInlineEl.textContent = '0';
  currentScoreEl.textContent = '0';
  coinsValueEl.textContent = '0';
  timeValueEl.textContent = '0.0';
  statusEl.textContent = 'Бежит';
  recordBadge.textContent = 'Беги как можно дальше';
  showStartOverlay(false);
  showGameOver(false);
}
function startOrJump() {
  if (!state.running) { resetGame(); return; }
  state.player.jumpBufferMs = 140;
}
function spawnObstacle() {
  const typeRoll = Math.random();
  let type = 'puddle';
  if (typeRoll > 0.75) type = 'bucketMop';
  else if (typeRoll > 0.5) type = 'bucket';
  else if (typeRoll > 0.25) type = 'sign';
  else type = 'box';

  const settings = {
    box: { w: 64, h: 53, offsetY: 0 },
    puddle: { w: 74, h: 22, offsetY: 10 },
    bucket: { w: 55, h: 64, offsetY: 0 },
    bucketMop: { w: 68, h: 84, offsetY: -2 },
    sign: { w: 62, h: 72, offsetY: 0 }
  }[type];

  state.obstacles.push({
    type,
    x: WORLD.width + 24,
    y: WORLD.floorY - settings.h + settings.offsetY,
    w: settings.w,
    h: settings.h,
    passed: false
  });
}
function spawnCoin() {
  state.coinsList.push({
    x: WORLD.width + 20,
    y: WORLD.floorY - (90 + Math.random() * 150),
    w: 24,
    h: 24,
    collected: false,
    spin: Math.random() * Math.PI
  });
}

function obstacleHit(a, o) {
  let insetX = 14, insetY = 10;
  if (o.type === 'puddle') { insetX = 20; insetY = 18; }
  if (o.type === 'bucketMop') { insetX = 16; insetY = 10; }
  return a.x + insetX < o.x + o.w &&
         a.x + a.w - insetX > o.x &&
         a.y + insetY < o.y + o.h &&
         a.y + a.h - insetY > o.y;
}
function coinHit(a, c) {
  return a.x + 12 < c.x + c.w &&
         a.x + a.w - 12 > c.x &&
         a.y + 10 < c.y + c.h &&
         a.y + a.h - 10 > c.y;
}
function addCoinBurst(x, y) {
  for (let i = 0; i < 9; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 3.7,
      vy: -Math.random() * 2.8 - 0.5,
      life: 26 + Math.random() * 14,
      size: 2 + Math.random() * 3.5
    });
  }
}

function update(deltaMs) {
  if (!state.running) return;
  const t = deltaMs / 16.666;
  state.timeMs += deltaMs;
  state.frame += t;
  state.cameraX += state.speed * t * 0.38;
  state.speed += 0.0023 * t;

  state.player.jumpBufferMs = Math.max(0, state.player.jumpBufferMs - deltaMs);
  if (state.player.jumpBufferMs > 0 && state.player.onGround) {
    state.player.vy = -15.8;
    state.player.onGround = false;
    state.player.jumpBufferMs = 0;
  }

  state.player.vy += 0.88 * t;
  state.player.y += state.player.vy * t;
  if (state.player.y >= WORLD.floorY - state.player.h) {
    state.player.y = WORLD.floorY - state.player.h;
    state.player.vy = 0;
    state.player.onGround = true;
  }

  state.spawnTimer -= deltaMs;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = Math.max(680, 1120 - state.speed * 30 + Math.random() * 220);
  }

  state.coinTimer -= deltaMs;
  if (state.coinTimer <= 0) {
    spawnCoin();
    state.coinTimer = 850 + Math.random() * 850;
  }

  for (const o of state.obstacles) {
    o.x -= state.speed * t;
    if (!o.passed && o.x + o.w < state.player.x) {
      o.passed = true;
      state.score += 1;
      scoreEl.textContent = String(state.score);
    }
    if (obstacleHit(state.player, o)) {
      endGame();
      return;
    }
  }
  state.obstacles = state.obstacles.filter(o => o.x + o.w > -100);

  for (const c of state.coinsList) {
    c.x -= (state.speed + 0.5) * t;
    c.spin += 0.24;
    if (!c.collected && coinHit(state.player, c)) {
      c.collected = true;
      state.coins += 1;
      coinsInlineEl.textContent = String(state.coins);
      coinsValueEl.textContent = String(state.coins);
      addCoinBurst(c.x + c.w / 2, c.y + c.h / 2);
    }
  }
  state.coinsList = state.coinsList.filter(c => !c.collected && c.x + c.w > -50);

  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.06;
    p.life -= t;
  }
  state.particles = state.particles.filter(p => p.life > 0);
}

function drawBackground() {
  const loaded = assets.bg.filter(img => img.complete && img.naturalWidth > 0);
  if (loaded.length) {
    const segW = WORLD.width;
    const shift = state.cameraX % segW;
    const startSeg = Math.floor(state.cameraX / segW);

    for (let i = 0; i < 3; i++) {
      const img = loaded[(startSeg + i) % loaded.length];
      const dx = i * segW - shift;
      ctx.drawImage(img, dx, 0, segW, WORLD.height);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    grad.addColorStop(0, '#ffe7f2');
    grad.addColorStop(1, '#f4f8ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  const overlay = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  overlay.addColorStop(0, 'rgba(255,255,255,0.06)');
  overlay.addColorStop(1, 'rgba(255,245,251,0.12)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = 'rgba(255, 192, 221, 0.18)';
  ctx.fillRect(0, WORLD.floorY - 8, WORLD.width, 10);
}
function currentRunFrame() {
  const idx = Math.floor(state.frame / 3.3) % assets.run.length;
  return assets.run[idx];
}
function drawPlayer() {
  const p = state.player;
  const img = p.onGround ? currentRunFrame() : assets.jump;
  const bob = p.onGround && state.running ? Math.sin(state.frame * 0.66) * 1.25 : 0;

  ctx.save();
  ctx.translate(p.x, p.y + bob);

  ctx.fillStyle = 'rgba(38, 22, 44, 0.16)';
  const shadowW = p.onGround ? 24 : 18;
  ctx.beginPath();
  ctx.ellipse(34, p.h + 6, shadowW, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (img.complete && img.naturalWidth > 0) {
    const ratio = img.naturalWidth / img.naturalHeight;
    const drawH = p.onGround ? 133 : 131;
    const drawW = drawH * ratio;
    const offsetX = -12;
    const offsetY = -10;
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } else {
    ctx.fillStyle = '#ff4ea4';
    ctx.fillRect(8, 0, 44, 82);
  }
  ctx.restore();
}
function drawObstacle(o) {
  let img = assets.box;
  let dx = o.x, dy = o.y, dw = o.w, dh = o.h;

  if (o.type === 'bucket') img = assets.bucket;
  if (o.type === 'bucketMop') img = assets.bucketMop;
  if (o.type === 'sign') img = assets.sign;
  if (o.type === 'puddle') img = assets.puddle;

  if (img.complete && img.naturalWidth > 0) {
    if (o.type === 'bucket') { dx -= 10; dy -= 14; dw = 71; dh = 83; }
    else if (o.type === 'bucketMop') { dx -= 12; dy -= 28; dw = 84; dh = 103; }
    else if (o.type === 'sign') { dx -= 6; dy -= 8; dw = 71; dh = 83; }
    else if (o.type === 'puddle') { dx -= 5; dy -= 4; dw = 85; dh = 30; }
    else if (o.type === 'box') { dx -= 7; dy -= 9; dw = 76; dh = 62; }
    ctx.drawImage(img, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#8e623b';
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }
}
function drawCoin(c) {
  ctx.save();
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  const sx = Math.abs(Math.cos(c.spin)) * 0.9 + 0.1;
  ctx.scale(sx, 1);
  if (assets.coin.complete && assets.coin.naturalWidth > 0) {
    ctx.drawImage(assets.coin, -14, -14, 28, 28);
  } else {
    ctx.fillStyle = '#ffd24b';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / 40);
    ctx.fillStyle = '#ffd24b';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawMiniScore() {
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  roundRect(18, 18, 176, 62, 18);
  ctx.fill();
  ctx.fillStyle = '#68719a';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText('Pick Me Runner', 28, 40);
  ctx.fillStyle = '#ff3ca5';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText(String(state.score), 28, 64);
  ctx.fillStyle = '#ffb100';
  ctx.font = 'bold 18px Inter, sans-serif';
  ctx.fillText('● ' + state.coins, 104, 64);
}
function draw() {
  drawBackground();
  drawMiniScore();
  for (const c of state.coinsList) drawCoin(c);
  drawPlayer();
  for (const o of state.obstacles) drawObstacle(o);
  drawParticles();
}
async function endGame() {
  state.running = false;
  state.gameOver = true;
  statusEl.textContent = 'Проигрыш';
  currentScoreEl.textContent = String(state.score);
  coinsValueEl.textContent = String(state.coins);
  timeValueEl.textContent = (state.timeMs / 1000).toFixed(1);

  if (!state.sentScore) {
    state.sentScore = true;
    await saveScore();
    await loadLeaderboard();
  }
  showGameOver(true);
}
async function saveScore() {
  try {
    const initDataRaw = tg?.initData || '';
    if (initDataRaw) {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: state.score, durationMs: Math.round(state.timeMs), initDataRaw })
      });
      const payload = await response.json();
      if (payload.ok) {
        updateBest(payload.bestScore);
        recordBadge.textContent = payload.isNewRecord ? 'Новый рекорд!' : 'Результат сохранён';
      } else {
        recordBadge.textContent = 'Результат не сохранён';
      }
    } else {
      try { tg?.sendData?.(JSON.stringify({ type: 'score', score: state.score })); } catch {}
      updateBest(state.score);
    }
  } catch (error) {
    console.error('saveScore error', error);
    recordBadge.textContent = 'Ошибка сохранения';
  }
}
async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    const payload = await response.json();
    if (!payload.ok) throw new Error('Failed leaderboard');
    if (!payload.items?.length) {
      leaderboardEl.textContent = 'Пока никто не играл. Будь первым!';
      return;
    }
    leaderboardEl.innerHTML = payload.items.slice(0, 5).map((item) =>
      `<div class="lb-row"><span>${item.rank}. ${item.name}</span><b>${item.score}</b></div>`
    ).join('');
  } catch (error) {
    console.error('loadLeaderboard error', error);
    leaderboardEl.textContent = 'Не удалось загрузить топ игроков';
  }
}
function attachEvents() {
  canvas.addEventListener('pointerdown', startOrJump);
  jumpBtn.addEventListener('click', startOrJump);
  restartBtn.addEventListener('click', resetGame);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      startOrJump();
    }
  });
}
async function bootstrap() {
  setPlayerName();
  attachEvents();
  draw();
  await loadLeaderboard();
  showStartOverlay(true);
  requestAnimationFrame(loop);
}
let lastTs = 0;
function loop(ts) {
  if (!lastTs) lastTs = ts;
  const delta = Math.min(34, ts - lastTs || 16.666);
  lastTs = ts;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}
bootstrap();
