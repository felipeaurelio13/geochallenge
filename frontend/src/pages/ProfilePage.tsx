import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useApi } from '../hooks';
import { LoadingSpinner } from '../components';
import { PageHeader } from '../components/molecules/PageHeader';
import { UserAvatar } from '../components/atoms/UserAvatar';
import { Alert } from '../components/atoms/Alert';
import { StatCard } from '../components/atoms/StatCard';
import { Input } from '../components/atoms/Input';
import { FormLabel } from '../components/atoms/FormLabel';
import { Button } from '../components/atoms/Button';
import { uiStoreActions, useUiStore } from '../store/useUiStore';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();

  const hapticsEnabled = useUiStore((store) => store.hapticsEnabled);
  const soundEnabled = useUiStore((store) => store.soundEnabled);

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
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-bg-app)]">
      <PageHeader title={t('nav.profile')} backTo="/menu" backLabel={`← ${t('common.back')}`} />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:px-6 sm:py-8">
        <div className="text-center mb-8">
          <UserAvatar username={user.username} size="xl" className="mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">{user.username}</h2>
          <p className="text-gray-400">{user.email}</p>
        </div>

        {error && <Alert type="error" className="mb-6">{error}</Alert>}
        {success && <Alert type="success" className="mb-6">{success}</Alert>}

        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('profile.statistics')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value={user.highScore} label={t('stats.highScore')} color="primary" />
            <StatCard value={user.gamesPlayed} label={t('stats.gamesPlayed')} color="white" />
            <StatCard value={user.wins} label={t('stats.wins')} color="green" />
            <StatCard value={`${winRate}%`} label={t('stats.winRate')} color="yellow" />
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{t('profile.settings')}</h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="min-h-10 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 hover:text-primary/80"
              >
                {t('profile.edit')}
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <FormLabel>{t('auth.username')}</FormLabel>
              {isEditing ? (
                <Input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={20}
                />
              ) : (
                <div className="px-4 py-3 bg-gray-900 rounded-lg text-white">{user.username}</div>
              )}
            </div>

            <div>
              <FormLabel>{t('profile.language')}</FormLabel>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-2">
                  {(['es', 'en'] as const).map((lang) => (
                    <Button
                      key={lang}
                      variant={preferredLanguage === lang ? 'primary' : 'secondary'}
                      size="md"
                      onClick={() => setPreferredLanguage(lang)}
                      aria-pressed={preferredLanguage === lang}
                    >
                      {lang === 'es' ? t('profile.languageEs') : t('profile.languageEn')}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 bg-gray-900 rounded-lg text-white">
                  {preferredLanguage === 'es' ? t('profile.languageEs') : t('profile.languageEn')}
                </div>
              )}
            </div>

            <div>
              <FormLabel>{t('auth.email')}</FormLabel>
              <div className="px-4 py-3 bg-gray-900 rounded-lg text-gray-400">{user.email}</div>
            </div>

            {user.createdAt && (
              <div>
                <FormLabel>{t('profile.memberSince')}</FormLabel>
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

        <div className="bg-gray-800 rounded-xl p-6 mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            {t('profile.gamePreferences', 'Preferencias de juego')}
          </h3>

          <div className="space-y-3">
            <label className="pressable flex cursor-pointer items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 hover:border-gray-600">
              <div className="pr-4">
                <div className="text-sm font-medium text-white">
                  {t('profile.hapticsLabel', 'Vibración háptica')}
                </div>
                <div className="text-xs text-gray-400">
                  {t('profile.hapticsDescription', 'Feedback táctil en toques, aciertos y errores')}
                </div>
              </div>
              <input
                type="checkbox"
                checked={hapticsEnabled}
                onChange={(event) => uiStoreActions.setHapticsEnabled(event.target.checked)}
                className="sr-only"
                aria-label={t('profile.hapticsLabel', 'Vibración háptica')}
              />
              <div className="relative flex-shrink-0" aria-hidden="true">
                <div className={`h-6 w-11 rounded-full transition-colors duration-200 ${hapticsEnabled ? 'bg-primary' : 'bg-gray-600'}`} />
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${hapticsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </label>

            <label className="pressable flex cursor-pointer items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 hover:border-gray-600">
              <div className="pr-4">
                <div className="text-sm font-medium text-white">
                  {t('profile.soundLabel', 'Sonidos')}
                </div>
                <div className="text-xs text-gray-400">
                  {t('profile.soundDescription', 'Efectos de sonido al responder (próximamente)')}
                </div>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(event) => uiStoreActions.setSoundEnabled(event.target.checked)}
                className="sr-only"
                aria-label={t('profile.soundLabel', 'Sonidos')}
              />
              <div className="relative flex-shrink-0" aria-hidden="true">
                <div className={`h-6 w-11 rounded-full transition-colors duration-200 ${soundEnabled ? 'bg-primary' : 'bg-gray-600'}`} />
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>
        </div>
      </main>
    </div>
  );
}
