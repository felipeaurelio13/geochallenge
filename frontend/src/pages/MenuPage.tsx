import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const APP_VERSION = __APP_VERSION__ || '0.0.0';

type Category = 'FLAG' | 'CAPITAL' | 'MAP' | 'SILHOUETTE' | 'MIXED';

interface GameModeCard {
  id: string;
  icon: string;
  titleKey: string;
  descKey: string;
  path: string;
  color: string;
}

const gameModes: GameModeCard[] = [
  {
    id: 'single',
    icon: '🎯',
    titleKey: 'menu.singlePlayer',
    descKey: 'menu.singlePlayerDesc',
    path: '/game/single',
    color: 'from-sky-500/90 to-blue-700/90',
  },
  {
    id: 'duel',
    icon: '⚔️',
    titleKey: 'menu.duel',
    descKey: 'menu.duelDesc',
    path: '/duel',
    color: 'from-rose-500/90 to-red-700/90',
  },
  {
    id: 'challenge',
    icon: '📨',
    titleKey: 'menu.challenge',
    descKey: 'menu.challengeDesc',
    path: '/challenges',
    color: 'from-violet-500/90 to-purple-700/90',
  },
];

const categories: { id: Category; icon: string; labelKey: string }[] = [
  { id: 'FLAG', icon: '🏳️', labelKey: 'categories.flags' },
  { id: 'CAPITAL', icon: '🏛️', labelKey: 'categories.capitals' },
  { id: 'MAP', icon: '🗺️', labelKey: 'categories.maps' },
  { id: 'SILHOUETTE', icon: '🖼️', labelKey: 'categories.silhouettes' },
  { id: 'MIXED', icon: '🎲', labelKey: 'categories.mixed' },
];

export function MenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [selectedCategory, setSelectedCategory] = React.useState<Category>('MIXED');

  const handleStartGame = (mode: string) => {
    if (mode === 'single') {
      navigate(`/game/single?category=${selectedCategory}`);
      return;
    } else {
      if (mode === 'duel') {
        navigate(`/duel?category=${selectedCategory}`);
        return;
      }

      navigate(`/${mode}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="sticky top-0 z-20 border-b border-gray-800/80 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">🌍</span>
            <span className="truncate text-base font-bold text-white sm:text-lg">
              <span className="text-primary">Geo</span>Challenge
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/rankings"
              className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-xs font-medium text-gray-200 transition-colors hover:border-gray-600 hover:text-white sm:text-sm"
            >
              🏆 <span className="hidden sm:inline">{t('menu.rankings')}</span>
            </Link>
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-gray-200 transition-colors hover:border-gray-600 hover:text-white"
            >
              <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-20 truncate text-xs sm:inline sm:text-sm">{user?.username}</span>
            </Link>
            <button
              onClick={logout}
              className="rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-2 text-gray-300 transition-colors hover:border-red-500/60 hover:text-red-300"
              title={t('auth.logout')}
              aria-label={t('auth.logout')}
            >
              🚪
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-10">
        <section className="rounded-2xl border border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 p-5 shadow-lg shadow-black/15 sm:p-6">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {t('menu.welcome', { name: user?.username })}
          </h1>
          <p className="mt-1 text-sm text-gray-300 sm:text-base">{t('menu.chooseMode')}</p>
        </section>

        <section className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/90 p-4 sm:p-6">
          <h2 className="text-base font-semibold text-white mb-3 sm:text-lg">
            {t('menu.selectCategory')}
          </h2>
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-2.5 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`min-w-[8.2rem] snap-start rounded-xl border px-3 py-3 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/60 sm:min-w-0 ${
                  selectedCategory === cat.id
                    ? 'border-primary/70 bg-primary/15 text-white shadow-md shadow-primary/15'
                    : 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
                aria-pressed={selectedCategory === cat.id}
              >
                <span className="block text-xl mb-1">{cat.icon}</span>
                <span className="text-xs font-medium sm:text-sm">{t(cat.labelKey)}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400 sm:text-sm">
            {t('menu.selectedCategory')}: <span className="font-semibold text-primary">{t(categories.find((cat) => cat.id === selectedCategory)?.labelKey ?? 'categories.mixed')}</span>
          </p>
        </section>

        <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {gameModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleStartGame(mode.id)}
              className={`group rounded-2xl bg-gradient-to-br ${mode.color} p-5 text-left shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/70`}
            >
              <div className="text-4xl mb-3">{mode.icon}</div>
              <h3 className="text-xl font-bold text-white mb-1.5">
                {t(mode.titleKey)}
              </h3>
              <p className="text-white/85 text-sm leading-relaxed">{t(mode.descKey)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white/90">
                Empezar <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </button>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/90 p-4 sm:p-6">
          <h2 className="text-base font-semibold text-white mb-4 sm:text-lg">
            {t('menu.yourStats')}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
              <div className="text-2xl font-bold text-primary sm:text-3xl">
                {user?.highScore?.toLocaleString() || 0}
              </div>
              <div className="text-gray-400 text-xs sm:text-sm">{t('stats.highScore')}</div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
              <div className="text-2xl font-bold text-white sm:text-3xl">
                {user?.gamesPlayed || 0}
              </div>
              <div className="text-gray-400 text-xs sm:text-sm">{t('stats.gamesPlayed')}</div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
              <div className="text-2xl font-bold text-green-400 sm:text-3xl">
                {user?.wins || 0}
              </div>
              <div className="text-gray-400 text-xs sm:text-sm">{t('stats.wins')}</div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
              <div className="text-2xl font-bold text-red-400 sm:text-3xl">
                {user?.losses || 0}
              </div>
              <div className="text-gray-400 text-xs sm:text-sm">{t('stats.losses')}</div>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-800/90 bg-gray-950/95 p-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <button
          onClick={() => handleStartGame('single')}
          className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/70"
        >
          {t('menu.singlePlayer')} · {t(categories.find((cat) => cat.id === selectedCategory)?.labelKey ?? 'categories.mixed')}
        </button>
      </div>

      <footer className="border-t border-gray-800 py-4 text-center text-xs text-gray-500">
        <p>GeoChallenge &copy; {new Date().getFullYear()}</p>
        <p className="mt-1">v{APP_VERSION}</p>
      </footer>
    </div>
  );
}
