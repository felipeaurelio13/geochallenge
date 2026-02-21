import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useFormValidation } from '../hooks';
import { AuthPageTemplate, Button, FormField, LoadingSpinner } from '../components';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) {
      return;
    }

    try {
      await register(values.username, values.email, values.password);
      navigate('/menu');
    } catch (err: any) {
      setError(err?.response?.data?.error || t('auth.registerError'));
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
          <Link to="/" className="text-sm text-gray-400 transition-colors hover:text-white">
            ← {t('common.back')}
          </Link>
        </div>
      }
    >
      {error && <div className="mb-6 rounded-lg border border-red-500 bg-red-900/50 px-4 py-3 text-sm text-red-300">{error}</div>}

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
            placeholder="GeoMaster2024"
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
            placeholder="tu@email.com"
          />
        </FormField.Root>

        <FormField.Root id="password" error={errors.password}>
          <FormField.Label>{t('auth.password')}</FormField.Label>
          <FormField.Input
            type="password"
            name="password"
            value={values.password}
            onChange={handleChange}
            required
            minLength={6}
            placeholder="********"
          />
          <FormField.Hint>{t('auth.passwordHint')}</FormField.Hint>
        </FormField.Root>

        <FormField.Root id="confirmPassword" error={errors.confirmPassword}>
          <FormField.Label>{t('auth.confirmPassword')}</FormField.Label>
          <FormField.Input
            type="password"
            name="confirmPassword"
            value={values.confirmPassword}
            onChange={handleChange}
            required
            placeholder="********"
          />
        </FormField.Root>

        <Button type="submit" disabled={isLoading} fullWidth size="lg">
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="text-sm">Procesando...</span>
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
