import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Dices, ListChecks, ScrollText, LogOut, Menu, UserRoundCog } from 'lucide-react';
import { api, clearAuthToken } from '../api';
import { Spinner } from '../components';

export default function AdminLayout() {
  const nav = useNavigate(); const [ok, setOk] = useState(false); const [open, setOpen] = useState(false);
  useEffect(() => { api.get('/admin/dashboard').then(() => setOk(true)).catch(() => nav('/admin/login')); }, [nav]);
  function logout() { clearAuthToken('admin'); nav('/admin/login'); }
  if (!ok) return <main className="center-page"><Spinner /></main>;
  const L = ({ to, icon: I, children, end }) => <NavLink to={to} end={end} onClick={() => setOpen(false)}><I size={18} />{children}</NavLink>;
  return (
    <div className="admin">
      <header className="topbar"><button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Menu"><Menu /></button><strong>RUTAZIGURWA Members Admin</strong></header>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <h2>RUTAZIGURWA Members</h2>
        <nav>
          <L to="/admin" icon={LayoutDashboard} end>Dashboard</L>
          <L to="/admin/members" icon={Users}>Members</L>
          <L to="/admin/lottery" icon={Dices}>Lottery</L>
          <L to="/admin/results" icon={ListChecks}>Results</L>
          <L to="/admin/audit" icon={ScrollText}>Audit log</L>
          <L to="/admin/account" icon={UserRoundCog}>Account</L>
        </nav>
        <button className="btn link light" onClick={logout}><LogOut size={16} /> Log out</button>
      </aside>
      <section className="content"><Outlet /></section>
    </div>
  );
}
