'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { csvToObjects } from '@/lib/csv';
import { FORMS, formLabel } from '@/lib/forms';
import Icon from '../components/Icon';

const dec = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 1 });
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');
const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

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

  const fileBtn = <label className="btn ghost file-btn">Wczytaj CSV<input type="file" accept=".csv,text/csv" hidden onChange={upload} /></label>;

  return (
    <div>
      <p className="muted cat-note">Katalog ma charakter informacyjny: dostępność w aptekach zmienia się często i nie jest gwarancją. Sprawdź ją u lekarza lub w aptece. To nie jest reklama ani oferta sprzedaży.</p>
      <div className="cat-tools">
        <div className="search-wrap">
          <Icon name="search" size={20} />
          <input className="input search" type="search" placeholder="Szukaj: odmiana, producent…" aria-label="Szukaj w katalogu" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="seg" role="group" aria-label="Postać">
          {[['', 'Wszystko'], ...FORMS].map(([k, label]) => (
            <button key={k || 'all'} type="button" aria-pressed={formFilter === k} className={formFilter === k ? 'on' : ''} onClick={() => setFormFilter(k)}>{label}</button>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} /> Tylko aktualne</label>
      </div>
      {msg && <div className="alert note" role="status">{msg}</div>}

      {items.length === 0 ? (
        <div className="card empty">
          <Icon name="book" size={32} />
          <h2>Katalog jest jeszcze pusty</h2>
          <p>{isAdmin ? 'Wczytaj plik CSV albo ustaw automatyczne źródło (opis poniżej).' : 'Poproś admina o wczytanie listy.'}</p>
          {isAdmin && fileBtn}
        </div>
      ) : shown.length === 0 ? (
        <div className="card empty">
          <Icon name="search" size={32} />
          <h2>Brak pasujących pozycji</h2>
          <p>Zmień frazę, postać albo odznacz „Tylko aktualne”.</p>
        </div>
      ) : (
        <>
          <p className="cat-count" aria-live="polite">{shown.length} {shown.length === 1 ? 'pozycja' : shown.length % 10 >= 2 && shown.length % 10 <= 4 && (shown.length % 100 < 12 || shown.length % 100 > 14) ? 'pozycje' : 'pozycji'}</p>
          <ul className="list">
            {shown.map((i) => (
              <li key={i.id} className={`list-row cat-row${i.active ? '' : ' inactive'}`}>
                <Link href={`/katalog/${i.id}`} className="cat-link">
                  <span className="cat-name dn">{i.name}</span>
                  <span className="strain-meta">
                    <span className="dn">{i.producer}</span>
                    {i.kind && <span className={`kind kind-${i.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(i.kind)}</span>}
                    {i.form && i.form !== 'susz' && <span>{formLabel(i.form)}</span>}
                    {i.thc != null && <span className="num">THC {dec(i.thc)}%</span>}
                    {i.cbd != null && <span className="num">CBD {dec(i.cbd)}%</span>}
                  </span>
                  <span className="lr-sub">{[i.availability && cap(i.availability), !i.active && 'Brak w źródle', `Widziana ${day(i.last_seen)}`].filter(Boolean).join(' · ')}</span>
                </Link>
                <span className="cat-act">
                  {mine.has(key(i)) ? <span className="cat-have">Masz na liście</span>
                    : <button type="button" className="btn ghost small" onClick={() => add(i)} aria-label={`Dodaj do moich: ${i.name}`}><Icon name="plus" size={18} />Dodaj</button>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {isAdmin && (
        <section className="card cat-admin">
          <h2>Aktualizacja katalogu (admin)</h2>
          <p className="muted">Plik CSV z kolumnami: Producent, Odmiana, THC, CBD, Rodzaj, Postać (susz, olej lub pen), Dostępność (ostatnie trzy opcjonalne). Pozycje z poprzedniego ręcznego importu, których w pliku zabraknie, zostaną oznaczone jako „Brak w źródle”. Automatyczna aktualizacja (co poniedziałek) działa, gdy w Vercel ustawisz zmienne <code>CATALOG_FEED_URL</code> (adres pliku CSV lub JSON w tym samym formacie) i <code>CRON_SECRET</code> (dowolny długi losowy ciąg).</p>
          {fileBtn}
        </section>
      )}
    </div>
  );
}
