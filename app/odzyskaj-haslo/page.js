import { mailEnabled } from '@/lib/mail';
import ForgotForm from './ForgotForm';

export const dynamic = 'force-dynamic';

export default function ForgotPage() {
  return (
    <div className="auth solo">
      <main className="auth-form">
        {mailEnabled() ? <ForgotForm /> : (
          <div className="auth-box">
            <h1>Nie pamiętam hasła</h1>
            <p className="auth-lead">Odzyskiwanie hasła e-mailem nie jest dostępne w tej instalacji. Poproś administratora o reset hasła.</p>
            <p className="auth-alt"><a href="/login">Wróć do logowania</a></p>
          </div>
        )}
      </main>
    </div>
  );
}
