import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormValidation } from '../hooks';
import { AuthPageTemplate, Button, FormField, LoadingSpinner } from '../components';
import { Alert } from '../components/atoms/Alert';
import { api } from '../services/api';
import { uiStoreActions } from '../store/useUiStore';

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, 'auth.passwordTooShort'),
    confirmNewPassword: z.string().min(6, 'auth.passwordTooShort'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'auth.passwordMismatch',
  });

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const { values, errors, setFieldValue, isValid, validate } = useFormValidation(resetPasswordSchema, {
    newPassword: '',
    confirmNewPassword: '',
  });

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) {
      setError('');
    }
    setFieldValue(e.target.name as 'newPassword' | 'confirmNewPassword', e.target.value);
  };

  const getErrorMessage = (err: any) => {
    const code = err?.response?.data?.code;
    if (code === 'AUTH_RESET_TOKEN_INVALID' || code === 'AUTH_RESET_TOKEN_EXPIRED') {
      return null;
    }

    if (err instanceof Error && err.message && err.message.trim().length > 0) {
      return err.message;
    }

    return err?.response?.data?.error || t('auth.resetTitle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.resetPassword(token, values.newPassword);
      uiStoreActions.pushToast({ type: 'success', message: t('auth.resetSuccess') });
      navigate('/login');
    } catch (err: any) {
      const message = getErrorMessage(err);
      if (message === null) {
        setTokenInvalid(true);
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tokenInvalid) {
    return (
      <AuthPageTemplate
        title={t('auth.resetTitle')}
        footer={
          <div className="mt-4 text-center">
            <Link to="/" className="text-sm text-app-subtle transition-colors hover:text-app-text">
              ← {t('common.back')}
            </Link>
          </div>
        }
      >
        <Alert type="error" role="alert" aria-live="polite">
          {t('auth.resetTokenInvalid')}
        </Alert>
        <Link to="/forgot-password" className="mt-5 block">
          <Button type="button" fullWidth size="lg">
            {t('auth.resetRequestNew')}
          </Button>
        </Link>
      </AuthPageTemplate>
    );
  }

  return (
    <AuthPageTemplate
      title={t('auth.resetTitle')}
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
        <FormField.Root id="newPassword" error={errors.newPassword ? t(errors.newPassword) : ''}>
          <FormField.Label>{t('auth.newPassword')}</FormField.Label>
          <div className="relative">
            <FormField.Input
              type={showNewPassword ? 'text' : 'password'}
              name="newPassword"
              value={values.newPassword}
              onChange={handleChange}
              required
              minLength={6}
              autoComplete="new-password"
              className="pr-24"
              placeholder={t('auth.passwordPlaceholder', 'Your password')}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute inset-y-1 right-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-xs font-semibold text-primary hover:bg-gray-700/60 focus:outline-none focus:ring-2 focus:ring-primary/70"
              aria-label={showNewPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              aria-pressed={showNewPassword}
            >
              {showNewPassword ? t('auth.hide') : t('auth.show')}
            </button>
          </div>
          <FormField.Hint>{t('auth.passwordHint')}</FormField.Hint>
        </FormField.Root>

        <FormField.Root
          id="confirmNewPassword"
          error={errors.confirmNewPassword ? t(errors.confirmNewPassword) : ''}
        >
          <FormField.Label>{t('auth.confirmNewPassword')}</FormField.Label>
          <div className="relative">
            <FormField.Input
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmNewPassword"
              value={values.confirmNewPassword}
              onChange={handleChange}
              required
              minLength={6}
              autoComplete="new-password"
              className="pr-24"
              placeholder={t('auth.passwordPlaceholder', 'Your password')}
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

        <Button type="submit" disabled={isSubmitting || !isValid} fullWidth size="lg">
          {isSubmitting ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="text-sm">{t('common.processing')}</span>
            </>
          ) : (
            t('auth.resetTitle')
          )}
        </Button>
      </form>
    </AuthPageTemplate>
  );
}
