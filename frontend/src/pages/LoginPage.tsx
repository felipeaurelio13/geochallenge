import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useFormValidation } from '../hooks';
import { AuthPageTemplate, Button, FormField, LoadingSpinner } from '../components';

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
    <AuthPageTemplate
      title={t('auth.login')}
      footer={
        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-400 transition-colors hover:text-white">
            ← {t('common.back')}
          </Link>
        </div>
      }
    >
      {error && <div className="mb-6 rounded-lg border border-red-500/60 bg-red-900/40 px-4 py-3 text-sm text-red-200">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField.Root id="email" error={errors.email}>
          <FormField.Label>{t('auth.email')}</FormField.Label>
          <FormField.Input
            type="email"
            name="email"
            value={values.email}
            onChange={handleChange}
            required
            autoFocus
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            placeholder="tu@email.com"
          />
        </FormField.Root>

        <FormField.Root id="password" error={errors.password}>
          <FormField.Label>{t('auth.password')}</FormField.Label>
          <div className="relative">
            <FormField.Input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={values.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              className="pr-24"
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
        </FormField.Root>

        {!isValid && !isBusy ? <p className="text-xs text-gray-500">{t('auth.completeFieldsHint')}</p> : null}

        <Button type="submit" disabled={isBusy || !isValid} fullWidth size="lg">
          {isBusy ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="text-sm">Procesando...</span>
            </>
          ) : (
            t('auth.loginButton')
          )}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-400">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="text-primary hover:underline">
          {t('auth.registerHere')}
        </Link>
      </p>
    </AuthPageTemplate>
  );
}
