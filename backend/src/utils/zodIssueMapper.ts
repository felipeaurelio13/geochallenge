import { ZodIssue, ZodIssueCode } from 'zod';

/**
 * Traduce un ZodIssue a un código corto y estable que el frontend puede usar
 * para localizar el mensaje, en vez de recibir el string en inglés de Zod
 * (o parsear paths técnicos). No reemplaza el mensaje top-level `Datos
 * inválidos`, que sigue siendo el fallback.
 */
export function zodIssueToFieldCode(issue: ZodIssue): string {
  switch (issue.code) {
    case ZodIssueCode.too_small:
      return 'too_short';
    case ZodIssueCode.too_big:
      return 'too_long';
    case ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return 'invalid_email';
      return 'invalid_format';
    case ZodIssueCode.invalid_type:
      return issue.received === 'undefined' ? 'required' : 'invalid_type';
    case ZodIssueCode.invalid_enum_value:
    case ZodIssueCode.invalid_literal:
    case ZodIssueCode.invalid_union:
    case ZodIssueCode.invalid_union_discriminator:
      return 'invalid_value';
    default:
      if (issue.message?.toLowerCase().includes('email')) return 'invalid_email';
      return 'invalid_value';
  }
}

export interface ValidationFieldError {
  field: string;
  code: string;
}

export function mapZodIssuesToFields(issues: ZodIssue[]): ValidationFieldError[] {
  return issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    code: zodIssueToFieldCode(issue),
  }));
}
