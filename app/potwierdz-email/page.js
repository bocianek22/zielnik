import VerifyEmail from './VerifyEmail';

export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  return (
    <div className="auth solo">
      <main className="auth-form"><VerifyEmail /></main>
    </div>
  );
}
