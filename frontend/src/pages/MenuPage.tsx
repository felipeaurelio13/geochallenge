import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { AppFooter } from '../components/AppFooter';

type Category = 'FLAG' | 'CAPITAL' | 'MAP' | 'SILHOUETTE' | 'MIXED';

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
  const [selectedCategory, setSelectedCategory] = React.useState<Category>(() => {
    if (typeof window === 'undefined') return 'MIXED';

    const storedCategory = window.localStorage.getItem('geochallenge:last-category');
    if (storedCategory && categories.some((cat) => cat.id === storedCategory)) {
      return storedCategory as Category;
    }

    return 'MIXED';
  });

  React.useEffect(() => {
    window.localStorage.setItem('geochallenge:last-category', selectedCategory);
  }, [selectedCategory]);

  const selectedCategoryLabel = t(
    categories.find((cat) => cat.id === selectedCategory)?.labelKey ?? 'categories.mixed'
  );

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-20 border-b border-gray-800/80 bg-gray-950/95 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">🌍</span>
            <span className="truncate text-base font-bold text-white sm:text-lg">
              <span className="text-primary">Geo</span>Challenge
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              to="/profile"
              className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-gray-200 transition-colors hover:border-gray-600 hover:text-white"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-20 truncate text-xs sm:inline sm:text-sm">{user?.username}</span>
            </Link>
            <button
              onClick={logout}
              className="min-h-11 rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-2 text-gray-300 transition-colors hover:border-red-500/60 hover:text-red-300"
              title={t('auth.logout')}
              aria-label={t('auth.logout')}
            >
              🚪
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-4 pb-6 sm:px-6 sm:py-6 sm:pb-8">
        <section className="surface-panel p-4 sm:p-6">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{t('menu.welcome', { name: user?.username })}</h1>
          <p className="mt-1 text-sm text-gray-300 sm:text-base">{t('menu.chooseMode')}</p>
        </section>

        <section className="surface-panel mt-4 p-4 sm:p-5">
          <h2 className="mb-2 text-base font-semibold text-white">{t('menu.selectCategory')}</h2>
          <div className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-2.5 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`min-h-11 min-w-[7.4rem] snap-start rounded-xl border px-3 py-2.5 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/60 sm:min-w-0 ${
                  selectedCategory === cat.id
                    ? 'border-primary/70 bg-primary/15 text-white shadow-md shadow-primary/15'
                    : 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
                aria-pressed={selectedCategory === cat.id}
              >
                <span className="mb-1 block text-lg">{cat.icon}</span>
                <span className="text-xs font-medium sm:text-sm">{t(cat.labelKey)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 sm:hidden">{t('menu.mobileCategoriesHint')}</p>

          <p className="mt-3 text-xs text-primary" aria-live="polite">
            {t('menu.selectedCategory')}: <span className="font-semibold">{selectedCategoryLabel}</span>
          </p>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3" aria-label={t('menu.chooseMode')}>
          <button
            onClick={() => navigate(`/game/single?category=${selectedCategory}`)}
            className="group rounded-2xl border border-primary/40 bg-primary/10 p-4 text-left transition-all hover:border-primary/70 hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/70"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{selectedCategoryLabel}</p>
            <h3 className="mt-1 text-lg font-bold text-white">{t('menu.singlePlayer')}</h3>
            <p className="mt-1 text-sm text-gray-300">{t('menu.singlePlayerDesc')}</p>
          </button>

          <button
            onClick={() => navigate(`/duel?category=${selectedCategory}`)}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/70"
          >
            <h3 className="text-lg font-bold text-white">{t('menu.duel')}</h3>
            <p className="mt-1 text-sm text-gray-300">{t('menu.duelDesc')}</p>
          </button>

          <button
            onClick={() => navigate(`/challenges?category=${selectedCategory}&openCreate=1`)}
            className="rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/70"
          >
            <h3 className="text-lg font-bold text-white">{t('menu.challenge')}</h3>
            <p className="mt-1 text-sm text-gray-300">{t('menu.challengeDesc')}</p>
          </button>
        </section>
      </main>

      <AppFooter className="sm:pb-4" />
    </div>
  );
}
