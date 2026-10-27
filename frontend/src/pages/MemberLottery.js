import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import { api, clearAuthToken } from '../api';
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
  const [confirm, setConfirm] = useState(false); const [drawing, setDrawing] = useState(false); const [wheelSpinning, setWheelSpinning] = useState(false); const [err, setErr] = useState('');
  const [wheelRotation, setWheelRotation] = useState(0); const rotationRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const m = await api.get('/member/me'); setMe(m);
      if (m.has_drawn) setResult((await api.get('/member/my-result')).assigned_name);
    } catch (e) { if (e.status === 401) nav('/'); else setErr(e.message); }
  }, [nav]);
  useEffect(() => { load(); }, [load]);

  async function draw() {
    setConfirm(false); setErr(''); setDrawing(true); setWheelSpinning(true);
    rotationRef.current += 360 * 8 + Math.floor(Math.random() * 360);
    setWheelRotation(rotationRef.current);
    const drawRequest = api.post('/lottery/draw').then((data) => ({ data })).catch((error) => ({ error }));
    try {
      await new Promise((resolve) => setTimeout(() => { setWheelSpinning(false); resolve(); }, 5000));
      const { data, error } = await drawRequest;
      if (error) {
        if (error.status === 401) nav('/');
        else { setErr(error.message); await load(); }
      } else {
        setResult(data.assigned_name); setMe((m) => ({ ...m, has_drawn: true }));
      }
    } finally { setDrawing(false); setWheelSpinning(false); }
  }
  function logout() { clearAuthToken('member'); nav('/'); }

  if (!me && !err) return <main className="center-page"><Spinner /></main>;
  if (!me) return <main className="center-page"><div className="card narrow"><Alert>{err}</Alert><button className="btn" onClick={() => nav('/')}>Back</button></div></main>;

  return (
    <main className="center-page">
      <div className="card narrow">
        <h1>Welcome, {me.name}!</h1>
        <p className="muted">Member ID: <strong>{me.member_code}</strong> &nbsp; Round: <strong>{me.lottery_round || 1}</strong></p>

        <p>Welcome to RUTAZIGURWA Members. Are you ready to discover your assigned family member?</p>
        <section className="tombora-section" aria-busy={drawing}>
          <div className="wheel-stage" aria-label="TOMBORA roulette wheel">
            <div className="wheel-pointer" aria-hidden="true" />
            <div className="wheel-rim">
              <div className="wheel-disc" style={{ transform: `rotate(${wheelRotation}deg)` }}>
              </div>
              <div className="wheel-center"><span>RUTAZIGURWA</span><strong>TOMBORA</strong></div>
            </div>
          </div>

          {drawing && <div className="wheel-loading" role="status"><span className="wheel-loader" aria-hidden="true" /><span>{wheelSpinning ? 'The wheel is spinning...' : 'Finishing your draw...'}</span></div>}

          {!drawing && result && (
            <div className="winner-card" aria-live="polite">
              <PartyPopper size={34} color="#d4a017" />
              <p className="winner-eyebrow">YOUR TOMBORA RESULT</p>
              <h2>Congratulations, {me.name}!</h2>
              <div className="drawn-name">{result}</div>
              <p className="muted">Your result is saved. You cannot draw again this round.</p>
            </div>
          )}

          {!drawing && !result && (
            <>
              <p className={`status ${me.lottery_status}`}>{STATUS_TEXT[me.lottery_status]}</p>
              <ol className="steps"><li>Press the TOMBORA button.</li><li>Confirm that you are ready.</li><li>Your result appears on the screen.</li></ol>
              <Alert>{err}</Alert>
              <button className="btn tombora" disabled={me.lottery_status !== 'open'} onClick={() => setConfirm(true)}>TOMBORA</button>
            </>
          )}
        </section>
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
