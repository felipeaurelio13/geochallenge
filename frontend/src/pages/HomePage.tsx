import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { GeoMark, PageTemplate } from '../components';
import { featureFlags } from '../config/featureFlags';
import { buttonVariants } from '../components/atoms/Button';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <PageTemplate contentClassName="py-4 sm:py-8">
      <a href="#home-main-actions" className="skip-link">
        {t('common.skipToMainAction')}
      </a>

      <section className="mx-auto my-auto w-full max-w-md shrink-0 px-2 py-3 text-center sm:px-8 sm:py-8">
        <GeoMark className="mx-auto mb-3 h-12 w-12 text-primary" title="GeoChallenge" />

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

        {!user && featureFlags.guestTrial && (
          <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-4">
            <div className="flex justify-center gap-4 text-4xl" aria-hidden="true">🇨🇱 🇯🇵 🇧🇷</div>
            <h2 className="mt-4 text-xl font-semibold text-app-text">{t('home.trialTitle')}</h2>
            <p className="mt-2 text-sm text-app-secondary">{t('home.trialDescription')}</p>
          </div>
        )}

        <div id="home-main-actions" className="mt-5 flex flex-col gap-3">
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
              {featureFlags.guestTrial && (
                <Link to="/play" className={buttonVariants({ variant: 'primary', size: 'lg', fullWidth: true })}>
                  {t('home.tryGame')}
                </Link>
              )}
              <Link to="/login" className={buttonVariants({ variant: featureFlags.guestTrial ? 'secondary' : 'primary', size: 'lg', fullWidth: true })}>
                {t('home.login')}
              </Link>
              <Link to="/register" className={buttonVariants({ variant: 'ghost', size: 'lg', fullWidth: true })}>
                {t('home.register')}
              </Link>
            </>
          )}
        </div>
      </section>
    </PageTemplate>
  );
}
