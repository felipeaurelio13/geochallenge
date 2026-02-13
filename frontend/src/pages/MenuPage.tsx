import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

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
    color: 'from-blue-600 to-blue-800',
  },
  {
    id: 'duel',
    icon: '⚔️',
    titleKey: 'menu.duel',
    descKey: 'menu.duelDesc',
    path: '/duel',
    color: 'from-red-600 to-red-800',
  },
  {
    id: 'challenge',
    icon: '📨',
    titleKey: 'menu.challenge',
    descKey: 'menu.challengeDesc',
    path: '/challenges',
    color: 'from-purple-600 to-purple-800',
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
    } else {
      navigate(`/${mode}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🌍</span>
            <span className="text-xl font-bold text-white">
              <span className="text-primary">Geo</span>Challenge
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              to="/rankings"
              className="text-gray-400 hover:text-white transition-colors"
            >
              🏆 {t('menu.rankings')}
            </Link>
            <Link
              to="/profile"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <span className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{user?.username}</span>
            </Link>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-red-400 transition-colors"
              title={t('auth.logout')}
              aria-label={t('auth.logout')}
            >
              🚪
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {t('menu.welcome', { name: user?.username })}
          </h1>
          <p className="text-gray-400">{t('menu.chooseMode')}</p>
        </div>

        {/* Category Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 text-center">
            {t('menu.selectCategory')}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{t(cat.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Game Modes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {gameModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleStartGame(mode.id)}
              className={`bg-gradient-to-br ${mode.color} p-6 rounded-xl text-left transition-transform hover:scale-105 hover:shadow-lg`}
            >
              <div className="text-5xl mb-4">{mode.icon}</div>
              <h3 className="text-xl font-bold text-white mb-2">
                {t(mode.titleKey)}
              </h3>
              <p className="text-white/80 text-sm">{t(mode.descKey)}</p>
            </button>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-12 bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {t('menu.yourStats')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {user?.highScore?.toLocaleString() || 0}
              </div>
              <div className="text-gray-400 text-sm">{t('stats.highScore')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {user?.gamesPlayed || 0}
              </div>
              <div className="text-gray-400 text-sm">{t('stats.gamesPlayed')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">
                {user?.wins || 0}
              </div>
              <div className="text-gray-400 text-sm">{t('stats.wins')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400">
                {user?.losses || 0}
              </div>
              <div className="text-gray-400 text-sm">{t('stats.losses')}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
