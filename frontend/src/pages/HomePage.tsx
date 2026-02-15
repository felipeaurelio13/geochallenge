import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const APP_VERSION = __APP_VERSION__ || '0.0.0';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.2),_transparent_45%)]" />

        <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <section className="mx-auto w-full max-w-xl text-center">
            <p className="mb-4 inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {t('home.badge')}
            </p>

            <div className="mb-3 text-5xl" aria-hidden>
              🌍
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              <span className="text-primary">Geo</span>Challenge
            </h1>

            <p className="mx-auto mt-4 max-w-md text-sm text-gray-300 sm:text-base">
              {t('home.subtitle')}
            </p>

            <div className="mt-7 grid grid-cols-1 gap-3">
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

            <p className="mt-5 text-xs text-gray-400 sm:text-sm">
              {t('home.features.flags')} · {t('home.features.maps')} · {t('home.features.multiplayer')}
            </p>
          </section>
        </main>
      </div>

      <footer className="app-footer">
        <p>GeoChallenge &copy; {new Date().getFullYear()}</p>
        <p className="app-footer__version">v{APP_VERSION}</p>
      </footer>
    </div>
  );
}
