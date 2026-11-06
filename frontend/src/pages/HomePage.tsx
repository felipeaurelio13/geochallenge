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
    <PageTemplate contentClassName="py-4 sm:py-8 flex flex-col justify-center">
      <a href="#home-main-actions" className="skip-link">
        {t('common.skipToMainAction')}
      </a>

      <section className="mx-auto w-full max-w-md shrink-0 px-3 py-2 text-center sm:px-6">
        {/* Glow ambient background around the emblem */}
        <div className="relative mx-auto mb-3 flex items-center justify-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute h-24 w-24 rounded-full bg-primary/20 blur-2xl dark:bg-primary/25"
          />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-app-surface shadow-md shadow-primary/15 transition-transform duration-200 hover:scale-105 active:scale-95">
            <GeoMark
              className="h-10 w-10 text-primary drop-shadow-[0_2px_10px_rgba(24,123,104,0.4)]"
              title="GeoChallenge"
            />
          </div>
        </div>

        {/* Brand Title with vibrant gradient clip */}
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 bg-clip-text text-transparent">
            Geo
          </span>
          <span className="text-app-text">Challenge</span>
        </h1>

        {user ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span>{t('home.welcomeBack', { name: user.username })}</span>
          </div>
        ) : (
          <p className="mt-2 text-sm font-medium text-app-secondary sm:text-base">
            {t('home.subtitle')}
          </p>
        )}

        {/* Feature / Guest Trial Card */}
        {!user && featureFlags.guestTrial && (
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-app-surface via-app-surface to-primary/5 p-5 text-center shadow-sm">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-primary">
              <span className="text-xs">⚡</span>
              <span>Modo Rápido · 5 Preguntas</span>
            </div>

            {/* Floating flags showcase */}
            <div className="mt-4 flex items-center justify-center gap-3 text-4xl" aria-hidden="true">
              <span className="inline-block transform -rotate-6 transition-transform hover:rotate-0 hover:scale-110 duration-200">
                🇨🇱
              </span>
              <span className="inline-block transform scale-110 drop-shadow-md transition-transform hover:scale-125 duration-200">
                🇯🇵
              </span>
              <span className="inline-block transform rotate-6 transition-transform hover:rotate-0 hover:scale-110 duration-200">
                🇧🇷
              </span>
            </div>

            <h2 className="mt-3 text-lg font-bold text-app-text sm:text-xl">
              {t('home.trialTitle')}
            </h2>
            <p className="mt-1.5 text-xs text-app-secondary sm:text-sm">
              {t('home.trialDescription')}
            </p>

            {/* Quick feature perks */}
            <div className="mt-4 flex items-center justify-center gap-2 text-[0.7rem] font-medium text-app-subtle">
              <span>⏱️ 60s</span>
              <span>•</span>
              <span>🎯 Sin cuenta</span>
              <span>•</span>
              <span>🏆 Récord instantáneo</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div id="home-main-actions" className="mt-6 flex flex-col gap-3">
          {user ? (
            <>
              <Link
                to="/menu"
                aria-label={t('home.play')}
                className={buttonVariants({
                  variant: 'primary',
                  size: 'lg',
                  fullWidth: true,
                  className:
                    'group relative flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-primary-500 font-bold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/35 active:scale-[0.99]',
                })}
              >
                <span aria-hidden="true" className="text-base transition-transform group-hover:translate-x-0.5">
                  ▶
                </span>
                <span>{t('home.play')}</span>
              </Link>
              <Link
                to="/rankings"
                aria-label={t('nav.rankings')}
                className={buttonVariants({
                  variant: 'secondary',
                  size: 'md',
                  fullWidth: true,
                  className:
                    'flex items-center justify-center gap-2 border-app-border text-app-secondary hover:text-app-text',
                })}
              >
                <span aria-hidden="true">🏆</span>
                <span>{t('nav.rankings')}</span>
              </Link>
            </>
          ) : (
            <>
              {featureFlags.guestTrial && (
                <Link
                  to="/play"
                  aria-label={t('home.tryGame')}
                  className={buttonVariants({
                    variant: 'primary',
                    size: 'lg',
                    fullWidth: true,
                    className:
                      'group relative flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-primary-500 font-bold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/35 active:scale-[0.99]',
                  })}
                >
                  <span aria-hidden="true" className="text-base transition-transform group-hover:translate-x-0.5">
                    ▶
                  </span>
                  <span>{t('home.tryGame')}</span>
                </Link>
              )}
              <div className="flex gap-2">
                <Link
                  to="/login"
                  aria-label={t('home.login')}
                  className={buttonVariants({
                    variant: featureFlags.guestTrial ? 'secondary' : 'primary',
                    size: 'md',
                    fullWidth: true,
                    className: 'flex items-center justify-center gap-1.5 font-medium',
                  })}
                >
                  <span aria-hidden="true">🔑</span>
                  <span>{t('home.login')}</span>
                </Link>
                <Link
                  to="/register"
                  aria-label={t('home.register')}
                  className={buttonVariants({
                    variant: 'secondary',
                    size: 'md',
                    fullWidth: true,
                    className:
                      'flex items-center justify-center gap-1.5 font-medium border-app-border hover:border-primary/40',
                  })}
                >
                  <span aria-hidden="true">✨</span>
                  <span>{t('home.register')}</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </PageTemplate>
  );
}
