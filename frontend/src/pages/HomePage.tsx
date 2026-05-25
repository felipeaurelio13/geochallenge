import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, Icon, PageTemplate } from '../components';
import { buttonVariants } from '../components/atoms/Button';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <PageTemplate contentClassName="relative justify-center py-6 sm:py-10">
      <a href="#home-main-actions" className="skip-link">
        {t('common.skipToMainAction')}
      </a>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(34,197,94,0.28),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_100%,_rgba(59,130,246,0.18),_transparent_50%)]" />
      </div>
      <Card className="relative mx-auto w-full max-w-sm px-5 py-8 text-center backdrop-blur shadow-2xl shadow-black/40 sm:px-8 sm:py-10">
        <Icon symbol="🌍" className="mb-4 text-6xl" />

        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          <span className="text-primary">Geo</span>Challenge
        </h1>

        {user ? (
          <p className="mt-2 text-sm text-primary/80">
            {t('home.welcomeBack', { name: user.username })}
          </p>
        ) : (
          <p className="mt-2 text-sm text-app-secondary">{t('home.subtitle')}</p>
        )}

        <div id="home-main-actions" className="mt-8 flex flex-col gap-3">
          {user ? (
            <>
              <Link to="/menu" className={buttonVariants({ variant: 'primary', size: 'lg', fullWidth: true })}>
                {t('home.play')}
              </Link>
              <Link to="/rankings" className={buttonVariants({ variant: 'ghost', size: 'md', fullWidth: true })}>
                {t('nav.rankings')}
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className={buttonVariants({ variant: 'primary', size: 'lg', fullWidth: true })}>
                {t('home.login')}
              </Link>
              <Link to="/register" className={buttonVariants({ variant: 'secondary', size: 'lg', fullWidth: true })}>
                {t('home.register')}
              </Link>
            </>
          )}
        </div>
      </Card>
    </PageTemplate>
  );
}
