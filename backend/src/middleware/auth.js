const { AppError } = require('../errors');
const pool = require('../db');
const MEMBER_TTL_MS = 30 * 60 * 1000;

const requireAdmin = (req, res, next) =>
  req.session && req.session.adminId ? next() : next(new AppError(401, 'UNAUTHORIZED', 'Administrator login required.'));

async function requireMember(req, res, next) {
  try {
    const s = req.session;
    if (!s || !s.memberId || Date.now() > s.memberExpires) throw new AppError(401, 'SESSION_EXPIRED', 'Please enter your Member ID again.');
    const r = await pool.query('SELECT id, member_code, full_name, gender, is_active FROM family_members WHERE id=$1', [s.memberId]);
    if (!r.rows[0] || !r.rows[0].is_active) throw new AppError(401, 'SESSION_EXPIRED', 'Please enter your Member ID again.');
    req.member = r.rows[0];
    next();
  } catch (e) { next(e); }
}
// CSRF defence for cross-site cookies: state-changing calls must carry a custom header (blocked by CORS for other origins)
function requireCustomHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return req.get('X-Requested-With') === 'family-lottery' ? next() : next(new AppError(403, 'FORBIDDEN', 'Invalid request.'));
}
module.exports = { requireAdmin, requireMember, requireCustomHeader, MEMBER_TTL_MS };
