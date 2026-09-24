'use client';

export default function PrintButton() {
  return <button type="button" className="btn no-print" onClick={() => window.print()}>Drukuj / zapisz jako PDF</button>;
}
