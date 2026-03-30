const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
  tg.setBackgroundColor?.('#ffe2f2');
  tg.setHeaderColor?.('#ffe2f2');
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

const mascotSprite = new Image();
mascotSprite.src = './assets/mascot-runner.png';

const WORLD = { width: 420, height: 640, groundY: 520, playerX: 76 };
canvas.width = WORLD.width;
canvas.height = WORLD.height;

const state = {
  running: false,
  gameOver: false,
  score: 0,
  bestScore: 0,
  speed: 6.2,
  distance: 0,
  timeMs: 0,
  spawnTimer: 0,
  sentScore: false,
  place: '-',
  frame: 0,
  obstacles: [],
  stars: Array.from({ length: 9 }, (_, i) => ({
    x: 26 + i * 43,
    y: 56 + (i % 4) * 24,
    size: 2 + (i % 2),
    drift: 0.2 + i * 0.04
  })),
  clouds: Array.from({ length: 4 }, (_, i) => ({
    x: 60 + i * 120,
    y: 76 + (i % 2) * 42,
    size: 54 + i * 8
  })),
  player: {
    x: WORLD.playerX,
    y: WORLD.groundY - 108,
    w: 72,
    h: 108,
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
  state.speed = 6.2;
  state.distance = 0;
  state.timeMs = 0;
  state.spawnTimer = 720;
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
  const tall = Math.random() > 0.56;
  const type = Math.random() > 0.7 ? 'double' : (tall ? 'tall' : 'short');

  if (type === 'double') {
    const width = 24;
    const gap = 18;
    state.obstacles.push(
      { x: WORLD.width + width, y: WORLD.groundY - 50, w: width, h: 50, type: 'short', passed: false },
      { x: WORLD.width + width + gap + width, y: WORLD.groundY - 70, w: width, h: 70, type: 'tall', passed: false }
    );
    return;
  }

  if (type === 'tall') {
    state.obstacles.push({
      x: WORLD.width + 30,
      y: WORLD.groundY - 78,
      w: 28,
      h: 78,
      type,
      passed: false
    });
    return;
  }

  state.obstacles.push({
    x: WORLD.width + 28,
    y: WORLD.groundY - 52,
    w: 30,
    h: 52,
    type,
    passed: false
  });
}

function update(deltaMs) {
  if (!state.running) return;

  state.timeMs += deltaMs;
  state.distance += state.speed * (deltaMs / 16.666);
  state.speed += 0.0026 * (deltaMs / 16.666);
  state.player.jumpBufferMs = Math.max(0, state.player.jumpBufferMs - deltaMs);

  if (state.player.jumpBufferMs > 0 && state.player.onGround) {
    state.player.vy = -16.2;
    state.player.onGround = false;
    state.player.jumpBufferMs = 0;
  }

  state.player.vy += 0.9 * (deltaMs / 16.666);
  state.player.y += state.player.vy * (deltaMs / 16.666);

  if (state.player.y >= WORLD.groundY - state.player.h) {
    state.player.y = WORLD.groundY - state.player.h;
    state.player.vy = 0;
    state.player.onGround = true;
  }

  state.spawnTimer -= deltaMs;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    const delay = Math.max(630, 1150 - state.speed * 40 + Math.random() * 180);
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

  state.obstacles = state.obstacles.filter((item) => item.x + item.w > -30);
}

function isColliding(a, b) {
  const insetX = 14;
  const insetY = 10;
  return (
    a.x + insetX < b.x + b.w &&
    a.x + a.w - insetX > b.x &&
    a.y + insetY < b.y + b.h &&
    a.y + a.h - insetY > b.y
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
  g.addColorStop(0, '#dff6ff');
  g.addColorStop(0.5, '#ffe7f3');
  g.addColorStop(1, '#fff9fb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (const star of state.stars) {
    const x = (star.x - state.distance * star.drift) % (WORLD.width + 40);
    drawSparkle(x < -20 ? x + WORLD.width + 40 : x, star.y, star.size);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  for (const cloud of state.clouds) {
    const x = ((cloud.x - state.distance * 0.18) % (WORLD.width + 120)) - 80;
    drawCloud(x, cloud.y, cloud.size);
  }
}

function drawSparkle(x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-size * 2, 0);
  ctx.lineTo(size * 2, 0);
  ctx.moveTo(0, -size * 2);
  ctx.lineTo(0, size * 2);
  ctx.stroke();
  ctx.restore();
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
  ctx.fillStyle = '#c8eedb';
  for (let i = -1; i < 4; i++) {
    const x = i * 220 - shift;
    ctx.beginPath();
    ctx.moveTo(x, WORLD.groundY);
    ctx.quadraticCurveTo(x + 70, WORLD.groundY - 76, x + 140, WORLD.groundY);
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

  ctx.fillStyle = '#7cbf8a';
  for (let i = 0; i < WORLD.width / 18 + 4; i++) {
    const x = -((state.distance * 1.1) % 18) + i * 18;
    ctx.fillRect(x, WORLD.groundY - 6, 3, 8);
  }
}

function drawPlayer() {
  const p = state.player;
  const bob = state.player.onGround && state.running ? Math.sin(state.frame * 0.42) * 2 : 0;
  const drawW = 92;
  const drawH = 162;
  const scaleX = state.player.onGround ? 1 : 0.98;
  const scaleY = state.player.onGround ? 1 : 1.04;
  const rotation = state.player.onGround ? Math.sin(state.frame * 0.08) * 0.01 : -0.08;

  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2 + bob);
  ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);

  if (mascotSprite.complete && mascotSprite.naturalWidth > 0) {
    ctx.drawImage(mascotSprite, -drawW / 2, -drawH / 2 + 10, drawW, drawH);
  } else {
    ctx.fillStyle = '#ff6fb0';
    ctx.fillRect(-28, -44, 56, 88);
  }

  ctx.restore();
}

function drawObstacle(obstacle) {
  const grad = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.h);
  grad.addColorStop(0, '#4d5664');
  grad.addColorStop(1, '#2b2f36');
  ctx.fillStyle = grad;
  roundRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, 6, true);

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(obstacle.x + 4, obstacle.y + 4, obstacle.w - 8, 10, 4, true);
}

function drawScoreBanner() {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.76)';
  roundRect(14, 14, 146, 48, 16, true);
  ctx.fillStyle = '#61708d';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText('Pick Me Runner', 28, 34);
  ctx.fillStyle = '#ff2d96';
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.fillText(String(state.score), 28, 54);
  ctx.restore();
}

function roundRect(x, y, w, h, r, fill = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  if (fill) ctx.fill();
}

function render() {
  drawSky();
  drawHills();
  drawGround();
  drawScoreBanner();
  for (const obstacle of state.obstacles) drawObstacle(obstacle);
  drawPlayer();
}

let lastTs = performance.now();
function frame(ts) {
  const deltaMs = Math.min(32, ts - lastTs || 16.666);
  lastTs = ts;
  state.frame += deltaMs / 16.666;
  update(deltaMs);
  render();
  requestAnimationFrame(frame);
}

window.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  startOrJump();
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
    event.preventDefault();
    startOrJump();
  }
});

jumpBtn.addEventListener('click', startOrJump);
restartBtn.addEventListener('click', resetGame);

setPlayerName();
loadLeaderboard();
render();
requestAnimationFrame(frame);
