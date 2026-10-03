'use client';
import { useRef, useState } from 'react';
import StatsAdmin from './StatsAdmin';
import UsersAdmin from './UsersAdmin';
import InvitesAdmin from './InvitesAdmin';
import PlansAdmin from './PlansAdmin';
import ReportsAdmin from './ReportsAdmin';
import BackupsAdmin from './BackupsAdmin';
import ErrorsAdmin from './ErrorsAdmin';
import AuditAdmin from './AuditAdmin';
import EnrichAdmin from './EnrichAdmin';

const TABS = [['konta', 'Konta'], ['zgloszenia', 'Zgłoszenia'], ['system', 'System']];

// Panel dzieli się na trzy zakładki, żeby na telefonie nie przewijać dziewięciu sekcji naraz.
// Panele zostają zamontowane (ukrywa je atrybut hidden): odmontowanie gubiłoby np. hasło tymczasowe pokazane po resecie konta.
export default function AdminTabs({ meId }) {
  const [tab, setTab] = useState('konta');
  const [reportCount, setReportCount] = useState(0);
  const refs = useRef({});

  // wzorzec ARIA tabs: strzałki, Home i End przenoszą zaznaczenie i fokus
  function onKeyDown(e) {
    const i = TABS.findIndex(([id]) => id === tab);
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length
      : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next][0]);
    refs.current[TABS[next][0]]?.focus();
  }

  return (
    <div className="admin-body">
      <div className="seg admin-tabs" role="tablist" aria-label="Sekcje panelu" onKeyDown={onKeyDown}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`atab-${id}`} ref={(el) => { refs.current[id] = el; }}
            aria-selected={tab === id} aria-controls={`apanel-${id}`} tabIndex={tab === id ? 0 : -1}
            className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}{id === 'zgloszenia' && reportCount > 0 ? ` (${reportCount})` : ''}
          </button>
        ))}
      </div>
      <div id="apanel-konta" role="tabpanel" aria-labelledby="atab-konta" hidden={tab !== 'konta'} className="admin-panel">
        <StatsAdmin /><UsersAdmin meId={meId} /><InvitesAdmin /><PlansAdmin />
      </div>
      <div id="apanel-zgloszenia" role="tabpanel" aria-labelledby="atab-zgloszenia" hidden={tab !== 'zgloszenia'} className="admin-panel">
        <ReportsAdmin onCount={setReportCount} />
      </div>
      <div id="apanel-system" role="tabpanel" aria-labelledby="atab-system" hidden={tab !== 'system'} className="admin-panel">
        <BackupsAdmin /><EnrichAdmin /><ErrorsAdmin /><AuditAdmin />
      </div>
    </div>
  );
}
