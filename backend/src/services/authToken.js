const crypto = require('crypto');

const ADMIN_TOKEN_TTL_SECONDS = 4 * 60 * 60;
const MEMBER_TOKEN_TTL_SECONDS = 30 * 60;

const secret = () =>
  process.env.AUTH_TOKEN_SECRET ||
  process.env.SESSION_SECRET ||
  'dev-only-secret';

function issueToken(role, id) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = role === 'admin'
    ? ADMIN_TOKEN_TTL_SECONDS
    : MEMBER_TOKEN_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({
    sub: String(id),
    role,
    iat: now,
    exp: now + ttl,
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function verifyToken(token, role) {
  if (typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const expected = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest();
  const actual = Buffer.from(signature, 'base64url');

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const id = Number(claims.sub);
  const maxTtl = role === 'admin'
    ? ADMIN_TOKEN_TTL_SECONDS
    : MEMBER_TOKEN_TTL_SECONDS;

  if (
    claims.role !== role ||
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !Number.isSafeInteger(claims.iat) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.iat > now ||
    claims.exp <= now ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > maxTtl
  ) {
    return null;
  }

  return { id };
}

module.exports = { issueToken, verifyToken };
