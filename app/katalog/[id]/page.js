import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isNativeApp } from '@/lib/client';
import { intId } from '@/lib/ids';
import { sql, ensureDb } from '@/lib/db';
import { listStrains, strainIndex } from '@/lib/strains';
import { formLabel } from '@/lib/forms';
import Header from '../../components/Header';
import CharacteristicCard from '../../components/CharacteristicCard';
import Icon from '../../components/Icon';
import AddFromCatalog from './AddFromCatalog';
import PharmacyLink from '../../components/PharmacyLink';
import { norm } from '@/lib/pharmacy-ocr';
import reference from '@/data/odmiany.json';
import { formatDay } from '@/lib/date';

const dec = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 1 });
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');

export const dynamic = 'force-dynamic';

export default async function KatalogItem({ params }) {
  const me = await getUser();
  if (!me) redirect('/login');
  if (me.must_change_password) redirect('/change-password');
  const id = intId((await params).id);
  if (!id) notFound();
  await ensureDb();
  const [item] = await sql()`SELECT id, producer, name, thc::float8 AS thc, cbd::float8 AS cbd, kind, form, availability, active,
      to_char(last_seen AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS last_seen FROM market_catalog WHERE id = ${id}`;
  if (!item) notFound();
  // nazwa rejestrowa z katalogu Zielnika (producent i nazwa lub alias), do wyszukiwania w aptekach
  const ref = reference.strains.filter((e) => [e.producer, ...(e.producerAliases || [])].some((x) => norm(x) === norm(item.producer))
    && [e.name, ...(e.aliases || [])].some((x) => norm(x) === norm(item.name)));
  const found = (await strainIndex()).find((s) => s.producer.toLowerCase() === item.producer.toLowerCase() && s.name.toLowerCase() === item.name.toLowerCase());
  const [match] = found ? await listStrains(me.id, { ids: [found.id] }) : [];

  return (
    <>
      <Header user={me} />
      <main className="page stack">
        <Link href="/katalog" className="back"><Icon name="chevronLeft" size={20} />Katalog</Link>
        <section className="card cat-head">
          <h1 className="dn">{item.name}</h1>
          <p className="strain-meta">
            <span className="dn">{item.producer}</span>
            {item.kind && <span className={`kind kind-${item.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(item.kind)}</span>}
            {item.form !== 'susz' && <span>{formLabel(item.form)}</span>}
          </p>
          <dl className="facts">
            {item.thc != null && <div><dt>THC</dt><dd className="num">{dec(item.thc)}%</dd></div>}
            {item.cbd != null && <div><dt>CBD</dt><dd className="num">{dec(item.cbd)}%</dd></div>}
            <div><dt>Dostępność</dt><dd>{item.availability ? cap(item.availability) : 'brak informacji'}</dd></div>
            <div><dt>Status w źródle</dt><dd>{item.active ? 'Aktualna' : 'Brak w źródle'}</dd></div>
            <div><dt>Ostatnio widziana</dt><dd className="num">{formatDay(item.last_seen)}</dd></div>
          </dl>
          {match ? <Link className="btn" href={`/strains/${match.id}`}>Otwórz pełną kartę odmiany</Link> : <AddFromCatalog item={item} />}
          <p className="muted small">Dostępność zmienia się często i nie jest gwarancją.</p>
          <PharmacyLink registeredName={ref.length === 1 ? ref[0].registeredName : ''} producer={item.producer} name={item.name} />
        </section>
        {match ? <CharacteristicCard strain={match} hidePrice={isNativeApp(await headers())} /> : (
          <section className="card"><h2>Karta charakterystyki</h2>
            <p className="muted">Ta odmiana nie ma jeszcze karty w Zielniku. Dodaj ją do swoich odmian, a potem uzupełnij opis, terpeny i dane przyciskiem „Uzupełnij z internetu” w edycji odmiany. Informacje mają charakter poglądowy, ustal je z lekarzem.</p></section>
        )}
      </main>
    </>
  );
}
