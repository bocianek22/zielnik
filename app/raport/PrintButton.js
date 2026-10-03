'use client';
import Icon from '../components/Icon';

export default function PrintButton() {
  return <button type="button" className="btn no-print" onClick={() => window.print()}><Icon name="download" size={18} />Drukuj lub zapisz jako PDF</button>;
}
