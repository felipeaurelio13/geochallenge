/**
 * Error estructurado con un código machine-readable para que el frontend pueda
 * localizar el mensaje en vez de mostrar el string en español hardcodeado.
 *
 * `message` es SIEMPRE el string en español que se mostraba antes de este
 * cambio — queda como fallback si el frontend todavía no reconoce `code`.
 * Esto hace el cambio puramente aditivo/no-breaking.
 */
export class AppError extends Error {
  code: string;
  status: number;
  params?: Record<string, unknown>;

  constructor(code: string, status: number, message: string, params?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.params = params;
  }
}
