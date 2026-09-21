import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql, ensureDb } from '@/lib/db';
import { listStrains } from '@/lib/strains';
import { formLabel } from '@/lib/forms';
import Header from '../../components/Header';
import CharacteristicCard from '../../components/CharacteristicCard';
import AddFromCatalog from './AddFromCatalog';

export const dynamic = 'force-dynamic';

export default async function KatalogItem({ params }) {
  const me = await getUser();
  if (!me) redirect('/login');
  if (me.must_change_password) redirect('/change-password');
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  await ensureDb();
  const [item] = await sql()`SELECT id, producer, name, thc::float8 AS thc, cbd::float8 AS cbd, kind, form, availability, active,
      to_char(last_seen AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS last_seen FROM market_catalog WHERE id = ${id}`;
  if (!item) notFound();
  const strains = await listStrains(me.id);
  const match = strains.find((s) => s.producer.toLowerCase() === item.producer.toLowerCase() && s.name.toLowerCase() === item.name.toLowerCase());

  return (
    <>
      <Header user={me} />
      <main className="page stack">
        <Link href="/katalog" className="back">← Katalog</Link>
        <section className={`card strain detail k-${item.kind || 'none'}`}>
          <h1>{item.name}</h1>
          <p className="strain-meta">
            <span>{item.producer}</span>
            {item.kind && <span className={`badge kind-${item.kind}`}>{item.kind}</span>}
            {item.form !== 'susz' && <span className="badge form">{formLabel(item.form)}</span>}
            {item.thc != null && <span className="pill">THC {item.thc}%</span>}
            {item.cbd != null && <span className="pill">CBD {item.cbd}%</span>}
            {item.availability && <span className="badge">{item.availability}</span>}
            {!item.active && <span className="badge low">Brak w źródle</span>}
          </p>
          <p className="muted small">Ostatnio widziana w katalogu: {item.last_seen}. Dostępność zmienia się często i nie jest gwarancją.</p>
          {match ? <Link className="btn" href={`/strains/${match.id}`}>Otwórz pełną kartę odmiany</Link> : <AddFromCatalog item={item} />}
        </section>
        {match ? <CharacteristicCard strain={match} /> : (
          <section className="card"><h2>Karta charakterystyki</h2>
            <p className="muted">Ta odmiana nie ma jeszcze karty w Zielniku. Dodaj ją do swoich odmian, a potem uzupełnij opis, terpeny i dane przyciskiem „Uzupełnij z internetu” w edycji odmiany. Informacje mają charakter poglądowy, ustal je z lekarzem.</p></section>
        )}
      </main>
    </>
  );
}
