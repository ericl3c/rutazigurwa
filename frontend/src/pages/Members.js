import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Copy, Pencil, Power, Download } from 'lucide-react';
import { api, fmtDate } from '../api';
import { Modal, Alert, Spinner } from '../components';
import { fetchAllPages } from '../utils/fetchAllPages';
import { downloadReportPdf } from '../utils/reportPdf';

const empty = { full_name: '', gender: 'male', phone_number: '' };
export default function Members() {
  const [rows, setRows] = useState(null); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const [q, setQ] = useState(''); const [gender, setGender] = useState(''); const [active, setActive] = useState(''); const [drawn, setDrawn] = useState('');
  const [form, setForm] = useState(null); const [created, setCreated] = useState(null); const [err, setErr] = useState(''); const [fe, setFe] = useState(''); const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const limit = 15;

  const load = useCallback(async () => {
    const p = new URLSearchParams({ page, limit }); if (q) p.set('q', q); if (gender) p.set('gender', gender); if (active) p.set('active', active); if (drawn) p.set('drawn', drawn);
    try { const r = await api.get('/admin/members?' + p); setRows(r.data); setTotal(r.total); setErr(''); } catch (e) { setErr(e.message); }
  }, [page, q, gender, active, drawn]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function save() {
    setFe('');
    try {
      if (form.id) { await api.patch('/admin/members/' + form.id, { full_name: form.full_name, gender: form.gender, phone_number: form.phone_number }); setForm(null); }
      else { const m = await api.post('/admin/members', form); setForm(null); setCreated(m); }
      load();
    } catch (e) { setFe(e.message); }
  }
  async function toggle(m) {
    if (m.is_active && !window.confirm(`Deactivate ${m.full_name}? They will not be able to log in or be drawn.`)) return;
    try { await api.patch(`/admin/members/${m.id}/status`, { is_active: !m.is_active }); load(); } catch (e) { setErr(e.message); }
  }
  async function downloadPdf() {
    setExporting(true); setErr('');
    try {
      const data = await fetchAllPages('/admin/members', { ...(q ? { q } : {}), ...(gender ? { gender } : {}), ...(active ? { active } : {}), ...(drawn ? { drawn } : {}) });
      downloadReportPdf({
        title: 'Family members',
        subtitle: `${data.length} ${data.length === 1 ? 'member' : 'members'} - Generated ${new Date().toLocaleString()}`,
        filename: 'family-members.pdf',
        columns: [
          { header: 'MEMBER ID', dataKey: 'member_code' },
          { header: 'FULL NAME', dataKey: 'full_name' },
          { header: 'GENDER', dataKey: 'gender' },
          { header: 'PHONE', dataKey: 'phone_number' },
          { header: 'STATUS', dataKey: 'status' },
          { header: 'DRAWN', dataKey: 'drawn' },
          { header: 'ADDED', dataKey: 'created' },
        ],
        rows: data.map((m) => ({
          ...m,
          phone_number: m.phone_number || '-',
          status: m.is_active ? 'Active' : 'Inactive',
          drawn: m.has_drawn ? 'Yes' : 'No',
          created: m.created_at ? new Date(m.created_at).toLocaleDateString() : '-',
        })),
      });
    } catch (e) { setErr(e.message); } finally { setExporting(false); }
  }
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };

  return (
    <>
      <div className="row between"><h1>Family members</h1><div className="row gap"><button className="btn" onClick={downloadPdf} disabled={exporting}><Download size={16} /> {exporting ? 'Preparing PDF...' : 'Download PDF'}</button><button className="btn primary" onClick={() => { setFe(''); setForm({ ...empty }); }}><Plus size={16} /> Add member</button></div></div>
      <div className="filters">
        <input placeholder="Search name or ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }}><option value="">All genders</option><option value="male">Male</option><option value="female">Female</option></select>
        <select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}><option value="">Active + inactive</option><option value="true">Active</option><option value="false">Inactive</option></select>
        <select value={drawn} onChange={(e) => { setDrawn(e.target.value); setPage(1); }}><option value="">Drawn or not</option><option value="true">Drawn</option><option value="false">Not drawn</option></select>
      </div>
      <Alert>{err}</Alert>
      {!rows ? <Spinner /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>ID</th><th>Name</th><th>Gender</th><th>Phone</th><th>Status</th><th>Drawn</th><th>Created</th><th></th></tr></thead>
          <tbody>{rows.map((m) => (
            <tr key={m.id}>
              <td><code>{m.member_code}</code></td><td>{m.full_name}</td><td>{m.gender}</td><td>{m.phone_number || '-'}</td>
              <td><span className={`pill ${m.is_active ? 'ok' : 'off'}`}>{m.is_active ? 'Active' : 'Inactive'}</span></td>
              <td>{m.has_drawn ? 'Yes' : 'No'}</td><td>{fmtDate(m.created_at)}</td>
              <td className="nowrap">
                <button className="icon-btn" title="Copy ID" onClick={() => copy(m.member_code)}><Copy size={16} /></button>
                <button className="icon-btn" title="Edit" onClick={() => { setFe(''); setForm({ ...m, phone_number: m.phone_number || '' }); }}><Pencil size={16} /></button>
                <button className="icon-btn" title={m.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggle(m)}><Power size={16} /></button>
              </td>
            </tr>))}
            {rows.length === 0 && <tr><td colSpan="8" className="muted">No members found.</td></tr>}
          </tbody></table></div>
      )}
      <div className="row between pager"><span className="muted">{total} members</span>
        <div><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button> <span>Page {page}</span> <button className="btn" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>Next</button></div></div>

      {form && (
        <Modal title={form.id ? 'Edit member' : 'Add member'} onClose={() => setForm(null)}
          actions={<><button className="btn" onClick={() => setForm(null)}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
          <label>Full name</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} />
          <label>Gender</label>
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="male">Male</option><option value="female">Female</option></select>
          {form.has_drawn && <p className="muted">Changing gender will also change how this member is shown in previous results.</p>}
          <label>Phone number (optional)</label><input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} inputMode="tel" />
          <Alert>{fe}</Alert>
        </Modal>
      )}
      {created && (
        <Modal title="Member added" onClose={() => setCreated(null)} actions={<button className="btn primary" onClick={() => setCreated(null)}>Done</button>}>
          <p><strong>{created.full_name}</strong> was added. Give them this Member ID privately:</p>
          <div className="big-code">{created.member_code}</div>
          <button className="btn" onClick={() => copy(created.member_code)}><Copy size={16} /> {copied ? 'Copied!' : 'Copy ID'}</button>
        </Modal>
      )}
    </>
  );
}
