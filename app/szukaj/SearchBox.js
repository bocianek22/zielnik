'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ARTICLES, TERPENES } from '@/lib/knowledge';
import { strainItems, catalogItems, producerItems, flavorItems, articleItems, groupItems, personItems } from '@/lib/searchItems';
import SearchSuggest, { rememberSearch } from '../components/SearchSuggest';

export const HISTORY_KEY = 'zielnik.szukaj.ostatnie';

// Osoby z serwera (od 2 znaków: krótsze zapytanie wypisałoby większość nazw użytkowników)
const people = {
  minChars: 2,
  load: async (q, signal) => {
    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { signal });
    if (!r.ok) return null;
    const { users = [] } = await r.json();
    return { key: 'people', title: 'Osoby', items: personItems(users) };
  },
};

const HREF = {
  strain: (x) => `/strains/${x.id}`,
  catalog: (x) => `/katalog/${x.id}`,
  producer: (x) => `/odmiany?q=${encodeURIComponent(x.label)}`,
  flavor: (x) => `/odmiany?q=${encodeURIComponent(x.label)}`,
  article: (x) => `/wiedza#${x.id}`,
  person: (x) => `/u/${encodeURIComponent(x.username)}`,
  group: (x) => `/grupy/${x.id}`,
};

export default function SearchBox({ initial, index }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const groups = useMemo(() => [
    { key: 'strains', title: 'Odmiany', items: strainItems(index.strains) },
    { key: 'producers', title: 'Producenci', items: producerItems(index.strains, index.catalog) },
    { key: 'flavors', title: 'Terpeny i smaki', items: flavorItems(index.strains, TERPENES.map((t) => t.name.split(' ')[0])) },
    { key: 'catalog', title: 'Katalog', items: catalogItems(index.catalog) },
    { key: 'articles', title: 'Wiedza', items: articleItems(ARTICLES) },
    { key: 'groups', title: 'Twoje grupy', items: groupItems(index.groups) },
  ], [index]);

  function pick(item) {
    if (item.recent) { setValue(item.label); router.push(`/szukaj?q=${encodeURIComponent(item.label)}`); return; }
    router.push(HREF[item.type](item));
  }

  return (
    <form className="search-form" method="get" role="search" onSubmit={() => { if (value.trim()) rememberSearch(HISTORY_KEY, value.trim()); }}>
      <SearchSuggest value={value} onChange={setValue} groups={groups} remote={people} onPick={pick} historyKey={HISTORY_KEY}
        inputProps={{ id: 'q', name: 'q', maxLength: 60, autoFocus: !initial, 'aria-label': 'Szukaj', placeholder: 'Odmiana, producent, terpen, osoba…' }} />
      <button className="btn">Szukaj</button>
    </form>
  );
}
