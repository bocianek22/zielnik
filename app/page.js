import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { dailyUse, purchaseStats } from '@/lib/strains';
import { dailyUsageSeries, homeSummary, prescriptionCountdown, todaySymptoms } from '@/lib/stats';
import { noUseToday } from '@/lib/no-use';
import { symptomStreak } from '@/lib/streak';
import { todayHidden } from '@/lib/today-layout';
import { onboardingOpen } from '@/lib/onboarding';
import Header from './components/Header';
import HomeStore from './components/HomeStore';
import TodayBoard, { TodayHero } from './components/TodayBoard';
import Onboarding from './components/Onboarding';
import SymptomStreak from './components/SymptomStreak';
import LocalReminderSync from './components/LocalReminderSync';

export const dynamic = 'force-dynamic';

// Strona główna: tylko panel „Dziś”. Lista odmian jest na /odmiany (od Design 3).
export default async function Home({ searchParams }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  // stare adresy listy: skrót „Nowa odmiana” z zapamiętanego manifestu (/?new=1) i podpowiedzi z /szukaj (/?q=)
  const sp = (await searchParams) || {};
  if (sp.new === '1') redirect('/odmiany?new=1');
  if (typeof sp.q === 'string' && sp.q) redirect(`/odmiany?q=${encodeURIComponent(sp.q.slice(0, 60))}`);

  // POM-19: nowe konto bez odmian i recept widzi kreator zamiast pustego panelu (bez ciężkich zapytań)
  if (await onboardingOpen(user.id)) {
    return (
      <>
        <Header user={user} />
        <main className="page home"><Onboarding /></main>
      </>
    );
  }

  const [daily, bought, series, summary, prescriptions, symptoms, noUse, streak, hidden] = await Promise.all([
    dailyUse(user.id), purchaseStats(user.id), dailyUsageSeries(user.id, 14), homeSummary(user.id), prescriptionCountdown(user.id), todaySymptoms(user.id),
    noUseToday(user.id), symptomStreak(user.id), todayHidden(user.id),
  ]);
  // data w nagłówku w czasie polskim (serwer działa w UTC)
  const date = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });

  return (
    <>
      <Header user={user} />
      <main className="page home">
        <HomeStore bought={bought} series={series} summary={summary}>
          <header className="home-head hero">
            <p className="home-date">{date}</p>
            <h1>Dziś</h1>
            <TodayHero usage={daily} />
          </header>
          <TodayBoard usage={daily} bought={bought} prescriptions={prescriptions} symptoms={symptoms} noUse={noUse} hidden={hidden}
            streak={<SymptomStreak data={streak} className="streak-home" />} />
          {/* POM-49: lokalne przypomnienia w APK; dziś bez przypomnienia, gdy wpis objawów już jest */}
          <LocalReminderSync hasToday={!!symptoms && ['pain', 'sleep', 'anxiety', 'mood'].some((k) => symptoms[k] != null)} />
        </HomeStore>
      </main>
    </>
  );
}
