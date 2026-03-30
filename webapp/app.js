
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
const statusEl = document.getElementById('status');
const currentScoreEl = document.getElementById('currentScore');
const bestScoreEl = document.getElementById('bestScore');
const placeValueEl = document.getElementById('placeValue');
const timeValueEl = document.getElementById('timeValue');
const leaderboardEl = document.getElementById('leaderboard');
const playerNameEl = document.getElementById('playerName');
const jumpBtn = document.getElementById('jumpBtn');
const restartBtn = document.getElementById('restartBtn');
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const recordBadge = document.getElementById('recordBadge');

const assets = {
  run1: new Image(),
  run2: new Image(),
  jump: new Image(),
};
assets.run1.src = './assets/mascot-run-1.png';
assets.run2.src = './assets/mascot-run-2.png';
assets.jump.src = './assets/mascot-jump.png';

const WORLD = {
  width: 420,
  height: 640,
  groundTop: 520,
  playerX: 74,
};

canvas.width = WORLD.width;
canvas.height = WORLD.height;

const state = {
  running: false,
  gameOver: false,
  score: 0,
  bestScore: 0,
  place: '-',
  timeMs: 0,
  speed: 6.1,
  spawnTimer: 850,
  sentScore: false,
  frame: 0,
  obstacles: [],
  clouds: Array.from({ length: 4 }, (_, i) => ({
    x: 50 + i * 110,
    y: 72 + (i % 2) * 34,
    size: 36 + i * 6
  })),
  stars: Array.from({ length: 18 }, (_, i) => ({
    x: 20 + (i * 23) % 400,
    y: 28 + (i * 37) % 220,
    size: 1 + (i % 3),
    phase: i * 0.5
  })),
  player: {
    x: WORLD.playerX,
    y: WORLD.groundTop - 92,
    w: 54,
    h: 92,
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

function showStartOverlay(show) {
  startOverlay.classList.toggle('visible', show);
}

function showGameOver(show) {
  gameOverOverlay.classList.toggle('visible', show);
}

function resetGame() {
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.speed = 6.1;
  state.timeMs = 0;
  state.spawnTimer = 900;
  state.sentScore = false;
  state.place = '-';
  state.obstacles = [];
  state.player.y = WORLD.groundTop - state.player.h;
  state.player.vy = 0;
  state.player.onGround = true;
  state.player.jumpBufferMs = 0;
  scoreEl.textContent = '0';
  currentScoreEl.textContent = '0';
  placeValueEl.textContent = '-';
  timeValueEl.textContent = '0.0';
  statusEl.textContent = 'Бежит';
  recordBadge.textContent = 'Беги как можно дальше';
  showStartOverlay(false);
  showGameOver(false);
}

function startOrJump() {
  if (!state.running) {
    resetGame();
    return;
  }
  state.player.jumpBufferMs = 140;
}

function spawnObstacle() {
  const tall = Math.random() > 0.55;
  state.obstacles.push({
    x: WORLD.width + 20,
    y: WORLD.groundTop - (tall ? 78 : 56),
    w: tall ? 28 : 30,
    h: tall ? 78 : 56,
    passed: false
  });
}

function isColliding(a, b) {
  const insetX = 12;
  const insetY = 8;
  return (
    a.x + insetX < b.x + b.w &&
    a.x + a.w - insetX > b.x &&
    a.y + insetY < b.y + b.h &&
    a.y + a.h - insetY > b.y
  );
}

function update(deltaMs) {
  if (!state.running) return;

  state.timeMs += deltaMs;
  state.frame += deltaMs / 16.666;
  state.speed += 0.0024 * (deltaMs / 16.666);

  state.player.jumpBufferMs = Math.max(0, state.player.jumpBufferMs - deltaMs);

  if (state.player.jumpBufferMs > 0 && state.player.onGround) {
    state.player.vy = -15.4;
    state.player.onGround = false;
    state.player.jumpBufferMs = 0;
  }

  state.player.vy += 0.86 * (deltaMs / 16.666);
  state.player.y += state.player.vy * (deltaMs / 16.666);

  if (state.player.y >= WORLD.groundTop - state.player.h) {
    state.player.y = WORLD.groundTop - state.player.h;
    state.player.vy = 0;
    state.player.onGround = true;
  }

  state.spawnTimer -= deltaMs;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = Math.max(640, 1100 - state.speed * 34 + Math.random() * 160);
  }

  for (const obstacle of state.obstacles) {
    obstacle.x -= state.speed * (deltaMs / 16.666);

    if (!obstacle.passed && obstacle.x + obstacle.w < state.player.x) {
      obstacle.passed = true;
      state.score += 1;
      scoreEl.textContent = String(state.score);
    }

    if (isColliding(state.player, obstacle)) {
      endGame();
      return;
    }
  }

  state.obstacles = state.obstacles.filter((o) => o.x + o.w > -40);

  for (const cloud of state.clouds) {
    cloud.x -= 0.3 + state.speed * 0.04;
    if (cloud.x < -80) cloud.x = WORLD.width + 40;
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  sky.addColorStop(0, '#dff4ff');
  sky.addColorStop(0.55, '#f9eef7');
  sky.addColorStop(1, '#ffe4f0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (const star of state.stars) {
    const pulse = 0.55 + Math.sin(state.frame * 0.06 + star.phase) * 0.35;
    ctx.globalAlpha = 0.28 + pulse * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (const cloud of state.clouds) {
    drawCloud(cloud.x, cloud.y, cloud.size);
  }

  drawHills();
  drawGround();
}

function drawCloud(x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
  ctx.arc(x + size * 0.22, y - size * 0.1, size * 0.28, 0, Math.PI * 2);
  ctx.arc(x + size * 0.47, y, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills() {
  ctx.fillStyle = '#cbe9d4';
  ctx.beginPath();
  ctx.moveTo(0, WORLD.groundTop + 8);
  ctx.quadraticCurveTo(40, 476, 88, WORLD.groundTop + 8);
  ctx.quadraticCurveTo(136, 486, 184, WORLD.groundTop + 6);
  ctx.quadraticCurveTo(230, 470, 288, WORLD.groundTop + 10);
  ctx.quadraticCurveTo(334, 490, 420, WORLD.groundTop + 6);
  ctx.lineTo(420, WORLD.height);
  ctx.lineTo(0, WORLD.height);
  ctx.closePath();
  ctx.fill();
}

function drawGround() {
  ctx.fillStyle = '#ffd4e9';
  ctx.fillRect(0, WORLD.groundTop - 10, WORLD.width, 10);

  ctx.fillStyle = '#4f6f52';
  ctx.fillRect(0, WORLD.groundTop, WORLD.width, WORLD.height - WORLD.groundTop);

  ctx.fillStyle = '#7fb280';
  for (let x = 0; x < WORLD.width; x += 16) {
    const h = 8 + (x % 3) * 2;
    ctx.fillRect(x + 2, WORLD.groundTop - h, 3, h);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let x = 0; x < WORLD.width; x += 28) {
    ctx.fillRect(x, WORLD.groundTop + 12, 16, 4);
  }
}

function currentPlayerImage() {
  if (!state.player.onGround) return assets.jump;
  return Math.floor(state.frame / 8) % 2 === 0 ? assets.run1 : assets.run2;
}

function drawPlayer() {
  const p = state.player;
  const img = currentPlayerImage();
  const bob = p.onGround && state.running ? Math.sin(state.frame * 0.55) * 1.6 : 0;

  ctx.save();
  ctx.translate(p.x, p.y + bob);

  const imgRatio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0.48;
  const drawH = 118;
  const drawW = drawH * imgRatio;

  // character smaller and standing on surface
  const offsetX = -4;
  const offsetY = -22;

  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } else {
    ctx.fillStyle = '#ff4ea4';
    ctx.fillRect(8, 0, 42, 78);
  }

  // soft shadow on top of ground surface
  ctx.fillStyle = 'rgba(49, 34, 60, 0.14)';
  ctx.beginPath();
  ctx.ellipse(28, p.h + 4, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawObstacle(obstacle) {
  const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.h);
  gradient.addColorStop(0, '#536273');
  gradient.addColorStop(1, '#222936');
  ctx.fillStyle = gradient;
  roundRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, 8);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(obstacle.x + 4, obstacle.y + 6, obstacle.w - 8, 8, 4);
  ctx.fill();
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
  ctx.fillStyle = 'rgba(255,255,255,0.74)';
  roundRect(18, 18, 126, 60, 18);
  ctx.fill();

  ctx.fillStyle = '#68719a';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText('Pick Me Runner', 28, 40);

  ctx.fillStyle = '#ff3ca5';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText(String(state.score), 28, 64);
}

function draw() {
  drawBackground();
  drawMiniScore();
  drawPlayer();
  for (const obstacle of state.obstacles) drawObstacle(obstacle);
}

async function endGame() {
  state.running = false;
  state.gameOver = true;
  statusEl.textContent = 'Проигрыш';
  currentScoreEl.textContent = String(state.score);
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
    let payload = null;

    if (initDataRaw) {
      const response = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: state.score,
          durationMs: Math.round(state.timeMs),
          initDataRaw
        })
      });
      payload = await response.json();

      if (payload.ok) {
        updateBest(payload.bestScore);
        state.place = payload.place || '-';
        placeValueEl.textContent = String(state.place);
        recordBadge.textContent = payload.isNewRecord ? 'Новый рекорд!' : 'Результат сохранён';
      } else {
        recordBadge.textContent = 'Результат не сохранён';
      }
    } else {
      try {
        tg?.sendData?.(JSON.stringify({ type: 'score', score: state.score }));
      } catch {}
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

    leaderboardEl.innerHTML = payload.items.slice(0, 5).map((item) => `
      <div class="lb-row">
        <span>${item.rank}. ${item.name}</span>
        <b>${item.score}</b>
      </div>
    `).join('');
  } catch (error) {
    console.error('loadLeaderboard error', error);
    leaderboardEl.textContent = 'Не удалось загрузить топ игроков';
  }
}

function attachEvents() {
  canvas.addEventListener('pointerdown', startOrJump);
  jumpBtn.addEventListener('click', startOrJump);
  restartBtn.addEventListener('click', () => {
    resetGame();
  });
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
