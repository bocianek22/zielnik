'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import ReportButton from '../../components/ReportButton';

export default function ProfileActions({ userId, blocked }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  async function toggle() {
    if (!blocked && !confirm('Zablokować tego użytkownika? Przestaniecie się widzieć, a znajomość zostanie usunięta.')) return;
    try { await api('/api/blocks', 'POST', { action: blocked ? 'unblock' : 'block', userId }); router.refresh(); } catch (e) { setErr(e.message); }
  }
  return (
    <div className="row">
      <button className="btn ghost small" onClick={toggle}>{blocked ? 'Odblokuj' : 'Zablokuj'}</button>
      <ReportButton type="user" userId={userId} />
      {err && <span className="field-err">{err}</span>}
    </div>
  );
}
