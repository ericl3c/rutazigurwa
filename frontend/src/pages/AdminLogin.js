import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { Alert } from '../components';

export default function AdminLogin() {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.post('/admin/login', { username: u, password: p }); nav('/admin'); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }
  return (
    <main className="center-page">
      <form className="card narrow" onSubmit={submit}>
        <div className="logo"><ShieldCheck size={36} /></div>
        <h1>Administrator Login</h1>
        <label htmlFor="u">Username</label>
        <input id="u" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required />
        <label htmlFor="p">Password</label>
        <input id="p" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required />
        <Alert>{err}</Alert>
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in...' : 'Login'}</button>
      </form>
    </main>
  );
}
