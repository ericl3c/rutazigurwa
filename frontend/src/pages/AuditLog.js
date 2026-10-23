import React, { useEffect, useState } from 'react';
import { api, fmtDate } from '../api';
import { Alert, Spinner } from '../components';

export default function AuditLog() {
  const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.get('/admin/audit-logs?limit=100').then((r) => setRows(r.data)).catch((e) => setErr(e.message)); }, []);
  if (err) return <Alert>{err}</Alert>;
  if (!rows) return <Spinner />;
  return (<><h1>Audit log</h1><p className="muted">Latest 100 administrator actions.</p>
    <div className="table-wrap"><table><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Item</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{fmtDate(r.created_at)}</td><td>{r.admin || '-'}</td><td>{r.action}</td><td>{r.entity_type}{r.entity_id ? ' #' + r.entity_id : ''}</td></tr>)}</tbody></table></div></>);
}
