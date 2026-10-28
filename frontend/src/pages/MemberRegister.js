
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift } from 'lucide-react';
import { api } from '../api';
import { Alert } from '../components';

export default function MemberRegister() {
  const [form, setForm] = useState({
    full_name: '',
    gender: 'male',
    phone_number: '',
  });

  const [created, setCreated] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);

    try {
      const result = await api.post('/member/register', form);
      setCreated(result);
    } catch (error) {
      setErr(error.message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function handlePhoneChange(e) {
    // Allow digits only (0-9).
    const digitsOnly = e.target.value.replace(/[^0-9]/g, '');

    setForm((prevForm) => ({
      ...prevForm,
      phone_number: digitsOnly,
    }));
  }

  return (
    <main className="center-page">
      <div className="card narrow">
        <div className="logo">
          <Gift size={36} />
        </div>

        {created ? (
          <>
            <h1>Registration complete</h1>

            <p className="muted">
              Welcome, {created.full_name}! Keep your Member ID safe.
              You will need it to sign in.
            </p>

            <div className="big-code">
              {created.member_code}
            </div>

            <Link className="btn primary block" to="/">
              Go to member sign in
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <h1>Join RUTAZIGURWA Members</h1>

            <p className="muted">
              Enter your details to create a member account.
            </p>

            <label htmlFor="full-name">Full name</label>
            <input
              id="full-name"
              type="text"
              value={form.full_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  full_name: e.target.value,
                })
              }
              maxLength={100}
              autoComplete="name"
              required
            />

            <label htmlFor="gender">Gender</label>
            <select
              id="gender"
              value={form.gender}
              onChange={(e) =>
                setForm({
                  ...form,
                  gender: e.target.value,
                })
              }
              required
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>

            <label htmlFor="phone-number">
              Phone number (optional)
            </label>
            <input
              id="phone-number"
              type="tel"
              value={form.phone_number}
              onChange={handlePhoneChange}
              inputMode="numeric"
              autoComplete="tel"
              maxLength={15}
              placeholder="e.g. 0781234567"
            />

            <Alert>{err}</Alert>

            <button
              className="btn primary block"
              type="submit"
              disabled={busy}
            >
              {busy
                ? 'Creating account...'
                : 'Create member account'}
            </button>

            <p className="muted">
              Already registered? <Link to="/">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
