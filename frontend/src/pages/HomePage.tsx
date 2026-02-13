import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const APP_VERSION = '1.0.1';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center max-w-2xl">
          {/* Logo/Icon */}
          <div className="text-8xl mb-6">🌍</div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            <span className="text-primary">Geo</span>Challenge
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-gray-400 mb-8">
            {t('home.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link
                to="/menu"
                className="px-8 py-4 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors text-lg"
              >
                {t('home.play')}
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-8 py-4 bg-primary text-white font-bold rounded-lg hover:bg-primary/80 transition-colors text-lg"
                >
                  {t('home.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-8 py-4 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors text-lg"
                >
                  {t('home.register')}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
          <div className="text-center p-6 bg-gray-800 rounded-xl">
            <div className="text-4xl mb-4">🏳️</div>
            <h3 className="text-lg font-semibold text-white mb-2">{t('home.features.flags')}</h3>
            <p className="text-gray-400 text-sm">{t('home.features.flagsDesc')}</p>
          </div>
          <div className="text-center p-6 bg-gray-800 rounded-xl">
            <div className="text-4xl mb-4">🗺️</div>
            <h3 className="text-lg font-semibold text-white mb-2">{t('home.features.maps')}</h3>
            <p className="text-gray-400 text-sm">{t('home.features.mapsDesc')}</p>
          </div>
          <div className="text-center p-6 bg-gray-800 rounded-xl">
            <div className="text-4xl mb-4">⚔️</div>
            <h3 className="text-lg font-semibold text-white mb-2">{t('home.features.multiplayer')}</h3>
            <p className="text-gray-400 text-sm">{t('home.features.multiplayerDesc')}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-500 text-sm">
        <p>GeoChallenge v{APP_VERSION} &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
