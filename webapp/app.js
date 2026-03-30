const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
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

const WORLD = { width: 420, height: 640, groundY: 520, playerX: 86 };
canvas.width = WORLD.width;
canvas.height = WORLD.height;

const state = {
  running: false,
  gameOver: false,
  score: 0,
  bestScore: 0,
  speed: 6.3,
  distance: 0,
  timeMs: 0,
  spawnTimer: 0,
  sentScore: false,
  place: '-',
  frame: 0,
  obstacles: [],
  stars: Array.from({ length: 7 }, (_, i) => ({
    x: 30 + i * 55,
    y: 70 + (i % 3) * 30,
    size: 1 + (i % 2)
  })),
  clouds: Array.from({ length: 4 }, (_, i) => ({
    x: 70 + i * 110,
    y: 80 + (i % 2) * 40,
    size: 50 + i * 8
  })),
  player: {
    x: WORLD.playerX,
    y: WORLD.groundY - 84,
    w: 54,
    h: 84,
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
  state.speed = 6.3;
  state.distance = 0;
  state.timeMs = 0;
  state.spawnTimer = 55;
  state.sentScore = false;
  state.place = '-';
  state.obstacles = [];
  state.player.y = WORLD.groundY - state.player.h;
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
  const type = Math.random() > 0.7 ? 'double' : (tall ? 'tall' : 'short');

  if (type === 'double') {
    const width = 26;
    const gap = 20;
    state.obstacles.push(
      { x: WORLD.width + width, y: WORLD.groundY - 52, w: width, h: 52, type: 'short', passed: false },
      { x: WORLD.width + width + gap + width, y: WORLD.groundY - 68, w: width, h: 68, type: 'tall', passed: false }
    );
    return;
  }

  const h = type === 'tall' ? 92 + Math.floor(Math.random() * 18) : 54 + Math.floor(Math.random() * 12);
  const w = type === 'tall' ? 30 : 36;
  state.obstacles.push({
    x: WORLD.width + w,
    y: WORLD.groundY - h,
    w,
    h,
    type,
    passed: false
  });
}

function update(deltaMs) {
  if (!state.running) return;

  state.timeMs += deltaMs;
  state.distance += state.speed * (deltaMs / 16.666);
  state.speed += 0.0025 * (deltaMs / 16.666);
  state.player.jumpBufferMs = Math.max(0, state.player.jumpBufferMs - deltaMs);

  if (state.player.jumpBufferMs > 0 && state.player.onGround) {
    state.player.vy = -15.8;
    state.player.onGround = false;
    state.player.jumpBufferMs = 0;
  }

  state.player.vy += 0.88 * (deltaMs / 16.666);
  state.player.y += state.player.vy * (deltaMs / 16.666);

  if (state.player.y >= WORLD.groundY - state.player.h) {
    state.player.y = WORLD.groundY - state.player.h;
    state.player.vy = 0;
    state.player.onGround = true;
  }

  state.spawnTimer -= deltaMs;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    const delay = Math.max(640, 1180 - state.speed * 38 + Math.random() * 210);
    state.spawnTimer = delay;
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

  state.obstacles = state.obstacles.filter((item) => item.x + item.w > -20);
}

function isColliding(a, b) {
  const inset = 8;
  return (
    a.x + inset < b.x + b.w &&
    a.x + a.w - inset > b.x &&
    a.y + inset < b.y + b.h &&
    a.y + a.h - inset > b.y
  );
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
      updateBest(state.score);
      recordBadge.textContent = 'Локальный запуск без Telegram';
    }

    if (tg?.sendData) {
      tg.sendData(JSON.stringify({ type: 'score', score: state.score }));
    }
  } catch (error) {
    console.error('saveScore error', error);
    recordBadge.textContent = 'Ошибка сохранения';
  }
}

async function loadLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    const data = await response.json();
    leaderboardEl.innerHTML = '';

    for (const row of data.items || []) {
      const li = document.createElement('li');
      li.textContent = `${row.rank}. ${row.name} — ${row.score}`;
      leaderboardEl.appendChild(li);
    }
  } catch (error) {
    console.error('loadLeaderboard error', error);
  }
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  g.addColorStop(0, '#d8ebf6');
  g.addColorStop(0.65, '#eef5f4');
  g.addColorStop(1, '#faf7ef');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (const cloud of state.clouds) {
    const x = ((cloud.x - state.distance * 0.18) % (WORLD.width + 120)) - 80;
    drawCloud(x, cloud.y, cloud.size);
  }
}

function drawCloud(x, y, size) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.18, 0, Math.PI * 2);
  ctx.arc(x + size * 0.18, y - 10, size * 0.24, 0, Math.PI * 2);
  ctx.arc(x + size * 0.42, y, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills() {
  const shift = (state.distance * 0.08) % 220;
  ctx.fillStyle = '#bfd7c7';
  for (let i = -1; i < 4; i++) {
    const x = i * 220 - shift;
    ctx.beginPath();
    ctx.moveTo(x, WORLD.groundY);
    ctx.quadraticCurveTo(x + 70, WORLD.groundY - 75, x + 140, WORLD.groundY);
    ctx.quadraticCurveTo(x + 180, WORLD.groundY - 30, x + 220, WORLD.groundY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGround() {
  ctx.fillStyle = '#4b6a50';
  ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);

  ctx.fillStyle = '#395540';
  for (let i = 0; i < WORLD.width / 26 + 3; i++) {
    const x = -((state.distance * 0.9) % 26) + i * 26;
    ctx.fillRect(x, WORLD.groundY + 3, 13, 5);
  }
}

function drawPlayer() {
  const p = state.player;
  const bob = state.player.onGround && state.running ? Math.sin(state.frame * 0.45) * 1.8 : 0;
  const legSwing = state.running ? Math.sin(state.frame * 0.5) * 9 : 0;
  const armSwing = state.running ? Math.sin(state.frame * 0.5 + 1) * 7 : 0;

  ctx.save();
  ctx.translate(p.x, p.y + bob);

  ctx.fillStyle = '#e96286';
  ctx.beginPath();
  ctx.arc(30, 16, 13, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffcbda';
  ctx.beginPath();
  ctx.arc(29, 18, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f89bb6';
  ctx.beginPath();
  ctx.moveTo(16, 30);
  ctx.lineTo(43, 30);
  ctx.lineTo(49, 56);
  ctx.lineTo(12, 56);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#d65c80';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(19, 34);
  ctx.lineTo(10 - armSwing, 47);
  ctx.moveTo(40, 34);
  ctx.lineTo(50 + armSwing, 46);
  ctx.stroke();

  ctx.strokeStyle = '#f0d7df';
  ctx.beginPath();
  ctx.moveTo(23, 56);
  ctx.lineTo(18 - legSwing, 81);
  ctx.moveTo(38, 56);
  ctx.lineTo(44 + legSwing, 81);
  ctx.stroke();

  ctx.strokeStyle = '#7a5a7b';
  ctx.beginPath();
  ctx.moveTo(16 - legSwing, 81);
  ctx.lineTo(23 - legSwing, 81);
  ctx.moveTo(42 + legSwing, 81);
  ctx.lineTo(49 + legSwing, 81);
  ctx.stroke();

  ctx.restore();
}

function drawObstacles() {
  for (const obstacle of state.obstacles) {
    const g = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.h);
    g.addColorStop(0, '#444');
    g.addColorStop(1, '#222');
    ctx.fillStyle = g;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);

    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(obstacle.x + 4, obstacle.y + 4, obstacle.w - 8, 8);
  }
}

function draw() {
  drawSky();
  drawHills();
  drawGround();
  drawObstacles();
  drawPlayer();
}

let lastTs = performance.now();
function loop(ts) {
  const deltaMs = Math.min(32, ts - lastTs || 16.666);
  lastTs = ts;
  state.frame += 1;
  update(deltaMs);
  draw();
  requestAnimationFrame(loop);
}

jumpBtn.addEventListener('click', startOrJump);
restartBtn.addEventListener('click', resetGame);
window.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  startOrJump();
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    event.preventDefault();
    startOrJump();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.running) {
    state.running = false;
    statusEl.textContent = 'Пауза';
    showStartOverlay(true);
  }
});

setPlayerName();
loadLeaderboard();
updateBest(0);
showStartOverlay(true);
showGameOver(false);
draw();
requestAnimationFrame(loop);
