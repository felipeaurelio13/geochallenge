import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useGesture, useLocalStorage, useMediaQuery } from '../hooks';
import { Button, Header, Icon, PageTemplate } from '../components';

type Category = 'FLAG' | 'CAPITAL' | 'MAP' | 'SILHOUETTE' | 'MIXED';

const categories: { id: Category; icon: string; labelKey: string }[] = [
  { id: 'FLAG', icon: '🏳️', labelKey: 'categories.flags' },
  { id: 'CAPITAL', icon: '🏛️', labelKey: 'categories.capitals' },
  { id: 'MAP', icon: '🗺️', labelKey: 'categories.maps' },
  { id: 'SILHOUETTE', icon: '🖼️', labelKey: 'categories.silhouettes' },
  { id: 'MIXED', icon: '🎲', labelKey: 'categories.mixed' },
];

const categorySerializer = {
  parse: (value: string): Category => {
    if (categories.some((cat) => cat.id === value)) {
      return value as Category;
    }

    return 'MIXED';
  },
  stringify: (value: Category) => value,
};

export function MenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMobile = useMediaQuery('(max-width: 640px)');

  const [selectedCategory, setSelectedCategory] = useLocalStorage<Category>(
    'geochallenge:last-category',
    'MIXED',
    categorySerializer,
  );

  const selectedCategoryIndex = categories.findIndex(
    (category) => category.id === selectedCategory,
  );

  const updateCategoryByOffset = (offset: number) => {
    const nextIndex = (selectedCategoryIndex + offset + categories.length) % categories.length;
    setSelectedCategory(categories[nextIndex].id);
  };

  const swipeHandlers = useGesture({
    onSwipeLeft: () => isMobile && updateCategoryByOffset(1),
    onSwipeRight: () => isMobile && updateCategoryByOffset(-1),
  });

  const selectedCategoryLabel = t(
    categories.find((cat) => cat.id === selectedCategory)?.labelKey ?? 'categories.mixed',
  );

  return (
    <PageTemplate
      header={
        <Header
          actions={
            <>
              <Link
                to="/profile"
                className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-gray-200 transition-colors hover:border-gray-600 hover:text-white"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-20 truncate text-xs sm:inline sm:text-sm">
                  {user?.username}
                </span>
              </Link>
              <Button
                onClick={logout}
                variant="secondary"
                size="sm"
                title={t('auth.logout')}
                aria-label={t('auth.logout')}
              >
                <Icon symbol="🚪" />
              </Button>
            </>
          }
        />
      }
      contentClassName="py-3 pb-4 sm:py-4 sm:pb-6"
    >
      <p className="px-1 text-sm text-gray-300 sm:px-0">
        {t('menu.welcomeExplore', { name: user?.username })}
      </p>

      <section className="mt-3" {...swipeHandlers}>
        <h2 className="mb-2 px-1 text-sm font-semibold text-white sm:px-0 sm:text-base">
          {t('menu.selectCategory')}
        </h2>
        <div className="scrollbar-none -mx-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-2.5 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              variant={selectedCategory === cat.id ? 'primary' : 'secondary'}
              className={`min-w-[7rem] snap-start !min-h-10 !rounded-xl !px-3 !py-2 text-left sm:min-w-0 ${
                selectedCategory === cat.id
                  ? '!border-primary/70 !bg-primary/15 !text-white'
                  : '!border-gray-700 !bg-gray-900/80 !text-gray-100/90'
              }`}
              aria-pressed={selectedCategory === cat.id}
            >
              <span className="mb-0.5 block text-base">{cat.icon}</span>
              <span className="text-xs font-medium leading-tight sm:text-sm">
                {t(cat.labelKey)}
              </span>
            </Button>
          ))}
        </div>
      </section>

      <section className="mt-4" aria-label={t('menu.gameModes')}>
        <h2 className="mb-2 px-1 text-sm font-semibold text-white sm:px-0 sm:text-base">
          {t('menu.gameModes')}
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            onClick={() => navigate(`/game/single?category=${selectedCategory}`)}
            className="group !rounded-2xl !border-primary/40 !bg-primary/10 !p-3 text-left hover:!border-primary/70 hover:!bg-primary/15 sm:!p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {selectedCategoryLabel}
            </p>
            <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-white sm:text-lg">
              <Icon symbol="🎯" />
              {t('menu.singlePlayer')}
            </h3>
            <p className="mt-0.5 text-sm leading-snug text-gray-300">
              {t('menu.singlePlayerDesc')}
            </p>
          </Button>

          <Button
            onClick={() => navigate(`/duel?category=${selectedCategory}`)}
            variant="secondary"
            className="!rounded-2xl !border-gray-800 !bg-gray-900 !p-3 text-left sm:!p-4"
          >
            <h3 className="flex items-center gap-2 text-base font-bold text-white sm:text-lg">
              <Icon symbol="⚔️" />
              {t('menu.duel')}
            </h3>
            <p className="mt-0.5 text-sm leading-snug text-gray-300">{t('menu.duelDesc')}</p>
          </Button>

          <Button
            onClick={() => navigate(`/challenges?category=${selectedCategory}&openCreate=1`)}
            variant="secondary"
            className="!rounded-2xl !border-gray-800 !bg-gray-900 !p-3 text-left sm:!p-4"
          >
            <h3 className="flex items-center gap-2 text-base font-bold text-white sm:text-lg">
              <Icon symbol="🏁" />
              {t('menu.challenge')}
            </h3>
            <p className="mt-0.5 text-sm leading-snug text-gray-300">{t('menu.challengeDesc')}</p>
          </Button>
        </div>
      </section>
    </PageTemplate>
  );
}
