import pg from 'pg';

const { Pool } = pg;

const ssl = process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      best_score INTEGER NOT NULL DEFAULT 0,
      best_duration_ms INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS score_history (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      score INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_message_history (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL,
      promo_type TEXT NOT NULL,
      sent_on_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (telegram_id, promo_type, sent_on_date)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_score_history_telegram_id_created_at
    ON score_history (telegram_id, created_at DESC);
  `);
}

export async function saveScore({ telegramId, username, firstName, score, durationMs = 0 }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT best_score FROM players WHERE telegram_id = $1 FOR UPDATE',
      [telegramId]
    );

    const globalBestBeforeResult = await client.query(
      'SELECT best_score FROM players ORDER BY best_score DESC LIMIT 1 FOR UPDATE'
    );

    const prevBest = Number(existing.rows[0]?.best_score ?? 0);
    const globalBestBefore = Number(globalBestBeforeResult.rows[0]?.best_score ?? 0);
    const bestScore = Math.max(prevBest, score);
    const isNewPersonalRecord = score > prevBest;
    const isNewGlobalRecord = score > globalBestBefore;

    await client.query(
      `INSERT INTO players (telegram_id, username, first_name, best_score, best_duration_ms)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (telegram_id)
       DO UPDATE SET
         username = EXCLUDED.username,
         first_name = EXCLUDED.first_name,
         best_score = GREATEST(players.best_score, EXCLUDED.best_score),
         best_duration_ms = CASE
           WHEN EXCLUDED.best_score >= players.best_score THEN EXCLUDED.best_duration_ms
           ELSE players.best_duration_ms
         END,
         updated_at = NOW()`,
      [telegramId, username, firstName, score, durationMs]
    );

    await client.query(
      'INSERT INTO score_history (telegram_id, score, duration_ms) VALUES ($1, $2, $3)',
      [telegramId, score, durationMs]
    );

    await client.query('COMMIT');
    return { bestScore, isNewPersonalRecord, isNewGlobalRecord };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getTopPlayers(limit = 10) {
  const { rows } = await pool.query(
    `SELECT telegram_id, username, first_name, best_score, updated_at
     FROM players
     ORDER BY best_score DESC, updated_at ASC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getUserBestScore(telegramId) {
  const { rows } = await pool.query(
    'SELECT best_score FROM players WHERE telegram_id = $1',
    [telegramId]
  );
  return rows[0]?.best_score ?? 0;
}

export async function canSendPromoMessage({ telegramId, promoType, sentOnDate }) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM promo_message_history
     WHERE telegram_id = $1 AND promo_type = $2 AND sent_on_date = $3
     LIMIT 1`,
    [telegramId, promoType, sentOnDate]
  );

  return rows.length === 0;
}

export async function markPromoMessageSent({ telegramId, promoType, sentOnDate }) {
  await pool.query(
    `INSERT INTO promo_message_history (telegram_id, promo_type, sent_on_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id, promo_type, sent_on_date) DO NOTHING`,
    [telegramId, promoType, sentOnDate]
  );
}
