import Skeleton from './Skeleton';

// Ekran wczytywania (loading.js): szkielet w kształcie ekranu. Paski nawigacji renderuje każda strona przez Header,
// więc tutaj ich nie ma (kopia dublowałaby nawigację, gdy szkielet i strumieniowana treść są naraz w DOM,
// i pokazywałaby menu na stronach bez logowania, które też korzystają z app/loading.js).
export default function LoadingShell({ title, variant = 'screen', rows }) {
  return (
    <main className="page">
      {title && <h1>{title}</h1>}
      <Skeleton variant={variant} rows={rows} />
    </main>
  );
}
