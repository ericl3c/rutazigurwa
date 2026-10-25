const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { AppError, wrap } = require('../errors');
const { requireMember, MEMBER_TTL_MS } = require('../middleware/auth');
const { performDraw, existingResult } = require('../services/draw');

const loginLimiter = rateLimit({ skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMIT, windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a few minutes.')) });
const drawLimiter = rateLimit({ skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMIT, windowMs: 60 * 1000, limit: 10, handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests.')) });
const CODE_RE = /^RUT-\d{3,6}$/;
const getLotteryState = async () => (await pool.query('SELECT status, round_number FROM lottery_settings WHERE id=1')).rows[0];
const registerLimiter = rateLimit({ skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMIT, windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many registration attempts. Please wait and try again.')) });
const insertPhoneConflict = (e) => {
  if (e.code === '23505' && e.constraint === 'idx_family_members_phone_digits_unique')
    throw new AppError(409, 'PHONE_IN_USE', 'This phone number is already registered.');
  throw e;
};

router.post('/member/register', registerLimiter, wrap(async (req, res) => {
  const body = req.body || {};
  const fullName = String(body.full_name || '').trim();
  const gender = body.gender;
  const phone = body.phone_number == null ? '' : String(body.phone_number).trim();
  if (!fullName || fullName.length > 100) throw new AppError(400, 'VALIDATION', 'Full name is required (max 100 characters).');
  if (!['male', 'female'].includes(gender)) throw new AppError(400, 'VALIDATION', 'Gender must be male or female.');
  if (phone && !/^\+?[0-9 ()-]{6,30}$/.test(phone)) throw new AppError(400, 'VALIDATION', 'Phone number looks invalid.');
  let result;
  try {
    result = await pool.query(
      'INSERT INTO family_members (full_name, gender, phone_number) VALUES ($1,$2,$3) RETURNING id, member_code, full_name',
      [fullName, gender, phone || null]);
  } catch (e) { insertPhoneConflict(e); }
  res.status(201).json(result.rows[0]);
}));

router.post('/member/login', loginLimiter, wrap(async (req, res) => {
  const code = String((req.body || {}).member_code || '').trim().toUpperCase();
  const generic = new AppError(401, 'INVALID_ID', 'We could not find an active member with that ID. Please check it and try again.');
  if (!CODE_RE.test(code)) throw generic;
  const r = await pool.query('SELECT id, is_active FROM family_members WHERE member_code=$1', [code]);
  if (!r.rows[0] || !r.rows[0].is_active) throw generic;       // same message for unknown and inactive
  await new Promise((ok, no) => req.session.regenerate((e) => (e ? no(e) : ok())));
  req.session.memberId = r.rows[0].id;
  req.session.memberExpires = Date.now() + MEMBER_TTL_MS;
  res.json({ ok: true });
}));

router.post('/member/logout', (req, res, next) => {
  delete req.session.memberId; delete req.session.memberExpires;
  req.session.save((e) => (e ? next(e) : res.json({ ok: true })));
});

router.get('/member/me', requireMember, wrap(async (req, res) => {
  const state = await getLotteryState();
  const prior = await existingResult(pool, req.member.id, state.round_number);
  res.json({ name: req.member.full_name, member_code: req.member.member_code,
    lottery_status: state.status, lottery_round: state.round_number, has_drawn: !!prior });
}));

router.get('/member/my-result', requireMember, wrap(async (req, res) => {
  const state = await getLotteryState();
  const prior = await existingResult(pool, req.member.id, state.round_number);
  if (!prior) throw new AppError(404, 'NO_RESULT', 'You have not drawn yet in this round.');
  res.json({ assigned_name: prior.assigned_name, drawn_at: prior.drawn_at });
}));

router.get('/lottery/status', wrap(async (req, res) => res.json(await getLotteryState())));

router.post('/lottery/draw', drawLimiter, requireMember, wrap(async (req, res) => {
  const r = await performDraw(req.member.id);
  res.status(r.alreadyDrawn ? 200 : 201).json({ already_drawn: r.alreadyDrawn, assigned_name: r.assignedName, drawn_at: r.drawnAt });
}));
module.exports = router;
