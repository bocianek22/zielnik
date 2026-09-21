'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { csvToObjects } from '@/lib/csv';
import { FORMS, formLabel } from '@/lib/forms';

export default function CatalogBoard({ items, owned, isAdmin }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [formFilter, setFormFilter] = useState('');
  const [mine, setMine] = useState(new Set(owned));
  const [msg, setMsg] = useState('');
  const key = (i) => `${i.producer}|${i.name}`.toLowerCase();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (!onlyActive || i.active) && (!formFilter || (i.form || 'susz') === formFilter) && (!q || `${i.name} ${i.producer} ${i.kind || ''}`.toLowerCase().includes(q)));
  }, [items, query, onlyActive, formFilter]);

  async function add(i) {
    setMsg('');
    try {
      await api('/api/strains', 'POST', {
        producer: i.producer, name: i.name, type: 'nieokreślony', kind: i.kind || '', form: i.form || 'susz', thc: i.thc ?? '', cbd: i.cbd ?? '',
        finalRating: '', taste: '', terpenes: [], description: '', price: '', batch: '', expires: '',
      });
      setMine((s) => new Set(s).add(key(i)));
      setMsg(`Dodano do Twoich odmian: ${i.name}`);
    } catch (e) { setMsg(e.message); }
  }

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await api('/api/catalog', 'POST', { rows: csvToObjects(await file.text()) });
      setMsg(`Wczytano: ${r.upserted}, nieaktywne: ${r.deactivated}, pominięte: ${r.skippedCount}.`);
      router.refresh();
    } catch (err) { setMsg(err.message); }
  }

  return (
    <div className="stack">
      <div className="alert note">Katalog ma charakter informacyjny: dostępność w aptekach zmienia się często i nie jest gwarancją. Sprawdź ją u lekarza lub w aptece. To nie jest reklama ani oferta sprzedaży.</div>
      <div className="toolbar">
        <input className="input search" type="search" placeholder="Szukaj: odmiana, producent…" aria-label="Szukaj" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="seg" role="tablist" aria-label="Postać">
          {[['', 'Wszystko'], ...FORMS].map(([k, label]) => (
            <button key={k || 'all'} role="tab" aria-selected={formFilter === k} className={formFilter === k ? 'on' : ''} onClick={() => setFormFilter(k)}>{label}</button>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} /> Tylko aktualne</label>
      </div>
      {msg && <div className="alert note" role="status">{msg}</div>}

      {items.length === 0 && <div className="card empty"><p className="muted">Katalog jest jeszcze pusty. {isAdmin ? 'Wczytaj plik CSV poniżej albo ustaw automatyczne źródło.' : 'Poproś admina o wczytanie listy.'}</p></div>}
      {shown.map((i) => (
        <article key={i.id} className={`card cat-item k-${i.kind || 'none'} ${i.active ? '' : 'inactive'}`}>
          <div>
            <h3><Link href={`/katalog/${i.id}`}>{i.name}</Link></h3>
            <p className="strain-meta">
              <span>{i.producer}</span>
              {i.kind && <span className={`badge kind-${i.kind}`}>{i.kind}</span>}
              {i.form && i.form !== 'susz' && <span className="badge form">{formLabel(i.form)}</span>}
              {i.thc != null && <span className="pill">THC {i.thc}%</span>}
              {i.cbd != null && <span className="pill">CBD {i.cbd}%</span>}
              {i.availability && <span className="badge">{i.availability}</span>}
              {!i.active && <span className="badge low">Brak w źródle</span>}
            </p>
            <p className="muted small">Ostatnio widziana: {i.last_seen}</p>
          </div>
          {mine.has(key(i)) ? <span className="badge">Masz na liście</span> : <button className="btn small" onClick={() => add(i)}>Dodaj do moich</button>}
        </article>
      ))}

      {isAdmin && (
        <section className="card">
          <h2>Aktualizacja katalogu (admin)</h2>
          <p className="muted">Plik CSV z kolumnami: Producent, Odmiana, THC, CBD, Rodzaj, Postać (susz, olej lub pen), Dostępność (ostatnie trzy opcjonalne). Pozycje z poprzedniego ręcznego importu, których w pliku zabraknie, zostaną oznaczone jako „Brak w źródle”. Automatyczna aktualizacja (co poniedziałek) działa, gdy w Vercel ustawisz zmienne <code>CATALOG_FEED_URL</code> (adres pliku CSV lub JSON w tym samym formacie) i <code>CRON_SECRET</code> (dowolny długi losowy ciąg).</p>
          <label className="btn ghost file-btn">Wczytaj CSV<input type="file" accept=".csv,text/csv" hidden onChange={upload} /></label>
        </section>
      )}
    </div>
  );
}
