const crypto = require('crypto');
const pool = require('../db');
const { AppError } = require('../errors');

async function existingResult(client, participantId, roundNumber) {
  const r = await client.query(
    'SELECT d.drawn_at, a.full_name AS assigned_name FROM draws d JOIN family_members a ON a.id=d.assigned_member_id WHERE d.participant_id=$1 AND d.round_number=$2',
    [participantId, roundNumber]);
  return r.rows[0] || null;
}
async function attempt(participantId, db) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const s = (await client.query('SELECT status, matching_mode, round_number FROM lottery_settings WHERE id=1 FOR SHARE')).rows[0];
    // FOR NO KEY UPDATE does not clash with the foreign-key checks of other draws (avoids deadlocks). Serialises repeated/simultaneous requests from the same person
    const p = (await client.query('SELECT id, gender, is_active FROM family_members WHERE id=$1 FOR NO KEY UPDATE', [participantId])).rows[0];
    if (!p || !p.is_active) throw new AppError(403, 'NOT_ELIGIBLE', 'You are not eligible to participate.');
    const prior = await existingResult(client, p.id, s.round_number);
    if (prior) { await client.query('COMMIT'); return { alreadyDrawn: true, assignedName: prior.assigned_name, drawnAt: prior.drawn_at }; }
    if (s.status === 'not_started') throw new AppError(409, 'NOT_STARTED', 'The lottery has not started yet.');
    if (s.status === 'paused') throw new AppError(409, 'PAUSED', 'The lottery is paused. Please try again later.');
    if (s.status === 'closed') throw new AppError(409, 'CLOSED', 'The lottery is closed. Participation has ended.');

    const oneToOne = s.matching_mode === 'one_to_one';
    const cands = (await client.query(
      `SELECT m.id, m.full_name FROM family_members m
        WHERE m.is_active AND m.gender <> $1 AND m.id <> $2
          AND ($3::boolean = false OR NOT EXISTS (SELECT 1 FROM draws d WHERE d.assigned_member_id = m.id AND d.round_number = $4))
        ORDER BY m.id`, [p.gender, p.id, oneToOne, s.round_number])).rows;
    if (cands.length === 0) throw new AppError(409, 'NO_CANDIDATES', 'No eligible people are left to draw.');

    const pick = cands[crypto.randomInt(cands.length)];   // cryptographically secure
    const ins = await client.query(
      'INSERT INTO draws (participant_id, assigned_member_id, matching_mode, round_number) VALUES ($1,$2,$3,$4) RETURNING drawn_at',
      [p.id, pick.id, s.matching_mode, s.round_number]);
    await client.query('COMMIT');
    return { alreadyDrawn: false, assignedName: pick.full_name, drawnAt: ins.rows[0].drawn_at };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally { client.release(); }
}

// Retries when another participant grabbed the same person at the same instant (unique violation)
async function performDraw(participantId, db = pool) {
  for (let i = 0; i < 6; i++) {
    try { return await attempt(participantId, db); }
    catch (e) { if ((e.code === '23505' || e.code === '40P01') && i < 5) continue; throw e; }
  }
}
module.exports = { performDraw, existingResult };
