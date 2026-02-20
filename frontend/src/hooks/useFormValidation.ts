import { useMemo, useState } from 'react';
import { z } from 'zod';

type ErrorMap<T> = Partial<Record<keyof T, string>>;

export function useFormValidation<T extends Record<string, any>>(schema: z.ZodType<T>, initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ErrorMap<T>>({});

  const validate = () => {
    const result = schema.safeParse(values);

    if (result.success) {
      setErrors({});
      return true;
    }

    const fieldErrors = result.error.flatten().fieldErrors;
    const mappedErrors = Object.entries(fieldErrors).reduce<ErrorMap<T>>((acc, [key, value]) => {
      const messages = Array.isArray(value) ? value : [];
      acc[key as keyof T] = (messages[0] as string | undefined) ?? '';
      return acc;
    }, {});

    setErrors(mappedErrors);
    return false;
  };

  const setFieldValue = <K extends keyof T>(key: K, fieldValue: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: fieldValue }));

    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const isValid = useMemo(() => schema.safeParse(values).success, [schema, values]);

  return {
    values,
    errors,
    isValid,
    setValues,
    setFieldValue,
    setErrors,
    validate,
  };
}
