import { mailEnabled } from '@/lib/mail';
import LoginForm from './LoginForm';

// Flaga wysyłki e-maili czytana przy żądaniu (zmienne Vercel), nie przy budowaniu
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <LoginForm forgot={mailEnabled()} />;
}
