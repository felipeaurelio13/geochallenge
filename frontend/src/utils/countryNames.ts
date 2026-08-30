const LATIN_AMERICAN_SPANISH_EXONYMS: Record<string, string> = {
  // WebKit actualmente entrega el endónimo francés para CI incluso con es-CL.
  CI: 'Costa de Marfil',
};

/**
 * Uses the platform country catalog instead of maintaining a second list of
 * translated names. If the API did not provide a valid ISO 3166-1 alpha-2
 * code, preserve the original text.
 */
export function getLocalizedCountryName(
  countryCode: string | null | undefined,
  language: string,
  fallback: string,
): string {
  if (!countryCode) return fallback;

  try {
    // El español de Latinoamérica conserva los exónimos esperados en Chile
    // (por ejemplo, "Costa de Marfil") sin mantener un mapa propio.
    const displayLanguage = language.toLowerCase() === 'es' ? 'es-CL' : language;
    const normalizedCode = countryCode.trim().toUpperCase();
    const displayNames = new Intl.DisplayNames([displayLanguage], { type: 'region' });
    const localizedName = displayNames.of(normalizedCode) ?? fallback;

    return displayLanguage === 'es-CL'
      ? LATIN_AMERICAN_SPANISH_EXONYMS[normalizedCode] ?? localizedName
      : localizedName;
  } catch {
    return fallback;
  }
}
