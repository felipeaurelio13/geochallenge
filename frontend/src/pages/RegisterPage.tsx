import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    if (formData.password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    try {
      await register(formData.username, formData.email, formData.password);
      navigate('/menu');
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.registerError'));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="app-shell">
      <main className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col justify-center px-4 py-6 sm:py-8">
        <div className="text-center mb-5">
          <Link to="/" className="inline-block">
            <span className="text-4xl">🌍</span>
            <h1 className="text-2xl font-bold text-white mt-2">
              <span className="text-primary">Geo</span>Challenge
            </h1>
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/95 p-5 shadow-xl shadow-black/20 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            {t('auth.register')}
          </h2>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-200 mb-2">
                {t('auth.username')}
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                minLength={3}
                maxLength={20}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/70 focus:border-primary transition-colors"
                placeholder="GeoMaster2024"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/70 focus:border-primary transition-colors"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
                {t('auth.password')}
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/70 focus:border-primary transition-colors"
                placeholder="********"
              />
              <p className="mt-1 text-xs text-gray-500">{t('auth.passwordHint')}</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-200 mb-2">
                {t('auth.confirmPassword')}
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/70 focus:border-primary transition-colors"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-primary text-white font-bold rounded-xl shadow-md shadow-primary/30 border border-primary/80 hover:bg-primary/85 active:scale-[0.99] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:opacity-50 disabled:cursor-wait disabled:scale-100 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">Procesando...</span>
                </>
              ) : (
                t('auth.registerButton')
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-gray-400 text-sm">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-primary hover:underline">
                {t('auth.loginHere')}
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors text-sm">
            ← {t('common.back')}
          </Link>
        </div>
      </main>

    </div>
  );
}
