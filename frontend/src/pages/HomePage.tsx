import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const APP_VERSION = '1.0.8';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.2),_transparent_55%)]" />

        <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <section className="mx-auto w-full max-w-2xl text-center">
            <p className="mb-5 inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Trivia geográfica competitiva
            </p>

            <div className="mb-4 text-6xl" aria-hidden>
              🌍
            </div>

            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
              <span className="text-primary">Geo</span>Challenge
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base text-gray-300 sm:text-lg">
              {t('home.subtitle')}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {user ? (
                <Link
                  to="/menu"
                  className="rounded-xl bg-primary px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/70"
                >
                  {t('home.play')}
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="rounded-xl bg-primary px-6 py-3 text-base font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/70"
                  >
                    {t('home.login')}
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-xl border border-gray-700 bg-gray-900 px-6 py-3 text-base font-semibold text-gray-100 transition-colors hover:border-gray-500 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    {t('home.register')}
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="mx-auto mt-10 grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
            <article className="rounded-2xl border border-gray-800 bg-gray-900/80 p-5 backdrop-blur">
              <div className="mb-3 text-3xl" aria-hidden>🏳️</div>
              <h2 className="text-base font-semibold">{t('home.features.flags')}</h2>
              <p className="mt-2 text-sm text-gray-400">{t('home.features.flagsDesc')}</p>
            </article>

            <article className="rounded-2xl border border-gray-800 bg-gray-900/80 p-5 backdrop-blur">
              <div className="mb-3 text-3xl" aria-hidden>🗺️</div>
              <h2 className="text-base font-semibold">{t('home.features.maps')}</h2>
              <p className="mt-2 text-sm text-gray-400">{t('home.features.mapsDesc')}</p>
            </article>

            <article className="rounded-2xl border border-gray-800 bg-gray-900/80 p-5 backdrop-blur sm:col-span-2 lg:col-span-1">
              <div className="mb-3 text-3xl" aria-hidden>⚔️</div>
              <h2 className="text-base font-semibold">{t('home.features.multiplayer')}</h2>
              <p className="mt-2 text-sm text-gray-400">{t('home.features.multiplayerDesc')}</p>
            </article>
          </section>
        </main>
      </div>

      <footer className="border-t border-gray-800 py-5 text-center text-xs text-gray-500">
        <p>GeoChallenge &copy; {new Date().getFullYear()}</p>
        <p className="mt-1">v{APP_VERSION}</p>
      </footer>
    </div>
  );
}
