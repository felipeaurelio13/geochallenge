import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, Icon, PageTemplate } from '../components';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <PageTemplate contentClassName="relative justify-center py-6 sm:py-10">
      <a href="#home-main-actions" className="skip-link">
        {t('common.skipToMainAction')}
      </a>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.2),_transparent_45%)]" />
      <Card className="relative mx-auto w-full max-w-lg px-5 py-6 text-center backdrop-blur sm:px-8 sm:py-8">
        <Badge tone="primary" className="mb-4">
          {t('home.badge')}
        </Badge>

        <Icon symbol="🌍" className="mb-3 text-5xl" />

        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          <span className="text-primary">Geo</span>Challenge
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm text-gray-300 sm:text-base">{t('home.subtitle')}</p>

        {user && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary sm:text-sm">
            {t('home.welcomeBack', { name: user.username })}
          </p>
        )}

        <div id="home-main-actions" className="mt-6 grid grid-cols-1 gap-3">
          {user ? (
            <Link
              to="/menu"
              className="rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/70"
            >
              {t('home.play')}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/70"
              >
                {t('home.login')}
              </Link>
              <Link
                to="/register"
                className="rounded-xl border border-gray-700 bg-gray-900 px-6 py-3.5 text-base font-semibold text-gray-100 transition-colors hover:border-gray-500 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {t('home.register')}
              </Link>
            </>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400 sm:text-sm">
          {t('home.features.flags')} · {t('home.features.maps')} · {t('home.features.multiplayer')}
        </p>

        <p className="mt-2 text-xs text-gray-500">{t('home.quickTrustLine')}</p>
      </Card>
    </PageTemplate>
  );
}
