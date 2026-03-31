import crypto from 'crypto';

export function verifyTelegramWebAppData(initDataRaw, botToken) {
  const params = new URLSearchParams(initDataRaw);
  const hash = params.get('hash');

  if (!hash) return false;

  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}

export function parseTelegramWebAppUser(initDataRaw) {
  const params = new URLSearchParams(initDataRaw);
  const userRaw = params.get('user');
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}
