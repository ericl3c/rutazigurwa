import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Alert, Spinner } from '../components';

export default function Dashboard() {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.get('/admin/dashboard').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <Alert>{err}</Alert>;
  if (!d) return <Spinner />;
  const cards = [['Current round', d.round_number || 1], ['Total members', d.total_members], ['Active males', d.active_male], ['Active females', d.active_female],
    ['Have drawn', d.drawn], ['Not drawn yet', d.not_drawn], ['Completed assignments', d.completed_assignments], ['Lottery status', d.lottery_status.replace('_', ' ')]];
  return (<><h1>Dashboard</h1><div className="grid">{cards.map(([k, v]) => <div className="stat" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div></>);
}
