import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import { api } from '../api';
import { Modal, Alert, Spinner } from '../components';

const STATUS_TEXT = {
  not_started: 'The lottery has not started yet. Please come back later.',
  open: 'The lottery is open. You can draw now!',
  paused: 'The lottery is paused for now. Please try again later.',
  closed: 'The lottery is closed. Participation has ended.',
};

export default function MemberLottery() {
  const nav = useNavigate();
  const [me, setMe] = useState(null); const [result, setResult] = useState(null);
  const [confirm, setConfirm] = useState(false); const [drawing, setDrawing] = useState(false); const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const m = await api.get('/member/me'); setMe(m);
      if (m.has_drawn) setResult((await api.get('/member/my-result')).assigned_name);
    } catch (e) { if (e.status === 401) nav('/'); else setErr(e.message); }
  }, [nav]);
  useEffect(() => { load(); }, [load]);

  async function draw() {
    setConfirm(false); setErr(''); setDrawing(true);
    try {
      const [r] = await Promise.all([api.post('/lottery/draw'), new Promise((ok) => setTimeout(ok, 1800))]);
      setResult(r.assigned_name); setMe((m) => ({ ...m, has_drawn: true }));
    } catch (e) { if (e.status === 401) nav('/'); else { setErr(e.message); load(); } } finally { setDrawing(false); }
  }
  async function logout() { try { await api.post('/member/logout'); } catch {} nav('/'); }

  if (!me && !err) return <main className="center-page"><Spinner /></main>;
  if (!me) return <main className="center-page"><div className="card narrow"><Alert>{err}</Alert><button className="btn" onClick={() => nav('/')}>Back</button></div></main>;

  return (
    <main className="center-page">
      <div className="card narrow">
        <h1>Welcome, {me.name}!</h1>
        <p className="muted">Member ID: <strong>{me.member_code}</strong> &nbsp; Round: <strong>{me.lottery_round || 1}</strong></p>

        {drawing && <div className="drawing"><div className="spinner big" /><p>Drawing your family member...</p></div>}

        {!drawing && result && (
          <div className="result" aria-live="polite">
            <PartyPopper size={44} color="#d4a017" />
            <h2>Congratulations, {me.name}!</h2>
            <p>You have drawn</p>
            <div className="drawn-name">{result}</div>
            <p className="muted">Your lottery has been completed successfully. You cannot draw again.</p>
          </div>
        )}

        {!drawing && !result && (
          <>
            <p>Welcome to RUTAZIGURWA Members. Are you ready to discover your assigned family member?</p>
            <p className={`status ${me.lottery_status}`}>{STATUS_TEXT[me.lottery_status]}</p>
            <ol className="steps"><li>Press the TOMBORA button.</li><li>Confirm that you are ready.</li><li>Your result appears on the screen.</li></ol>
            <Alert>{err}</Alert>
            <button className="btn tombora" disabled={me.lottery_status !== 'open'} onClick={() => setConfirm(true)}>TOMBORA</button>
          </>
        )}
        <button className="btn link" onClick={logout}>Log out</button>
      </div>
      {confirm && (
        <Modal title="Are you ready to draw your family member?" onClose={() => setConfirm(false)}
          actions={<><button className="btn" onClick={() => setConfirm(false)}>Cancel</button><button className="btn primary" onClick={draw}>Yes, TOMBORA!</button></>}>
          <p>You can only draw once. The result cannot be changed.</p>
        </Modal>
      )}
    </main>
  );
}
