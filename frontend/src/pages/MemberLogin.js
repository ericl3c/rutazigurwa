import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { api } from '../api';
import { Alert } from '../components';

export default function MemberLogin() {
  const [code, setCode] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.post('/member/login', { member_code: code.trim() }); nav('/lottery'); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }
  return (
    <main className="center-page">
      <form className="card narrow" onSubmit={submit}>
        <div className="logo"><Gift size={36} /></div>
        <h1>RUTAZIGURWA Members</h1>
        <p className="muted">Welcome! Type the Member ID you were given to continue.</p>
        <label htmlFor="mid">Member ID</label>
        <input id="mid" value={code} onChange={(e) => setCode(e.target.value)} placeholder="RUT-001" autoComplete="off" autoCapitalize="characters" maxLength={20} required />
        <Alert>{err}</Alert>
        <button className="btn primary block" disabled={busy || !code.trim()}>{busy ? 'Checking...' : 'Continue'}</button>
      </form>
    </main>
  );
}
