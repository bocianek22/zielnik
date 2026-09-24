'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AddFromCatalog({ item }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true); setErr('');
    try {
      const r = await api('/api/strains', 'POST', {
        producer: item.producer, name: item.name, type: 'nieokreślony', kind: item.kind || '', form: item.form || 'susz',
        thc: item.thc ?? '', cbd: item.cbd ?? '', finalRating: '', taste: '', terpenes: [], description: '', price: '', batch: '', expires: '',
      });
      router.push(`/strains/${r.id}`);
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  return <div className="row"><button className="btn" onClick={add} disabled={busy}>{busy ? 'Dodaję…' : 'Dodaj do moich odmian'}</button>{err && <span className="field-err">{err}</span>}</div>;
}
