import React, { useEffect, useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import { api, fmtDate } from '../api';
import { Alert, Spinner } from '../components';
import { fetchAllPages } from '../utils/fetchAllPages';
import { downloadReportPdf } from '../utils/reportPdf';

function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

export default function Results() {
  const [rows, setRows] = useState(null); const [page, setPage] = useState(1); const [q, setQ] = useState(''); const [round, setRound] = useState('all'); const [err, setErr] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const limit = 20;
  const load = useCallback(async () => {
    try { setRows(await fetchAllPages('/admin/draws', q ? { q } : {})); setErr(''); } catch (e) { setErr(e.message); }
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const exp = async (type) => { try { downloadBlob(await api.blob('/admin/export?type=' + type), type + '.csv'); } catch (e) { setErr(e.message); } };
  function exportResultsCsv() {
    const columns = ['round_number', 'participant_code', 'participant_name', 'participant_phone', 'participant_gender', 'assigned_code', 'assigned_name', 'assigned_phone', 'drawn_at'];
    const csv = [columns.join(','), ...visibleRows.map((row) => columns.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
    downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `lottery-results${round === 'all' ? '' : `-round-${round}`}.csv`);
  }
  async function downloadPdf() {
    setExportingPdf(true); setErr('');
    try {
      const data = visibleRows;
      downloadReportPdf({
        title: 'Lottery results',
        subtitle: `${data.length} ${data.length === 1 ? 'result' : 'results'} - Generated ${new Date().toLocaleString()}`,
        filename: 'lottery-results.pdf',
        columns: [
          { header: 'ROUND', dataKey: 'round_number' },
          { header: 'PARTICIPANT ID', dataKey: 'participant_code' },
          { header: 'PARTICIPANT', dataKey: 'participant_name' },
          { header: 'PARTICIPANT PHONE', dataKey: 'participant_phone' },
          { header: 'GENDER', dataKey: 'participant_gender' },
          { header: 'ASSIGNED ID', dataKey: 'assigned_code' },
          { header: 'ASSIGNED MEMBER', dataKey: 'assigned_name' },
          { header: 'ASSIGNED PHONE', dataKey: 'assigned_phone' },
          { header: 'DRAWN AT', dataKey: 'drawn_at' },
        ],
        rows: data.map((r) => ({ ...r, drawn_at: r.drawn_at ? new Date(r.drawn_at).toLocaleString() : '-' })),
      });
    } catch (e) { setErr(e.message); } finally { setExportingPdf(false); }
  }
  const rounds = [...new Set((rows || []).map((r) => Number(r.round_number)))].sort((a, b) => b - a);
  const filteredRows = (rows || []).filter((r) => round === 'all' || Number(r.round_number) === Number(round));
  const total = filteredRows.length;
  const pageRows = filteredRows.slice((page - 1) * limit, page * limit);
  const visibleRows = filteredRows;
  return (
    <>
      <div className="row between"><h1>Results</h1>
        <div className="row gap"><button className="btn primary" onClick={downloadPdf} disabled={exportingPdf}><Download size={16} /> {exportingPdf ? 'Preparing PDF...' : 'Results PDF'}</button><button className="btn" onClick={exportResultsCsv}>Results CSV</button><button className="btn" onClick={() => exp('members')}><Download size={16} /> Members CSV</button></div></div>
      <div className="filters"><input placeholder="Search by name or ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select aria-label="Filter results by round" value={round} onChange={(e) => { setRound(e.target.value); setPage(1); }}>
          <option value="all">All rounds</option>{rounds.map((n) => <option key={n} value={n}>Round {n}</option>)}
        </select>
      </div>
      <Alert>{err}</Alert>
      {!rows ? <Spinner /> : (
      <div className="table-wrap"><table>
          <thead><tr><th>Round</th><th>Participant ID</th><th>Participant</th><th>Participant phone</th><th>Gender</th><th>Assigned ID</th><th>Assigned member</th><th>Assigned phone</th><th>Drawn at</th></tr></thead>
          <tbody>{pageRows.map((r) => <tr key={r.id}><td>{r.round_number}</td><td><code>{r.participant_code}</code></td><td>{r.participant_name}</td><td>{r.participant_phone || '-'}</td><td>{r.participant_gender}</td><td><code>{r.assigned_code}</code></td><td>{r.assigned_name}</td><td>{r.assigned_phone || '-'}</td><td>{fmtDate(r.drawn_at)}</td></tr>)}
            {pageRows.length === 0 && <tr><td colSpan="9" className="muted">No draws found for this round.</td></tr>}</tbody></table></div>)}
      <div className="row between pager"><span className="muted">{total} results</span>
        <div><button className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button> <span>Page {page}</span> <button className="btn" disabled={page * limit >= total} onClick={() => setPage(page + 1)}>Next</button></div></div>
    </>
  );
}
