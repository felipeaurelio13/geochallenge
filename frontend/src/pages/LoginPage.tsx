import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useFormValidation } from '../hooks';
import { LoadingSpinner } from '../components';

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().trim().min(1, 'Ingresa tu contraseña'),
});

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();

  const { values, errors, setFieldValue, isValid, validate } = useFormValidation(loginSchema, {
    email: '',
    password: '',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isBusy = isLoading || isSubmitting;

  const getErrorMessage = (err: any) => {
    if (err?.response?.data?.retryAfterSeconds) {
      const seconds = Number(err.response.data.retryAfterSeconds);
      const minutes = Math.ceil(seconds / 60);
      return `Demasiados intentos. Intenta de nuevo en ${minutes} min.`;
    }

    if (err instanceof Error && err.message) {
      return err.message;
    }

    return err?.response?.data?.error || t('auth.loginError');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login(values.email, values.password);
      navigate('/menu');
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) {
      setError('');
    }

    setFieldValue(e.target.name as 'email' | 'password', e.target.value);
  };

  return (
    <div className="app-shell">
      <main className="mx-auto flex h-full min-h-0 w-full max-w-md flex-1 flex-col justify-center px-4 py-6 sm:py-8">
        <div className="text-center mb-5">
          <Link to="/" className="inline-flex flex-col items-center gap-2">
            <span className="text-4xl">🌍</span>
            <h1 className="text-2xl font-bold text-white">
              <span className="text-primary">Geo</span>Challenge
            </h1>
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/95 p-5 shadow-xl shadow-black/20 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">{t('auth.login')}</h2>

          {error && <div className="bg-red-900/40 border border-red-500/60 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={values.email}
                onChange={handleChange}
                required
                autoFocus
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/70 focus:border-primary transition-colors"
                placeholder="tu@email.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-300">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={values.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-24 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/70 focus:border-primary transition-colors"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-1 right-1 min-h-10 rounded-lg px-3 text-xs font-semibold text-primary hover:bg-gray-700/60 focus:outline-none focus:ring-2 focus:ring-primary/70"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  aria-pressed={showPassword}
                >
                  {showPassword ? t('auth.hide') : t('auth.show')}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-300">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={isBusy || !isValid}
              className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold border border-primary/80 shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-[0.99] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:opacity-60 disabled:cursor-wait disabled:scale-100 flex items-center justify-center gap-2"
            >
              {isBusy ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">Procesando...</span>
                </>
              ) : (
                t('auth.loginButton')
              )}
            </button>

            {!isValid && (
              <p className="text-xs text-gray-400" aria-live="polite">
                {t('auth.completeFieldsHint')}
              </p>
            )}
          </form>

          <div className="mt-5 text-center">
            <p className="text-gray-400 text-sm">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="text-primary hover:underline font-medium">
                {t('auth.registerHere')}
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
