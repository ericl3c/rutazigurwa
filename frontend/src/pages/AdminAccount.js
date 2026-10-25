import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Alert } from '../components';

export default function AdminAccount() {
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/admin/account').then((account) => setUsername(account.username)).catch((e) => setError(e.message)); }, []);

  async function save(e) {
    e.preventDefault(); setError(''); setMessage('');
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    setBusy(true);
    try {
      const account = await api.patch('/admin/account', { username, current_password: currentPassword, new_password: newPassword });
      setUsername(account.username); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setMessage('Administrator login details updated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <>
    <h1>Administrator account</h1>
    <p className="muted">Change the username and password used to sign in to the admin area.</p>
    <form className="card account-form" onSubmit={save}>
      <label htmlFor="admin-username">Username</label>
      <input id="admin-username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={50} autoComplete="username" required />
      <label htmlFor="admin-current-password">Current password</label>
      <input id="admin-current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
      <label htmlFor="admin-new-password">New password</label>
      <input id="admin-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} maxLength={200} autoComplete="new-password" required />
      <label htmlFor="admin-confirm-password">Confirm new password</label>
      <input id="admin-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} maxLength={200} autoComplete="new-password" required />
      <Alert>{error}</Alert>
      {message && <p className="success-message" role="status">{message}</p>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Update login details'}</button>
    </form>
  </>;
}
