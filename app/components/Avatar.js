// Awatar z inicjałem (mały, do list osób). Zdjęcie pokazuje tylko profil publiczny.
export default function Avatar({ name }) {
  const ch = (name || '?').trim()[0]?.toUpperCase() || '?';
  return <span className="avatar ph sm" aria-hidden="true">{ch}</span>;
}
