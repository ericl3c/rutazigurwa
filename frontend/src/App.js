import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MemberLogin from './pages/MemberLogin';
import MemberLottery from './pages/MemberLottery';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import LotteryControl from './pages/LotteryControl';
import Results from './pages/Results';
import AuditLog from './pages/AuditLog';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MemberLogin />} />
      <Route path="/lottery" element={<MemberLottery />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="lottery" element={<LotteryControl />} />
        <Route path="results" element={<Results />} />
        <Route path="audit" element={<AuditLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
