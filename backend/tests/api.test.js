process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:testpw@localhost:5432/lottery_test';
process.env.SESSION_SECRET = 'test-secret'; process.env.FRONTEND_URL = 'http://localhost:3000';
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const pool = require('../src/db');
const { performDraw } = require('../src/services/draw');
const H = { 'X-Requested-With': 'family-lottery' };

function bearerAgent(token) {
  const withToken = (method, path) => request(app)[method](path)
    .set('Authorization', `Bearer ${token}`);

  return {
    get: (path) => withToken('get', path),
    post: (path) => withToken('post', path),
    patch: (path) => withToken('patch', path),
  };
}

async function reset(males = 3, females = 3) {
  await pool.query('TRUNCATE draws, audit_logs, family_members, admins, lottery_settings, sessions RESTART IDENTITY CASCADE');
  await pool.query('ALTER SEQUENCE member_code_seq RESTART 1');
  await pool.query('INSERT INTO lottery_settings (id) VALUES (1)');
  for (let i = 0; i < Math.max(males, females); i++) {
    if (i < males) await pool.query(`INSERT INTO family_members (full_name, gender) VALUES ($1,'male')`, ['Man ' + i]);
    if (i < females) await pool.query(`INSERT INTO family_members (full_name, gender) VALUES ($1,'female')`, ['Woman ' + i]);
  }
  await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1,$2)', ['boss', await bcrypt.hash('correct-horse-battery', 4)]);
}
const setStatus = (s) => pool.query('UPDATE lottery_settings SET status=$1 WHERE id=1', [s]);
async function memberAgent(code) {
  const r = await request(app).post('/api/member/login').set(H).send({ member_code: code });
  return { a: bearerAgent(r.body.access_token), r };
}
async function adminAgent() {
  const r = await request(app).post('/api/admin/login').set(H).send({ username: 'boss', password: 'correct-horse-battery' });
  return bearerAgent(r.body.access_token);
}
const genderOf = async (name) => (await pool.query('SELECT gender FROM family_members WHERE full_name=$1', [name])).rows[0].gender;

beforeEach(() => reset());
afterAll(() => pool.end());

describe('member login', () => {
  test('valid ID logs in and /me shows name', async () => {
    const { a, r } = await memberAgent('FAM-001'); expect(r.status).toBe(200);
    expect(r.body.access_token).toEqual(expect.any(String));
    const me = await a.get('/api/member/me'); expect(me.body.name).toBe('Man 0'); expect(me.body.has_drawn).toBe(false);
  });
  test('member routes require a valid member bearer token', async () => {
    const { r } = await memberAgent('FAM-001');
    expect((await request(app).get('/api/member/me').set('Authorization', `Bearer ${r.body.access_token}x`)).status).toBe(401);
    expect((await request(app).get('/api/member/me').set('Authorization', `Bearer ${r.body.access_token}`)).status).toBe(200);
  });
  test('invalid ID rejected with generic message', async () => {
    const { r } = await memberAgent('FAM-999'); expect(r.status).toBe(401);
    const bad = await memberAgent('hello'); expect(bad.r.body.error.message).toBe(r.body.error.message);
  });
  test('inactive member gets same generic rejection', async () => {
    await pool.query('UPDATE family_members SET is_active=false WHERE id=1');
    const { r } = await memberAgent('FAM-001'); expect(r.status).toBe(401); expect(r.body.error.code).toBe('INVALID_ID');
  });
  test('request without the custom header is refused', async () => {
    const r = await request(app).post('/api/member/login').send({ member_code: 'FAM-001' }); expect(r.status).toBe(403);
  });
});

describe('drawing', () => {
  test('male draws a female and female draws a male', async () => {
    await setStatus('open');
    const m = await memberAgent('FAM-001'); const d1 = await m.a.post('/api/lottery/draw').set(H);
    expect(d1.status).toBe(201); expect(await genderOf(d1.body.assigned_name)).toBe('female');
    const f = await memberAgent('FAM-002'); const d2 = await f.a.post('/api/lottery/draw').set(H);
    expect(await genderOf(d2.body.assigned_name)).toBe('male');
  });
  test('never draws self and refresh/repeat returns the same result', async () => {
    await setStatus('open'); const { a } = await memberAgent('FAM-001');
    const first = await a.post('/api/lottery/draw').set(H); const again = await a.post('/api/lottery/draw').set(H);
    expect(again.body.already_drawn).toBe(true); expect(again.body.assigned_name).toBe(first.body.assigned_name);
    expect(first.body.assigned_name).not.toBe('Man 0');
    expect((await a.get('/api/member/my-result')).body.assigned_name).toBe(first.body.assigned_name);
    expect((await pool.query('SELECT count(*)::int c FROM draws')).rows[0].c).toBe(1);
  });
  test('simultaneous requests from one member create one draw', async () => {
    await setStatus('open'); const { a } = await memberAgent('FAM-001');
    const rs = await Promise.all(Array.from({ length: 8 }, () => a.post('/api/lottery/draw').set(H)));
    expect(new Set(rs.map((r) => r.body.assigned_name)).size).toBe(1);
    expect((await pool.query('SELECT count(*)::int c FROM draws')).rows[0].c).toBe(1);
  });
  test('everyone drawing at once gives a perfect one-to-one matching', async () => {
    await setStatus('open'); const ids = [1, 2, 3, 4, 5, 6];
    await Promise.all(ids.map((id) => performDraw(id)));
    const r = await pool.query('SELECT count(*)::int n, count(DISTINCT assigned_member_id)::int u FROM draws');
    expect(r.rows[0]).toEqual({ n: 6, u: 6 });
  });
  test('no eligible candidates: error and no record', async () => {
    await reset(2, 1); await setStatus('open');
    expect((await performDraw(1)).assignedName).toBe('Woman 0');
    await expect(performDraw(3)).rejects.toMatchObject({ code: 'NO_CANDIDATES' });
    expect((await pool.query('SELECT count(*)::int c FROM draws')).rows[0].c).toBe(1);
  });
  test('closed, paused and not-started lotteries refuse new draws', async () => {
    for (const [s, code] of [['not_started', 'NOT_STARTED'], ['paused', 'PAUSED'], ['closed', 'CLOSED']]) {
      await setStatus(s); await expect(performDraw(1)).rejects.toMatchObject({ code });
    }
    expect((await pool.query('SELECT count(*)::int c FROM draws')).rows[0].c).toBe(0);
  });
  test('database rolls back when a draw insert fails', async () => {
    await setStatus('open');
    await pool.query(`CREATE OR REPLACE FUNCTION boom() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'boom'; END $$ LANGUAGE plpgsql`);
    await pool.query('CREATE TRIGGER zz_boom BEFORE INSERT ON draws FOR EACH ROW EXECUTE FUNCTION boom()');
    try { await expect(performDraw(1)).rejects.toThrow('boom'); } finally { await pool.query('DROP TRIGGER zz_boom ON draws'); }
    expect((await pool.query('SELECT count(*)::int c FROM draws')).rows[0].c).toBe(0);
    expect((await performDraw(1)).alreadyDrawn).toBe(false);
  });
  test('ordinary members cannot see results of others and admin routes', async () => {
    const anon = await request(app).get('/api/member/my-result'); expect(anon.status).toBe(401);
    const { a } = await memberAgent('FAM-001');
    expect((await a.get('/api/admin/draws')).status).toBe(401);
    expect((await a.get('/api/member/my-result')).status).toBe(404);
  });
});

describe('administrator', () => {
  test('admin routes need authentication', async () => {
    for (const p of ['/api/admin/dashboard', '/api/admin/members', '/api/admin/draws', '/api/admin/settings', '/api/admin/export'])
      expect((await request(app).get(p)).status).toBe(401);
    expect((await request(app).post('/api/admin/members').set(H).send({ full_name: 'X', gender: 'male' })).status).toBe(401);
  });
  test('wrong password rejected', async () => {
    const r = await request(app).post('/api/admin/login').set(H).send({ username: 'boss', password: 'nope' }); expect(r.status).toBe(401);
  });
  test('admin login returns a bearer token for protected routes', async () => {
    const r = await request(app).post('/api/admin/login').set(H).send({ username: 'boss', password: 'correct-horse-battery' });
    expect(r.status).toBe(200);
    expect(r.body.access_token).toEqual(expect.any(String));
    expect((await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${r.body.access_token}`)).status).toBe(200);
  });
  test('creates members with unique server-generated IDs', async () => {
    const a = await adminAgent();
    const r1 = await a.post('/api/admin/members').set(H).send({ full_name: 'New One', gender: 'female', phone_number: '+250 788 000 000' });
    const r2 = await a.post('/api/admin/members').set(H).send({ full_name: 'New Two', gender: 'male', member_code: 'FAM-001' });
    expect(r1.status).toBe(201); expect(r1.body.member_code).toBe('FAM-007'); expect(r2.body.member_code).toBe('FAM-008');
    await expect(pool.query(`INSERT INTO family_members (member_code, full_name, gender) VALUES ('FAM-001','Dup','male')`)).rejects.toThrow(/unique/);
    expect((await a.post('/api/admin/members').set(H).send({ full_name: '', gender: 'x' })).status).toBe(400);
  });
  test('start is blocked on unequal counts until approved', async () => {
    await reset(3, 2); const a = await adminAgent();
    const blocked = await a.patch('/api/admin/settings').set(H).send({ action: 'start' });
    expect(blocked.status).toBe(409); expect(blocked.body.error.code).toBe('MISMATCH_NOT_APPROVED');
    await a.patch('/api/admin/settings').set(H).send({ action: 'approve_mismatch' });
    expect((await a.patch('/api/admin/settings').set(H).send({ action: 'start' })).body.status).toBe('open');
    expect((await a.get('/api/admin/settings')).body.counts_match).toBe(false);
  });
  test('lottery lifecycle, dashboard, results, CSV and audit log', async () => {
    const a = await adminAgent();
    await a.patch('/api/admin/settings').set(H).send({ action: 'start' });
    await a.patch('/api/admin/settings').set(H).send({ action: 'pause' });
    expect((await a.patch('/api/admin/settings').set(H).send({ action: 'resume' })).body.status).toBe('open');
    const m = await memberAgent('FAM-001'); await m.a.post('/api/lottery/draw').set(H);
    const dash = await a.get('/api/admin/dashboard'); expect(dash.body).toMatchObject({ drawn: 1, not_drawn: 5, active_male: 3, active_female: 3 });
    expect((await a.get('/api/admin/draws')).body.total).toBe(1);
    const csv = await a.get('/api/admin/export?type=results'); expect(csv.headers['content-type']).toMatch(/csv/); expect(csv.text).toContain('participant_code');
    await a.patch('/api/admin/settings').set(H).send({ action: 'close' });
    expect((await a.patch('/api/admin/settings').set(H).send({ action: 'resume' })).status).toBe(409);
    const log = await a.get('/api/admin/audit-logs'); expect(log.body.data.map((x) => x.action)).toContain('lottery_close');
  });
  test('deactivated member loses access immediately', async () => {
    const a = await adminAgent(); const m = await memberAgent('FAM-001');
    await a.patch('/api/admin/members/1/status').set(H).send({ is_active: false });
    expect((await m.a.get('/api/member/me')).status).toBe(401);
  });
});

describe('rate limiting', () => {
  test('repeated bad member logins are throttled', async () => {
    process.env.TEST_RATE_LIMIT = '1';
    try {
      let last;
      for (let i = 0; i < 17; i++) last = await request(app).post('/api/member/login').set(H).send({ member_code: 'FAM-999' });
      expect(last.status).toBe(429);
    } finally { delete process.env.TEST_RATE_LIMIT; }
  });
});
