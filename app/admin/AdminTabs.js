'use client';
import { useState } from 'react';
import StatsAdmin from './StatsAdmin';
import UsersAdmin from './UsersAdmin';
import InvitesAdmin from './InvitesAdmin';
import PlansAdmin from './PlansAdmin';
import ReportsAdmin from './ReportsAdmin';
import BackupsAdmin from './BackupsAdmin';
import ErrorsAdmin from './ErrorsAdmin';
import AuditAdmin from './AuditAdmin';

const TABS = [['konta', 'Konta'], ['zgloszenia', 'Zgłoszenia'], ['system', 'System']];

// Panel dzieli się na trzy zakładki, żeby na telefonie nie przewijać dziewięciu sekcji naraz
export default function AdminTabs({ meId }) {
  const [tab, setTab] = useState('konta');
  return (
    <div className="admin-body">
      <div className="seg admin-tabs" role="tablist" aria-label="Sekcje panelu">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`atab-${id}`} aria-selected={tab === id} aria-controls="admin-panel"
            className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div id="admin-panel" role="tabpanel" aria-labelledby={`atab-${tab}`} className="admin-panel">
        {tab === 'konta' && <><StatsAdmin /><UsersAdmin meId={meId} /><InvitesAdmin /><PlansAdmin /></>}
        {tab === 'zgloszenia' && <ReportsAdmin />}
        {tab === 'system' && <><BackupsAdmin /><ErrorsAdmin /><AuditAdmin /></>}
      </div>
    </div>
  );
}
