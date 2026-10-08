import ResetForm from './ResetForm';

export const dynamic = 'force-dynamic';

export default function ResetPage() {
  return (
    <div className="auth solo">
      <main className="auth-form"><ResetForm /></main>
    </div>
  );
}
