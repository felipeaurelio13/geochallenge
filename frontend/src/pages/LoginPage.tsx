import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useFormValidation } from '../hooks';
import { AuthPageTemplate, Button, FormField, LoadingSpinner } from '../components';
import { Alert } from '../components/atoms/Alert';

// Mensajes vienen del i18n en runtime — el schema sólo trae claves.
const loginSchema = z.object({
  email: z.string().trim().email('auth.invalidEmail'),
  password: z.string().trim().min(1, 'auth.passwordRequired'),
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
  const emailFilled = values.email.trim().length > 0;
  const passwordFilled = values.password.trim().length > 0;
  // QA fix ME-1: el helper antes decía "Completa correo y contraseña" incluso
  // si los dos campos estaban llenos pero el email era inválido. Ahora cambia
  // según el estado real: vacío vs formato malo.
  const helperKey = !emailFilled || !passwordFilled
    ? 'auth.completeFieldsHint'
    : !isValid
      ? 'auth.invalidEmail'
      : null;

  const getErrorMessage = (err: any) => {
    if (err?.response?.data?.retryAfterSeconds) {
      const seconds = Number(err.response.data.retryAfterSeconds);
      const minutes = Math.ceil(seconds / 60);
      return t('auth.rateLimitError', { minutes });
    }

    if (err?.response?.status === 401) {
      // QA fix CR-1: el backend a veces devuelve 401 sin body o con body
      // vacío. Sin este guard, getErrorMessage caía al fallback genérico
      // ("Login failed"), pero el axios interceptor además rechaza con un
      // `new Error('')` cuando el backendMessage es vacío, así que el toast
      // a veces no aparecía. Mensaje específico para credenciales inválidas.
      return t('auth.loginFailed', 'Email o contraseña incorrectos');
    }

    if (err instanceof Error && err.message && err.message.trim().length > 0) {
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
      // Garantizamos siempre un mensaje no vacío para que el Alert renderice.
      const msg = getErrorMessage(err) || t('auth.loginError');
      setError(msg);
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
          <Link to="/" className="text-sm text-app-subtle transition-colors hover:text-app-text">
            ← {t('common.back')}
          </Link>
        </div>
      }
    >
      {error && (
        <Alert type="error" className="mb-6" role="alert" aria-live="polite">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField.Root id="email" error={errors.email ? t(errors.email) : ''}>
          <FormField.Label>{t('auth.email')}</FormField.Label>
          <FormField.Input
            type="email"
            name="email"
            value={values.email}
            onChange={handleChange}
            required
            autoFocus={typeof window !== 'undefined' && !('ontouchstart' in window)}
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            placeholder={t("auth.emailPlaceholder", "you@example.com")}
          />
        </FormField.Root>

        <FormField.Root id="password" error={errors.password ? t(errors.password) : ''}>
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
              placeholder={t("auth.passwordPlaceholder", "Your password")}
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

        {helperKey && !isBusy ? <p className="text-xs text-gray-500">{t(helperKey)}</p> : null}

        <Button type="submit" disabled={isBusy || !isValid} fullWidth size="lg">
          {isBusy ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="text-sm">{t('common.processing')}</span>
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
