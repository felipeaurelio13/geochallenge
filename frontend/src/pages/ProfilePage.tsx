import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useApi } from '../hooks';
import { LoadingSpinner } from '../components';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [preferredLanguage, setPreferredLanguage] = useState<'es' | 'en'>(user?.preferredLanguage || 'es');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { mutate, isLoading } = useApi(api.updateProfile);

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!user) {
      return;
    }

    const optimisticUser = {
      ...user,
      username,
      preferredLanguage,
    };

    try {
      const updatedUser = await mutate(
        () => api.updateProfile({ username, preferredLanguage }),
        { optimisticData: optimisticUser, rollbackData: user }
      );

      updateUser(updatedUser);
      i18n.changeLanguage(preferredLanguage);
      setSuccess(t('profile.updateSuccess'));
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || t('profile.updateError'));
    }
  };

  const handleCancel = () => {
    setUsername(user?.username || '');
    setPreferredLanguage(user?.preferredLanguage || 'es');
    setIsEditing(false);
    setError('');
  };

  if (!user) {
    return (
      <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const winRate = user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;

  return (
    <div className="h-full min-h-0 bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/menu" className="text-gray-400 hover:text-white transition-colors">
            ← {t('common.back')}
          </Link>
          <h1 className="text-xl font-bold text-white">{t('profile.title')}</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-4xl font-bold text-white mx-auto mb-4">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl font-bold text-white">{user.username}</h2>
          <p className="text-gray-400">{user.email}</p>
        </div>

        {error && <div className="mb-6 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg">{error}</div>}
        {success && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-500 text-green-300 rounded-lg">{success}</div>
        )}

        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('profile.statistics')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-primary">{user.highScore.toLocaleString()}</div>
              <div className="text-sm text-gray-400">{t('stats.highScore')}</div>
            </div>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-white">{user.gamesPlayed}</div>
              <div className="text-sm text-gray-400">{t('stats.gamesPlayed')}</div>
            </div>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{user.wins}</div>
              <div className="text-sm text-gray-400">{t('stats.wins')}</div>
            </div>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-yellow-400">{winRate}%</div>
              <div className="text-sm text-gray-400">{t('stats.winRate')}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{t('profile.settings')}</h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                {t('profile.edit')}
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('auth.username')}</label>
              {isEditing ? (
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary transition-colors"
                  minLength={3}
                  maxLength={20}
                />
              ) : (
                <div className="px-4 py-3 bg-gray-900 rounded-lg text-white">{user.username}</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('profile.language')}</label>
              {isEditing ? (
                <select
                  value={preferredLanguage}
                  onChange={(event) => setPreferredLanguage(event.target.value as 'es' | 'en')}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="es">Espanol</option>
                  <option value="en">English</option>
                </select>
              ) : (
                <div className="px-4 py-3 bg-gray-900 rounded-lg text-white">
                  {preferredLanguage === 'es' ? 'Espanol' : 'English'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t('auth.email')}</label>
              <div className="px-4 py-3 bg-gray-900 rounded-lg text-gray-400">{user.email}</div>
            </div>

            {user.createdAt && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('profile.memberSince')}</label>
                <div className="px-4 py-3 bg-gray-900 rounded-lg text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <LoadingSpinner size="sm" /> : t('common.save')}
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
