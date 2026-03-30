import 'dotenv/config';
import express from 'express';
import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import { initDb, getTopPlayers, saveScore, getUserBestScore } from './lib/db.js';
import { verifyTelegramWebAppData, parseTelegramWebAppUser } from './lib/telegramAuth.js';

const {
  BOT_TOKEN,
  APP_URL,
  PORT = 3000,
  WEBHOOK_SECRET = 'change-me-please',
  NODE_ENV = 'development'
} = process.env;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (NODE_ENV === 'production' && !APP_URL) throw new Error('APP_URL is required in production');

await initDb();

const bot = new Bot(BOT_TOKEN);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use('/webapp', express.static('webapp', { extensions: ['html'] }));

function getBaseUrl(req) {
  if (APP_URL) return APP_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function buildGameKeyboard(baseUrl) {
  return new InlineKeyboard().webApp('Играть в Runner', `${baseUrl}/webapp/index.html`);
}

function formatUserName(row) {
  if (row.username) return `@${row.username}`;
  return row.first_name || `id:${row.telegram_id}`;
}

function formatTopMessage(rows, title = 'Runner: топ-10') {
  const lines = rows.map((row, index) => `${index + 1}. ${formatUserName(row)} — ${row.best_score}`);
  return [title, ...lines].join('\n');
}

bot.command('start', async (ctx) => {
  const baseUrl = APP_URL?.replace(/\/$/, '') || `http://localhost:${PORT}`;
  await ctx.reply(
    [
      'Привет! Это Runner внутри Telegram Mini App.',
      'Нажми кнопку ниже, чтобы открыть игру.',
      'Команды:',
      '/runner — открыть игру',
      '/toprunner — показать топ игроков'
    ].join('\n'),
    { reply_markup: buildGameKeyboard(baseUrl) }
  );
});

bot.command('runner', async (ctx) => {
  const baseUrl = APP_URL?.replace(/\/$/, '') || `http://localhost:${PORT}`;
  await ctx.reply('Открывай Runner:', { reply_markup: buildGameKeyboard(baseUrl) });
});

bot.command('toprunner', async (ctx) => {
  const top = await getTopPlayers(10);
  if (!top.length) {
    await ctx.reply('Пока никто не играл. Будь первым: /runner');
    return;
  }
  await ctx.reply(formatTopMessage(top));
});

bot.on('message:web_app_data', async (ctx) => {
  try {
    const payload = JSON.parse(ctx.message.web_app_data.data);
    if (payload?.type !== 'score' || typeof payload.score !== 'number') return;

    const telegramUser = ctx.from;
    const top = await getTopPlayers(1000);
    const place = top.findIndex((row) => Number(row.telegram_id) === Number(telegramUser.id)) + 1;
    const bestScore = await getUserBestScore(telegramUser.id);

    await ctx.reply(
      [
        `Ваш результат: ${payload.score}`,
        `Ваш рекорд: ${bestScore}`,
        `Ваше место в топе: ${place || '-'}`,
        'Топ игроков: /toprunner',
        'Играть ещё: /runner'
      ].join('\n')
    );
  } catch (error) {
    console.error('web_app_data handler error', error);
  }
});

app.get('/', (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.type('html').send(`
    <h1>Runner Bot is alive</h1>
    <p>Health: <a href="${baseUrl}/api/health">/api/health</a></p>
    <p>Leaderboard: <a href="${baseUrl}/api/leaderboard">/api/leaderboard</a></p>
    <p>Game: <a href="${baseUrl}/webapp/index.html">/webapp/index.html</a></p>
  `);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: NODE_ENV });
});

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const rows = await getTopPlayers(10);
    res.json({
      ok: true,
      items: rows.map((row, index) => ({
        rank: index + 1,
        name: formatUserName(row),
        score: row.best_score,
        username: row.username,
        first_name: row.first_name,
        telegram_id: row.telegram_id,
        best_score: row.best_score
      }))
    });
  } catch (error) {
    console.error('/api/leaderboard error', error);
    res.status(500).json({ ok: false, error: 'Failed to load leaderboard' });
  }
});

app.post('/api/score', async (req, res) => {
  try {
    const { score, durationMs, initDataRaw } = req.body ?? {};

    if (!Number.isInteger(score) || score < 0) {
      return res.status(400).json({ ok: false, error: 'Invalid score' });
    }

    if (!Number.isInteger(durationMs) || durationMs < 0) {
      return res.status(400).json({ ok: false, error: 'Invalid durationMs' });
    }

    if (score > 0 && durationMs < 1500) {
      return res.status(400).json({ ok: false, error: 'Round too short' });
    }

    if (durationMs > 0 && score / (durationMs / 1000) > 8) {
      return res.status(400).json({ ok: false, error: 'Score looks suspicious' });
    }

    if (!initDataRaw || typeof initDataRaw !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing initDataRaw' });
    }

    const valid = verifyTelegramWebAppData(initDataRaw, BOT_TOKEN);
    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Invalid Telegram auth' });
    }

    const telegramUser = parseTelegramWebAppUser(initDataRaw);
    if (!telegramUser?.id) {
      return res.status(400).json({ ok: false, error: 'Telegram user not found' });
    }

    const result = await saveScore({
      telegramId: telegramUser.id,
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      score,
      durationMs
    });

    const top = await getTopPlayers(1000);
    const place = top.findIndex((row) => Number(row.telegram_id) === Number(telegramUser.id)) + 1;
    const bestScore = await getUserBestScore(telegramUser.id);

    return res.json({
      ok: true,
      score,
      bestScore,
      place,
      isNewRecord: result.isNewRecord
    });
  } catch (error) {
    console.error('/api/score error', error);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

if (NODE_ENV === 'production') {
  app.use(`/telegram/${WEBHOOK_SECRET}`, webhookCallback(bot, 'express'));
  await bot.api.setWebhook(`${APP_URL.replace(/\/$/, '')}/telegram/${WEBHOOK_SECRET}`);
  console.log('Webhook set');
} else {
  bot.start();
  console.log('Bot polling started');
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
