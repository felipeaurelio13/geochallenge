import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from '../hooks';
import { Button, Header, Icon, PageTemplate } from '../components';
import { UserAvatar } from '../components/atoms/UserAvatar';
import { GameModeCard } from '../components/molecules/GameModeCard';

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

  const [selectedCategory, setSelectedCategory] = useLocalStorage<Category>(
    'geochallenge:last-category',
    'MIXED',
    categorySerializer,
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
                <UserAvatar username={user?.username || ''} size="xs" />
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
      contentClassName="py-2.5 pb-4 sm:py-3 sm:pb-6"
    >
      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-0">
          {t('menu.selectCategory')}
        </p>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              variant={selectedCategory === cat.id ? 'primary' : 'secondary'}
              className={`flex flex-col items-center justify-center !min-h-14 !rounded-xl !px-1 !py-2.5 gap-1 ${
                selectedCategory === cat.id
                  ? '!border-primary/70 !bg-primary/15 !text-white'
                  : '!border-gray-700 !bg-gray-900/80 !text-gray-100/90'
              } menu-category-selector`}
              aria-pressed={selectedCategory === cat.id}
            >
              <span className="menu-category-selector__icon text-xl leading-none">{cat.icon}</span>
              <span className="menu-category-selector__label text-[0.65rem] font-medium leading-tight sm:text-xs">
                {t(cat.labelKey)}
              </span>
            </Button>
          ))}
        </div>
      </section>

      <section className="mt-4" aria-label={t('menu.gameModes')}>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-5">
          <GameModeCard
            icon="⚡"
            title={t('menu.flash')}
            description={t('menu.flashDesc')}
            onClick={() => navigate('/game/flash')}
          />
          <GameModeCard
            icon="🎯"
            title={t('menu.singlePlayer')}
            description={t('menu.singlePlayerDesc')}
            onClick={() => navigate(`/game/single?category=${selectedCategory}`)}
          />
          <GameModeCard
            icon="⚔️"
            title={t('menu.duel')}
            description={t('menu.duelDesc')}
            onClick={() => navigate(`/duel?category=${selectedCategory}`)}
          />
          <GameModeCard
            icon="🏁"
            title={t('menu.challenge')}
            description={t('menu.challengeDesc')}
            onClick={() => navigate(`/challenges?category=${selectedCategory}&openCreate=1`)}
          />
          <GameModeCard
            icon="🔥"
            title={t('menu.streak')}
            description={t('menu.streakDesc')}
            onClick={() => navigate(`/game/single?category=${selectedCategory}&mode=streak`)}
            className="col-span-2 lg:col-span-1"
          />
        </div>
      </section>
    </PageTemplate>
  );
}
