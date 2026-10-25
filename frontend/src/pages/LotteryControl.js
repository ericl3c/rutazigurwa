import React, { useEffect, useState, useCallback } from 'react';
import { api, fmtDate } from '../api';
import { Modal, Alert, Spinner } from '../components';

const WARN = {
  start: 'Start the lottery? Members will be able to draw immediately.',
  pause: 'Pause the lottery? Nobody can draw until you resume.',
  resume: 'Resume the lottery?',
  close: 'Close the lottery for now? Members will not be able to draw while it is closed.',
  new_round: 'Prepare a new round? After setup, press Start lottery to let every member draw again. Previous round results will remain in the results history.',
};
export default function LotteryControl() {
  const [s, setS] = useState(null); const [err, setErr] = useState(''); const [ask, setAsk] = useState(null); const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get('/admin/settings').then(setS).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  async function run(body) {
    setBusy(true); setErr('');
    try { await api.patch('/admin/settings', body); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); setAsk(null); }
  }
  if (!s) return err ? <Alert>{err}</Alert> : <Spinner />;
  const pre = s.status === 'not_started'; const oneToOne = s.matching_mode === 'one_to_one';
  const hasBothGenders = s.active_male > 0 && s.active_female > 0;
  const mismatchNeedsApproval = oneToOne && !s.counts_match;
  const canStart = hasBothGenders && (!mismatchNeedsApproval || s.mismatch_approved);
  return (
    <>
      <h1>Lottery control</h1>
      <div className="card">
        <p>Status: <span className={`status ${s.status || 'not_started'}`}>{(s.status || 'not_started').replace('_', ' ')}</span></p>
        <p>Round: <strong>{s.round_number || 1}</strong></p>
        <p>Active males: <strong>{s.active_male}</strong> &nbsp; Active females: <strong>{s.active_female}</strong></p>
        {pre && !hasBothGenders && <div className="alert warn">Add at least one active male and one active female member before starting the lottery.</div>}
        {s.started_at && <p className="muted">Started: {fmtDate(s.started_at)}</p>}
        {s.closed_at && <p className="muted">Closed: {fmtDate(s.closed_at)}</p>}
        <Alert>{err}</Alert>

        {pre && (<>
          <label>Matching mode</label>
          <select value={s.matching_mode} onChange={(e) => run({ action: 'set_mode', matching_mode: e.target.value })} disabled={busy}>
            <option value="one_to_one">One-to-one (each person can be drawn only once)</option>
            <option value="open">Open (the same person can be drawn by several people)</option>
          </select>
          {oneToOne && !s.counts_match && (
            <div className="alert warn">
              There are {s.active_male} active males and {s.active_female} active females. With one-to-one matching, not everyone can receive a unique opposite-gender match;
              some members will see "no eligible people left". Existing results are never changed automatically.
              {s.mismatch_approved ? <p><strong>You approved this policy.</strong></p> : <p><button className="btn" disabled={busy} onClick={() => run({ action: 'approve_mismatch' })}>I have reviewed the numbers and approve</button></p>}
            </div>)}
        </>)}

        <div className="row gap">
          {pre && <button className="btn primary" disabled={busy || !canStart} onClick={() => setAsk('start')}>Start lottery</button>}
          {s.status === 'open' && <button className="btn" disabled={busy} onClick={() => setAsk('pause')}>Pause</button>}
          {s.status === 'paused' && <button className="btn primary" disabled={busy} onClick={() => setAsk('resume')}>Resume</button>}
          {s.status === 'closed' && <button className="btn primary" disabled={busy} onClick={() => setAsk('new_round')}>Prepare new round</button>}
          {(s.status === 'open' || s.status === 'paused') && <button className="btn danger" disabled={busy} onClick={() => setAsk('close')}>Close lottery</button>}
        </div>
      </div>
      {ask && (
        <Modal title="Please confirm" onClose={() => setAsk(null)}
          actions={<><button className="btn" onClick={() => setAsk(null)}>Cancel</button><button className={`btn ${ask === 'close' ? 'danger' : 'primary'}`} disabled={busy} onClick={() => run({ action: ask })}>Yes, {ask}</button></>}>
          <p>{WARN[ask]}</p>
        </Modal>)}
    </>
  );
}
