/**
 * Envío de emails transaccionales via Resend (https://resend.com) usando
 * fetch nativo de Node 20 — sin agregar el paquete `resend` como dependencia.
 *
 * Si RESEND_API_KEY no está configurada, no hace nada (no-op) y loggea un
 * warning: local dev sin la key nunca debe romper el flujo de forgot-password.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

type SupportedLanguage = 'es' | 'en';

interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function buildPasswordResetEmail(resetUrl: string, language: SupportedLanguage): EmailContent {
  if (language === 'en') {
    return {
      subject: 'Get back into GeoChallenge',
      text: `Hi!\n\nSomeone (hopefully you) asked to reset your GeoChallenge password.\n\nClick this link to choose a new one — it expires in 30 minutes:\n${resetUrl}\n\nIf you didn't ask for this, you can safely ignore this email — your password stays the same.\n\nSee you out there,\nThe GeoChallenge team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
          <h1 style="font-size: 20px; margin-bottom: 16px;">Get back into GeoChallenge 🌍</h1>
          <p style="font-size: 15px; line-height: 1.6;">Someone (hopefully you) asked to reset your GeoChallenge password.</p>
          <p style="font-size: 15px; line-height: 1.6;">Click the button below to choose a new one. This link expires in <strong>30 minutes</strong>.</p>
          <p style="margin: 28px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Reset my password</a>
          </p>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">If you didn't ask for this, you can safely ignore this email — your password stays the same.</p>
          <p style="font-size: 14px; margin-top: 24px;">See you out there,<br/>The GeoChallenge team</p>
        </div>
      `,
    };
  }

  return {
    subject: 'Recupera tu acceso a GeoChallenge',
    text: `¡Hola!\n\nAlguien (esperamos que hayas sido vos) pidió restablecer tu contraseña de GeoChallenge.\n\nHacé clic en este link para elegir una nueva — expira en 30 minutos:\n${resetUrl}\n\nSi vos no pediste esto, podés ignorar este email tranquilo — tu contraseña no cambia.\n\nNos vemos en el mapa,\nEl equipo de GeoChallenge`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">Recupera tu acceso a GeoChallenge 🌍</h1>
        <p style="font-size: 15px; line-height: 1.6;">Alguien (esperamos que hayas sido vos) pidió restablecer tu contraseña.</p>
        <p style="font-size: 15px; line-height: 1.6;">Hacé clic en el botón de abajo para elegir una nueva. Este link expira en <strong>30 minutos</strong>.</p>
        <p style="margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Restablecer mi contraseña</a>
        </p>
        <p style="font-size: 13px; color: #6b7280; line-height: 1.6;">Si vos no pediste esto, podés ignorar este email tranquilo — tu contraseña no cambia.</p>
        <p style="font-size: 14px; margin-top: 24px;">Nos vemos en el mapa,<br/>El equipo de GeoChallenge</p>
      </div>
    `,
  };
}

/**
 * Envía el email de recuperación de contraseña. Nunca lanza: si falta la API
 * key o el envío falla, loggea y retorna — el controller siempre responde 200
 * genérico para no filtrar si el email existe.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  language: 'es' | 'en'
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping send');
    return;
  }

  const from = process.env.EMAIL_FROM || 'GeoChallenge <no-reply@geochallenge.app>';
  const { subject, html, text } = buildPasswordResetEmail(resetUrl, language);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '<unreadable body>');
      console.warn(`[email] Resend responded ${response.status} sending password reset to ${to}: ${body}`);
    }
  } catch (err) {
    console.warn('[email] failed to send password reset email:', err);
  }
}
