import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormValidation } from '../hooks';
import { AuthPageTemplate, Button, FormField, LoadingSpinner } from '../components';
import { Alert } from '../components/atoms/Alert';
import { api } from '../services/api';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('auth.invalidEmail'),
});

export function ForgotPasswordPage() {
  const { t } = useTranslation();

  const { values, errors, setFieldValue, isValid, validate } = useFormValidation(forgotPasswordSchema, {
    email: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFieldValue('email', e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.forgotPassword(values.email);
    } catch {
      // Anti-enumeration: nunca mostramos una UI distinta si falla o si la
      // cuenta no existe. Siempre terminamos en el mismo estado de éxito.
    } finally {
      setIsSubmitting(false);
      setSent(true);
    }
  };

  return (
    <AuthPageTemplate
      title={t('auth.forgotTitle')}
      footer={
        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-app-subtle transition-colors hover:text-app-text">
            ← {t('common.back')}
          </Link>
        </div>
      }
    >
      {sent ? (
        <Alert type="success" role="status" aria-live="polite">
          {t('auth.forgotSent')}
        </Alert>
      ) : (
        <>
          <p className="mb-6 text-center text-sm text-app-subtle">{t('auth.forgotSubtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <FormField.Root id="email" error={errors.email ? t(errors.email) : ''}>
              <FormField.Label>{t('auth.email')}</FormField.Label>
              <FormField.Input
                type="email"
                name="email"
                value={values.email}
                onChange={handleChange}
                required
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                placeholder={t('auth.emailPlaceholder', 'you@example.com')}
              />
            </FormField.Root>

            <Button type="submit" disabled={isSubmitting || !isValid} fullWidth size="lg">
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">{t('common.processing')}</span>
                </>
              ) : (
                t('auth.forgotPassword')
              )}
            </Button>
          </form>
        </>
      )}

      <p className="mt-5 text-center text-sm text-gray-400">
        <Link to="/login" className="text-primary hover:underline">
          {t('auth.loginHere')}
        </Link>
      </p>
    </AuthPageTemplate>
  );
}
