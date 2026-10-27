
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { AppError, wrap } = require('../errors');
const { requireAdmin } = require('../middleware/auth');
const { issueToken } = require('../services/authToken');

const loginLimiter = rateLimit({
  skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMIT,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  handler: (req, res, next) =>
    next(new AppError(429, 'RATE_LIMITED', 'Too many login attempts. Try again later.'))
});

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const audit = (adminId, action, type, id) =>
  pool.query(
    'INSERT INTO audit_logs (admin_id, action, entity_type, entity_id) VALUES ($1,$2,$3,$4)',
    [adminId, action, type, id == null ? null : String(id)]
  );

const page = (q) => {
  const limit = Math.min(Math.max(parseInt(q.limit) || 20, 1), 100);
  const p = Math.max(parseInt(q.page) || 1, 1);
  return { limit, offset: (p - 1) * limit, page: p };
};

// ADMIN LOGIN
router.post('/admin/login', loginLimiter, wrap(async (req, res) => {
  const { username, password } = req.body || {};

  const bad = new AppError(
    401,
    'INVALID_CREDENTIALS',
    'Incorrect username or password.'
  );

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length > 50 ||
    password.length > 200
  ) {
    throw bad;
  }

  const a = (
    await pool.query(
      'SELECT id, password_hash FROM admins WHERE username=$1',
      [username]
    )
  ).rows[0];

  const ok = await bcrypt.compare(
    password,
    a ? a.password_hash : DUMMY_HASH
  );

  if (!a || !ok) throw bad;

  await audit(a.id, 'admin_login', 'admin', a.id);

  res.json({ ok: true, access_token: issueToken('admin', a.id) });
}));

// Protect all subsequent /admin routes.
router.use('/admin', requireAdmin);

// ADMIN LOGOUT
router.post('/admin/logout', (req, res) => res.json({ ok: true }));

// GET ADMIN ACCOUNT
router.get('/admin/account', wrap(async (req, res) => {
  const r = await pool.query(
    'SELECT username FROM admins WHERE id=$1',
    [req.adminId]
  );

  if (!r.rows[0]) {
    throw new AppError(404, 'NOT_FOUND', 'Administrator account not found.');
  }

  res.json(r.rows[0]);
}));

// UPDATE ADMIN ACCOUNT
router.patch('/admin/account', wrap(async (req, res) => {
  const { username, current_password, new_password } = req.body || {};

  const name = typeof username === 'string' ? username.trim() : '';

  if (!name || name.length > 50) {
    throw new AppError(
      400,
      'VALIDATION',
      'Username is required (max 50 characters).'
    );
  }

  if (
    typeof current_password !== 'string' ||
    !current_password ||
    current_password.length > 200
  ) {
    throw new AppError(
      400,
      'VALIDATION',
      'Enter your current password to confirm this change.'
    );
  }

  if (
    typeof new_password !== 'string' ||
    new_password.length < 8 ||
    new_password.length > 200
  ) {
    throw new AppError(
      400,
      'VALIDATION',
      'New password must be between 8 and 200 characters.'
    );
  }

  const account = (
    await pool.query(
      'SELECT password_hash FROM admins WHERE id=$1',
      [req.adminId]
    )
  ).rows[0];

  if (!account) {
    throw new AppError(404, 'NOT_FOUND', 'Administrator account not found.');
  }

  if (!(await bcrypt.compare(current_password, account.password_hash))) {
    throw new AppError(
      400,
      'INVALID_PASSWORD',
      'Current password is incorrect.'
    );
  }

  const passwordHash = await bcrypt.hash(new_password, 10);
  let updated;

  try {
    updated = await pool.query(
      'UPDATE admins SET username=$1, password_hash=$2 WHERE id=$3 RETURNING id, username',
      [name, passwordHash, req.adminId]
    );
  } catch (e) {
    if (e.code === '23505') {
      throw new AppError(
        409,
        'USERNAME_TAKEN',
        'That username is already in use.'
      );
    }
    throw e;
  }

  await audit(
    req.adminId,
    'admin_credentials_updated',
    'admin',
    req.adminId
  );

  res.json(updated.rows[0]);
}));

// ADMIN DASHBOARD
router.get('/admin/dashboard', wrap(async (req, res) => {
  const r = await pool.query(`
    SELECT
      (SELECT count(*) FROM family_members)::int AS total_members,
      (SELECT count(*) FROM family_members
        WHERE is_active AND gender='male')::int AS active_male,
      (SELECT count(*) FROM family_members
        WHERE is_active AND gender='female')::int AS active_female,
      (SELECT count(*) FROM draws d
        WHERE d.round_number=(
          SELECT round_number FROM lottery_settings WHERE id=1
        ))::int AS drawn,
      (SELECT count(*) FROM family_members m
        WHERE m.is_active AND NOT EXISTS (
          SELECT 1 FROM draws d
          WHERE d.participant_id=m.id
          AND d.round_number=(
            SELECT round_number FROM lottery_settings WHERE id=1
          )
        ))::int AS not_drawn,
      COALESCE(
        (SELECT status FROM lottery_settings WHERE id=1),
        'not_started'
      ) AS lottery_status,
      COALESCE(
        (SELECT round_number FROM lottery_settings WHERE id=1),
        1
      ) AS round_number
  `);

  res.json({
    ...r.rows[0],
    completed_assignments: r.rows[0].drawn
  });
}));

// LIST FAMILY MEMBERS
router.get('/admin/members', wrap(async (req, res) => {
  const { limit, offset, page: pg } = page(req.query);
  const w = [];
  const v = [];

  if (req.query.q) {
    v.push(`%${String(req.query.q).slice(0, 100)}%`);
    w.push(`(m.full_name ILIKE $${v.length} OR m.member_code ILIKE $${v.length})`);
  }

  if (['male', 'female'].includes(req.query.gender)) {
    v.push(req.query.gender);
    w.push(`m.gender=$${v.length}`);
  }

  if (['true', 'false'].includes(req.query.active)) {
    v.push(req.query.active === 'true');
    w.push(`m.is_active=$${v.length}`);
  }

  if (['true', 'false'].includes(req.query.drawn)) {
    w.push(
      `${req.query.drawn === 'true' ? '' : 'NOT '}EXISTS (
        SELECT 1 FROM draws d
        WHERE d.participant_id=m.id
        AND d.round_number=(
          SELECT round_number FROM lottery_settings WHERE id=1
        )
      )`
    );
  }

  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';

  const total = (
    await pool.query(
      `SELECT count(*)::int c FROM family_members m ${where}`,
      v
    )
  ).rows[0].c;

  const rows = (
    await pool.query(
      `SELECT
        m.id, m.member_code, m.full_name, m.gender,
        m.phone_number, m.is_active, m.created_at,
        EXISTS (
          SELECT 1 FROM draws d
          WHERE d.participant_id=m.id
          AND d.round_number=(
            SELECT round_number FROM lottery_settings WHERE id=1
          )
        ) AS has_drawn
       FROM family_members m ${where}
       ORDER BY m.id LIMIT ${limit} OFFSET ${offset}`,
      v
    )
  ).rows;

  res.json({ data: rows, page: pg, limit, total });
}));

function validateMember(b, partial) {
  const out = {};

  if (!partial || b.full_name !== undefined) {
    const n = String(b.full_name || '').trim();

    if (!n || n.length > 100) {
      throw new AppError(
        400,
        'VALIDATION',
        'Full name is required (max 100 characters).'
      );
    }

    out.full_name = n;
  }

  if (!partial || b.gender !== undefined) {
    if (!['male', 'female'].includes(b.gender)) {
      throw new AppError(
        400,
        'VALIDATION',
        'Gender must be male or female.'
      );
    }

    out.gender = b.gender;
  }

  if (b.phone_number !== undefined) {
    const p = b.phone_number === null
      ? ''
      : String(b.phone_number).trim();

    if (p && !/^\+?[0-9 ()-]{6,30}$/.test(p)) {
      throw new AppError(
        400,
        'VALIDATION',
        'Phone number looks invalid.'
      );
    }

    out.phone_number = p || null;
  }

  return out;
}

function handlePhoneConflict(e) {
  if (
    e.code === '23505' &&
    e.constraint === 'idx_family_members_phone_digits_unique'
  ) {
    throw new AppError(
      409,
      'PHONE_IN_USE',
      'This phone number is already registered.'
    );
  }

  throw e;
}

// CREATE FAMILY MEMBER
router.post('/admin/members', wrap(async (req, res) => {
  const m = validateMember(req.body || {}, false);
  let r;

  try {
    r = await pool.query(
      'INSERT INTO family_members (full_name, gender, phone_number) VALUES ($1,$2,$3) RETURNING *',
      [m.full_name, m.gender, m.phone_number || null]
    );
  } catch (e) {
    handlePhoneConflict(e);
  }

  await audit(
    req.adminId,
    'member_created',
    'family_member',
    r.rows[0].id
  );

  res.status(201).json(r.rows[0]);
}));

// GET ONE FAMILY MEMBER
router.get('/admin/members/:id(\\d+)', wrap(async (req, res) => {
  const r = await pool.query(
    `SELECT m.*,
      EXISTS (
        SELECT 1 FROM draws d
        WHERE d.participant_id=m.id
        AND d.round_number=(
          SELECT round_number FROM lottery_settings WHERE id=1
        )
      ) AS has_drawn
     FROM family_members m
     WHERE id=$1`,
    [req.params.id]
  );

  if (!r.rows[0]) {
    throw new AppError(404, 'NOT_FOUND', 'Member not found.');
  }

  res.json(r.rows[0]);
}));

// ACTIVATE OR DEACTIVATE FAMILY MEMBER
router.patch('/admin/members/:id(\\d+)/status', wrap(async (req, res) => {
  if (typeof (req.body || {}).is_active !== 'boolean') {
    throw new AppError(
      400,
      'VALIDATION',
      'is_active must be true or false.'
    );
  }

  const r = await pool.query(
    'UPDATE family_members SET is_active=$1 WHERE id=$2 RETURNING id, is_active',
    [req.body.is_active, req.params.id]
  );

  if (!r.rows[0]) {
    throw new AppError(404, 'NOT_FOUND', 'Member not found.');
  }

  await audit(
    req.adminId,
    req.body.is_active ? 'member_activated' : 'member_deactivated',
    'family_member',
    r.rows[0].id
  );

  res.json(r.rows[0]);
}));

// UPDATE FAMILY MEMBER
router.patch('/admin/members/:id(\\d+)', wrap(async (req, res) => {
  const m = validateMember(req.body || {}, true);
  const keys = Object.keys(m);

  if (!keys.length) {
    throw new AppError(400, 'VALIDATION', 'Nothing to update.');
  }

  let r;

  try {
    r = await pool.query(
      `UPDATE family_members
       SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')}
       WHERE id=$${keys.length + 1}
       RETURNING *`,
      [...keys.map((k) => m[k]), req.params.id]
    );
  } catch (e) {
    handlePhoneConflict(e);
  }

  if (!r.rows[0]) {
    throw new AppError(404, 'NOT_FOUND', 'Member not found.');
  }

  await audit(
    req.adminId,
    'member_updated',
    'family_member',
    r.rows[0].id
  );

  res.json(r.rows[0]);
}));

// LIST DRAW RESULTS
router.get('/admin/draws', wrap(async (req, res) => {
  const { limit, offset, page: pg } = page(req.query);
  const v = [];
  let where = '';

  if (req.query.q) {
    v.push(`%${String(req.query.q).slice(0, 100)}%`);
    where = `WHERE p.full_name ILIKE $1
      OR p.member_code ILIKE $1
      OR a.full_name ILIKE $1
      OR a.member_code ILIKE $1`;
  }

  const base = `
    FROM draws d
    JOIN family_members p ON p.id=d.participant_id
    JOIN family_members a ON a.id=d.assigned_member_id
    ${where}
  `;

  const total = (
    await pool.query(`SELECT count(*)::int c ${base}`, v)
  ).rows[0].c;

  const rows = (
    await pool.query(
      `SELECT
        d.id, d.round_number,
        p.member_code AS participant_code,
        p.full_name AS participant_name,
        p.gender AS participant_gender,
        p.phone_number AS participant_phone,
        a.member_code AS assigned_code,
        a.full_name AS assigned_name,
        a.phone_number AS assigned_phone,
        d.drawn_at
       ${base}
       ORDER BY d.drawn_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      v
    )
  ).rows;

  res.json({ data: rows, page: pg, limit, total });
}));

// GET LOTTERY SETTINGS
router.get('/admin/settings', wrap(async (req, res) => {
  await pool.query(
    'INSERT INTO lottery_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING'
  );

  const s = (
    await pool.query('SELECT * FROM lottery_settings WHERE id=1')
  ).rows[0];

  const c = (
    await pool.query(`
      SELECT
        count(*) FILTER (WHERE gender='male')::int males,
        count(*) FILTER (WHERE gender='female')::int females
      FROM family_members
      WHERE is_active
    `)
  ).rows[0];

  res.json({
    ...s,
    active_male: c.males,
    active_female: c.females,
    counts_match: c.males === c.females
  });
}));

// UPDATE LOTTERY SETTINGS
// Actions: set_mode, approve_mismatch, start, pause, resume, close, new_round
router.patch('/admin/settings', wrap(async (req, res) => {
  const { action, matching_mode } = req.body || {};

  await pool.query(
    'INSERT INTO lottery_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING'
  );

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const s = (
      await client.query(
        'SELECT * FROM lottery_settings WHERE id=1 FOR UPDATE'
      )
    ).rows[0];

    const bad = (code, msg) => new AppError(409, code, msg);

    if (s.status === 'closed' && action !== 'new_round') {
      throw bad(
        'CLOSED',
        'The lottery is closed. Start a new round before changing its state.'
      );
    }

    if (action === 'set_mode') {
      if (s.status !== 'not_started') {
        throw bad(
          'LOCKED',
          'Matching mode can only be changed before the lottery starts.'
        );
      }

      if (!['one_to_one', 'open'].includes(matching_mode)) {
        throw new AppError(400, 'VALIDATION', 'Unknown matching mode.');
      }

      await client.query(
        `UPDATE lottery_settings
         SET matching_mode=$1,
             mismatch_approved=false,
             mismatch_approved_at=NULL
         WHERE id=1`,
        [matching_mode]
      );
    } else if (action === 'approve_mismatch') {
      if (s.status !== 'not_started') {
        throw bad(
          'LOCKED',
          'Approval is only needed before the lottery starts.'
        );
      }

      await client.query(
        `UPDATE lottery_settings
         SET mismatch_approved=true, mismatch_approved_at=now()
         WHERE id=1`
      );
    } else if (action === 'start') {
      if (s.status !== 'not_started') {
        throw bad('BAD_STATE', 'The lottery has already started.');
      }

      const c = (
        await client.query(`
          SELECT
            count(*) FILTER (WHERE gender='male')::int m,
            count(*) FILTER (WHERE gender='female')::int f
          FROM family_members
          WHERE is_active
        `)
      ).rows[0];

      if (c.m === 0 || c.f === 0) {
        throw bad(
          'NO_PARTICIPANTS',
          'Both male and female active members are needed.'
        );
      }

      if (
        s.matching_mode === 'one_to_one' &&
        c.m !== c.f &&
        !s.mismatch_approved
      ) {
        throw bad(
          'MISMATCH_NOT_APPROVED',
          `There are ${c.m} active males and ${c.f} active females, so not everyone can get a unique match. Review and approve before starting.`
        );
      }

      await client.query(
        `UPDATE lottery_settings
         SET status='open', started_at=now()
         WHERE id=1`
      );
    } else if (action === 'pause') {
      if (s.status !== 'open') {
        throw bad('BAD_STATE', 'Only an open lottery can be paused.');
      }

      await client.query(
        `UPDATE lottery_settings SET status='paused' WHERE id=1`
      );
    } else if (action === 'resume') {
      if (s.status !== 'paused') {
        throw bad('BAD_STATE', 'Only a paused lottery can be resumed.');
      }

      await client.query(
        `UPDATE lottery_settings SET status='open' WHERE id=1`
      );
    } else if (action === 'close') {
      if (s.status === 'not_started') {
        throw bad('BAD_STATE', 'The lottery has not started.');
      }

      await client.query(
        `UPDATE lottery_settings
         SET status='closed', closed_at=now()
         WHERE id=1`
      );
    } else if (action === 'new_round') {
      if (s.status !== 'closed') {
        throw bad(
          'BAD_STATE',
          'A new round can only start after the previous round is closed.'
        );
      }

      await client.query(`
        UPDATE lottery_settings
        SET status='not_started',
            round_number=round_number+1,
            started_at=NULL,
            closed_at=NULL,
            mismatch_approved=false,
            mismatch_approved_at=NULL
        WHERE id=1
      `);
    } else {
      throw new AppError(400, 'VALIDATION', 'Unknown action.');
    }

    await client.query(
      `INSERT INTO audit_logs
       (admin_id, action, entity_type, entity_id)
       VALUES ($1,$2,$3,$4)`,
      [
        req.adminId,
        `lottery_${action}`,
        'lottery_settings',
        '1'
      ]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  res.json(
    (await pool.query('SELECT * FROM lottery_settings WHERE id=1')).rows[0]
  );
}));

// ADMIN AUDIT LOGS
router.get('/admin/audit-logs', wrap(async (req, res) => {
  const { limit, offset, page: pg } = page(req.query);

  const rows = (
    await pool.query(`
      SELECT
        l.id, a.username AS admin, l.action,
        l.entity_type, l.entity_id, l.created_at
      FROM audit_logs l
      LEFT JOIN admins a ON a.id=l.admin_id
      ORDER BY l.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `)
  ).rows;

  res.json({ data: rows, page: pg, limit });
}));

// CSV EXPORT
const csvCell = (v) => {
  let s = v == null
    ? ''
    : v instanceof Date
      ? v.toISOString()
      : String(v);

  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }

  return `"${s.replace(/"/g, '""')}"`;
};

router.get('/admin/export', wrap(async (req, res) => {
  const type = req.query.type === 'results' ? 'results' : 'members';

  const q = type === 'members'
    ? `SELECT member_code, full_name, gender, phone_number, is_active, created_at
       FROM family_members
       ORDER BY id`
    : `SELECT
         d.round_number,
         p.member_code AS participant_code,
         p.full_name AS participant_name,
         p.gender AS participant_gender,
         p.phone_number AS participant_phone,
         a.member_code AS assigned_code,
         a.full_name AS assigned_name,
         a.phone_number AS assigned_phone,
         d.drawn_at
       FROM draws d
       JOIN family_members p ON p.id=d.participant_id
       JOIN family_members a ON a.id=d.assigned_member_id
       ORDER BY d.drawn_at`;

  const r = await pool.query(q);

  const head = r.fields.map((f) => f.name).join(',');

  const body = r.rows
    .map((row) => r.fields.map((f) => csvCell(row[f.name])).join(','))
    .join('\n');

  await audit(
    req.adminId,
    `export_${type}`,
    'export',
    null
  );

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${type}.csv"`
  }).send(head + '\n' + body + '\n');
}));

module.exports = router;
