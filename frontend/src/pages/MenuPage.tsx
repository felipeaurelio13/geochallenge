import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useLocalStorage } from '../hooks';
import { Button, Header, PageTemplate } from '../components';
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

const onboardingSerializer = {
  parse: (value: string): boolean => value === 'true',
  stringify: (value: boolean) => (value ? 'true' : 'false'),
};

function AccountMenu({
  username,
  onLogout,
  onProfile,
}: {
  username: string;
  onLogout: () => void;
  onProfile: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={username}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-gray-200 transition-colors hover:border-gray-600 hover:text-white"
      >
        <UserAvatar username={username} size="xs" />
        <span className="hidden max-w-20 truncate text-xs sm:inline sm:text-sm">{username}</span>
        <span aria-hidden="true" className="text-xs text-gray-400">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-xl shadow-black/40"
        >
          <div className="border-b border-gray-800 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {t('auth.signedInAs', { defaultValue: 'Sesión iniciada como' })}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-white">{username}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onProfile();
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-200 transition-colors hover:bg-gray-800"
          >
            {t('nav.profile')}
            <span aria-hidden="true" className="text-gray-500">›</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="block w-full border-t border-gray-800 px-4 py-3 text-left text-sm font-medium text-red-300 transition-colors hover:bg-red-900/30"
          >
            {t('auth.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

export function MenuPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [selectedCategory, setSelectedCategory] = useLocalStorage<Category>(
    'geochallenge:last-category',
    'MIXED',
    categorySerializer,
  );

  const [hintDismissed, setHintDismissed] = useLocalStorage<boolean>(
    'geochallenge:onboarding-flash-hint-dismissed',
    false,
    onboardingSerializer,
  );

  const isNewPlayer = !!user && (user.gamesPlayed ?? 0) === 0;
  const showNewPlayerHint = isNewPlayer && !hintDismissed;

  return (
    <PageTemplate
      header={
        <Header
          actions={
            user ? (
              <AccountMenu
                username={user.username}
                onLogout={logout}
                onProfile={() => navigate('/profile')}
              />
            ) : null
          }
        />
      }
      contentClassName="py-2.5 pb-4 sm:py-3 sm:pb-6"
    >
      {showNewPlayerHint && (
        <section
          className="mb-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3"
          aria-label={t('menu.recommendedForYou')}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="flex-1 text-sm text-white">{t('menu.newPlayerHint')}</p>
            <button
              type="button"
              onClick={() => setHintDismissed(true)}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-gray-400 transition-colors hover:text-white"
              aria-label={t('menu.dismissHint')}
            >
              ✕
            </button>
          </div>
          <Button
            onClick={() => navigate(`/game/flash?category=${selectedCategory}`)}
            size="sm"
            className="mt-3"
          >
            {t('menu.newPlayerCta')} →
          </Button>
        </section>
      )}

      <section>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-0">
          {t('menu.selectCategory')}
        </p>
        <div className="relative">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                variant={selectedCategory === cat.id ? 'primary' : 'secondary'}
                className={`flex-none w-[72px] flex flex-col items-center justify-center !min-h-[4.5rem] !rounded-xl !px-1 !py-2.5 gap-1 sm:w-auto sm:flex-1 ${
                  selectedCategory === cat.id
                    ? '!border-primary/70 !bg-primary/15 !text-white'
                    : '!border-gray-700 !bg-gray-900/80 !text-gray-100/90'
                } menu-category-selector`}
                aria-pressed={selectedCategory === cat.id}
              >
                <span className="menu-category-selector__icon text-xl leading-none" aria-hidden="true">{cat.icon}</span>
                <span className="menu-category-selector__label text-[0.7rem] font-medium leading-tight xs:text-[0.75rem] sm:text-xs">
                  {t(cat.labelKey)}
                </span>
              </Button>
            ))}
          </div>
          {/* Right-edge fade hints horizontal overflow on mobile */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-app-bg via-app-bg/80 to-transparent sm:hidden"
          />
        </div>
      </section>

      <section className="mt-4" aria-label={t('menu.gameModes')}>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-5">
          <GameModeCard
            icon="⚡"
            title={t('menu.flash')}
            description={t('menu.flashDesc')}
            onClick={() => navigate(`/game/flash?category=${selectedCategory}`)}
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

      <section className="mt-4" aria-label={t('menu.quickActions')}>
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-0">
          {t('menu.quickActions')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/rankings"
            className="pressable flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-3 text-gray-100 transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span className="text-2xl leading-none" aria-hidden="true">🏆</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{t('menu.rankings')}</div>
              <div className="truncate text-xs text-gray-400">{t('menu.rankingsDesc')}</div>
            </div>
          </Link>
          <Link
            to="/profile"
            className="pressable flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/80 px-4 py-3 text-gray-100 transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            <span className="text-2xl leading-none" aria-hidden="true">📊</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{t('menu.yourStats')}</div>
              <div className="truncate text-xs text-gray-400">{t('menu.yourStatsDesc')}</div>
            </div>
          </Link>
        </div>
      </section>
    </PageTemplate>
  );
}
