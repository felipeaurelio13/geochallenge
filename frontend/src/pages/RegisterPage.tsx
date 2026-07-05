import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useFormValidation } from '../hooks';
import { AuthPageTemplate, Button, FormField, LoadingSpinner } from '../components';
import { Alert } from '../components/atoms/Alert';

const registerSchema = z
  .object({
    username: z.string().trim().min(3, 'Mínimo 3 caracteres').max(20, 'Máximo 20 caracteres'),
    email: z.string().trim().email('Email inválido'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

// QA fix: detecta email/username ya registrados incluso antes de que el
// backend mande `code: 'AUTH_EMAIL_TAKEN' | 'AUTH_USERNAME_TAKEN'` — hace
// fallback a un match de texto sobre el mensaje en español/inglés.
const ACCOUNT_TAKEN_CODES = new Set(['AUTH_EMAIL_TAKEN', 'AUTH_USERNAME_TAKEN']);
const ACCOUNT_TAKEN_TEXT_HINTS = ['ya está registrado', 'ya existe', 'already registered', 'already exists', 'already taken'];

function isAccountTakenError(err: any, message: string): boolean {
  const code = err?.response?.data?.code;
  if (code && ACCOUNT_TAKEN_CODES.has(code)) {
    return true;
  }
  const normalized = message.toLowerCase();
  return ACCOUNT_TAKEN_TEXT_HINTS.some((hint) => normalized.includes(hint));
}

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();

  const { values, errors, setFieldValue, validate } = useFormValidation(registerSchema, {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [showAccountTakenLink, setShowAccountTakenLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowAccountTakenLink(false);

    if (!validate()) {
      return;
    }

    try {
      await register(values.username, values.email, values.password);
      navigate('/menu');
    } catch (err: any) {
      const message = err?.response?.data?.error || t('auth.registerError');
      setError(message);
      setShowAccountTakenLink(isAccountTakenError(err, message));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFieldValue(e.target.name as keyof typeof values, e.target.value);
  };

  return (
    <AuthPageTemplate
      title={t('auth.register')}
      footer={
        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-app-subtle transition-colors hover:text-app-text">
            ← {t('common.back')}
          </Link>
        </div>
      }
    >
      {error && (
        <Alert type="error" className="mb-6">
          <p>{error}</p>
          {showAccountTakenLink && (
            <p className="mt-1">
              <Link to="/login" className="font-semibold underline">
                {t('auth.hasAccount')} {t('auth.loginHere')}
              </Link>
            </p>
          )}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField.Root id="username" error={errors.username}>
          <FormField.Label>{t('auth.username')}</FormField.Label>
          <FormField.Input
            type="text"
            name="username"
            value={values.username}
            onChange={handleChange}
            required
            minLength={3}
            maxLength={20}
            placeholder={t("auth.usernamePlaceholder", "Your username")}
          />
        </FormField.Root>

        <FormField.Root id="email" error={errors.email}>
          <FormField.Label>{t('auth.email')}</FormField.Label>
          <FormField.Input
            type="email"
            name="email"
            value={values.email}
            onChange={handleChange}
            required
            placeholder={t("auth.emailPlaceholder", "you@example.com")}
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
              minLength={6}
              autoComplete="new-password"
              className="pr-24"
              placeholder={t("auth.passwordPlaceholder", "Your password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-1 right-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-xs font-semibold text-primary hover:bg-gray-700/60 focus:outline-none focus:ring-2 focus:ring-primary/70"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              aria-pressed={showPassword}
            >
              {showPassword ? t('auth.hide') : t('auth.show')}
            </button>
          </div>
          <FormField.Hint>{t('auth.passwordHint')}</FormField.Hint>
        </FormField.Root>

        <FormField.Root
          id="confirmPassword"
          error={
            errors.confirmPassword ||
            (values.confirmPassword && values.password !== values.confirmPassword
              ? t('auth.passwordMismatch')
              : undefined)
          }
        >
          <FormField.Label>{t('auth.confirmPassword')}</FormField.Label>
          <div className="relative">
            <FormField.Input
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={values.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
              className="pr-24"
              placeholder={t("auth.passwordPlaceholder", "Your password")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute inset-y-1 right-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-xs font-semibold text-primary hover:bg-gray-700/60 focus:outline-none focus:ring-2 focus:ring-primary/70"
              aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              aria-pressed={showConfirmPassword}
            >
              {showConfirmPassword ? t('auth.hide') : t('auth.show')}
            </button>
          </div>
        </FormField.Root>

        <Button type="submit" disabled={isLoading} fullWidth size="lg">
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="text-sm">{t('common.processing')}</span>
            </>
          ) : (
            t('auth.registerButton')
          )}
        </Button>
      </form>

      <div className="mt-5 text-center">
        <p className="text-sm text-gray-400">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-primary hover:underline">
            {t('auth.loginHere')}
          </Link>
        </p>
      </div>
    </AuthPageTemplate>
  );
}
