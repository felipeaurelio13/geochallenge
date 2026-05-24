/**
 * Validates the Cinema & Geography question dataset editorial quality.
 * Exits 0 even when all questions are needs_sources (valid editorial state).
 * Exits 1 only on schema/structural failures.
 */
import { loadFullCinemaGeoCatalog, type CinemaGeoQuestion } from '../utils/cinemaGeoCatalog.js';

export type { CinemaGeoQuestion };

const VALID_TYPES = new Set([
  'movie_from_sequence_location',
  'sequence_location',
  'fiction_vs_real_location',
  'represented_vs_filmed',
  'movie_from_filming_map',
  'film_from_iconic_set',
  'odd_one_out',
]);

const VALID_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);
const VALID_STATUSES = new Set(['approved', 'needs_sources', 'rejected']);
const VALID_CONFIDENCES = new Set(['high', 'medium', 'low']);
const VALID_STRATEGIES = new Set(['none', 'movie_card', 'iconic_location', 'map', 'generic_cinema']);

const GEOGRAPHY_WRAPPER_PATTERNS = [
  /¿en qué país está\b/i,
  /¿en qué ciudad está\b/i,
  /¿dónde está\b/i,
  /¿dónde se encuentra\b/i,
  /in which country is\b/i,
  /in which city is\b/i,
  /where is\b/i,
];

/** Returns an array of error strings for a single question. Empty = valid. */
export function validateCinemaGeoQuestion(q: CinemaGeoQuestion): string[] {
  const errors: string[] = [];
  const prefix = `[${q.id ?? '(sin id)'}]`;

  // id
  if (!q.id || typeof q.id !== 'string' || q.id.includes(' ')) {
    errors.push(`${prefix} 'id' debe ser una cadena sin espacios`);
  }

  // type
  if (!VALID_TYPES.has(q.type)) {
    errors.push(`${prefix} tipo inválido: "${q.type}"`);
  }

  // difficulty
  if (!VALID_DIFFICULTIES.has(q.difficulty)) {
    errors.push(`${prefix} dificultad inválida: "${q.difficulty}"`);
  }

  // reviewStatus
  if (!VALID_STATUSES.has(q.reviewStatus)) {
    errors.push(`${prefix} reviewStatus inválido: "${q.reviewStatus}"`);
  }

  // confidence
  if (!VALID_CONFIDENCES.has(q.confidence)) {
    errors.push(`${prefix} confidence inválida: "${q.confidence}"`);
  }

  // prompt
  if (!q.prompt || typeof q.prompt !== 'object') {
    errors.push(`${prefix} 'prompt' debe ser un objeto`);
  } else {
    if (!q.prompt.es || !q.prompt.es.trim()) errors.push(`${prefix} prompt.es está vacío`);
    if (!q.prompt.en || !q.prompt.en.trim()) errors.push(`${prefix} prompt.en está vacío`);
  }

  // correctAnswer
  if (!q.correctAnswer || !q.correctAnswer.trim()) {
    errors.push(`${prefix} correctAnswer está vacío`);
  }

  // options
  if (!Array.isArray(q.options)) {
    errors.push(`${prefix} 'options' debe ser un array`);
  } else {
    if (q.options.length !== 4) {
      errors.push(`${prefix} options debe tener exactamente 4 elementos (tiene ${q.options.length})`);
    }
    const unique = new Set(q.options);
    if (unique.size !== q.options.length) {
      errors.push(`${prefix} options contiene duplicados`);
    }
    if (q.correctAnswer && !q.options.includes(q.correctAnswer)) {
      errors.push(`${prefix} correctAnswer "${q.correctAnswer}" no está en options`);
    }
  }

  // movie (required for all types; for odd_one_out year=0 is acceptable)
  if (!q.movie || typeof q.movie !== 'object') {
    errors.push(`${prefix} 'movie' debe ser un objeto`);
  } else {
    if (!q.movie.title || !q.movie.title.trim()) errors.push(`${prefix} movie.title está vacío`);
    if (typeof q.movie.year !== 'number') errors.push(`${prefix} movie.year debe ser un número`);
  }

  // geoContext
  if (!q.geoContext || typeof q.geoContext !== 'object') {
    errors.push(`${prefix} 'geoContext' debe ser un objeto`);
  } else {
    if (q.geoContext.lat !== undefined) {
      if (typeof q.geoContext.lat !== 'number' || q.geoContext.lat < -90 || q.geoContext.lat > 90) {
        errors.push(`${prefix} geoContext.lat inválido: ${q.geoContext.lat}`);
      }
    }
    if (q.geoContext.lng !== undefined) {
      if (typeof q.geoContext.lng !== 'number' || q.geoContext.lng < -180 || q.geoContext.lng > 180) {
        errors.push(`${prefix} geoContext.lng inválido: ${q.geoContext.lng}`);
      }
    }
  }

  // mapPins required for movie_from_filming_map
  if (q.type === 'movie_from_filming_map') {
    if (!Array.isArray(q.mapPins) || q.mapPins.length === 0) {
      errors.push(`${prefix} movie_from_filming_map requiere mapPins con al menos un pin`);
    } else {
      for (const pin of q.mapPins) {
        if (!pin.label || typeof pin.lat !== 'number' || typeof pin.lng !== 'number') {
          errors.push(`${prefix} mapPin inválido: ${JSON.stringify(pin)}`);
        }
      }
    }
  }

  // visual
  if (!q.visual || typeof q.visual !== 'object') {
    errors.push(`${prefix} 'visual' debe ser un objeto`);
  } else {
    if (!VALID_STRATEGIES.has(q.visual.strategy)) {
      errors.push(`${prefix} visual.strategy inválida: "${q.visual.strategy}"`);
    }
    // alt required when strategy is not 'none'
    if (q.visual.strategy !== 'none') {
      if (!q.visual.alt || !q.visual.alt.es || !q.visual.alt.en) {
        errors.push(`${prefix} visual.alt (es+en) requerido cuando strategy !== "none"`);
      }
    }
  }

  // approved-specific checks
  if (q.reviewStatus === 'approved') {
    if (!Array.isArray(q.sourceClaims) || q.sourceClaims.length === 0) {
      errors.push(`${prefix} pregunta approved debe tener sourceClaims no vacío`);
    } else {
      const hasRealUrl = q.sourceClaims.some((sc) => sc.sourceUrl && sc.sourceUrl.trim());
      if (!hasRealUrl) {
        errors.push(`${prefix} pregunta approved necesita al menos un sourceClaim con sourceUrl real`);
      }
    }
    // iconic_location or map strategy should have url or assetId
    if (q.visual.strategy === 'iconic_location' || q.visual.strategy === 'map') {
      if (!q.visual.url && !q.visual.assetId) {
        errors.push(`${prefix} strategy "${q.visual.strategy}" en approved requiere visual.url o visual.assetId`);
      }
    }
  }

  return errors;
}

/** Warns (but does not error) when a prompt looks like wrapped geography trivia. */
function checkGeographyWrapper(q: CinemaGeoQuestion): string[] {
  const warnings: string[] = [];
  const prefix = `[${q.id}] WARN`;
  const promptText = `${q.prompt.es} ${q.prompt.en}`.toLowerCase();
  const movieMentioned = q.movie.title && promptText.includes(q.movie.title.toLowerCase().substring(0, 5));

  for (const pattern of GEOGRAPHY_WRAPPER_PATTERNS) {
    if (pattern.test(promptText) && !movieMentioned) {
      warnings.push(`${prefix} prompt puede ser geografía genérica disfrazada: "${q.prompt.es.substring(0, 80)}..."`);
      break;
    }
  }
  return warnings;
}

async function main() {
  let questions: CinemaGeoQuestion[];
  try {
    questions = loadFullCinemaGeoCatalog();
  } catch (err) {
    console.error('❌ No se pudo cargar el catálogo cinema-geo:', err);
    process.exit(1);
  }

  if (questions.length === 0) {
    console.log('⚠️  cinema-geo: catálogo vacío — es válido durante bootstrap.');
    process.exit(0);
  }

  // Duplicate ID check
  const seenIds = new Set<string>();
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  for (const q of questions) {
    if (q.id && seenIds.has(q.id)) {
      allErrors.push(`ID duplicado: "${q.id}"`);
    } else if (q.id) {
      seenIds.add(q.id);
    }

    const errors = validateCinemaGeoQuestion(q);
    allErrors.push(...errors);

    const warnings = checkGeographyWrapper(q);
    allWarnings.push(...warnings);
  }

  // Count by status
  const approvedCount = questions.filter((q) => q.reviewStatus === 'approved').length;
  const needsSourcesCount = questions.filter((q) => q.reviewStatus === 'needs_sources').length;
  const rejectedCount = questions.filter((q) => q.reviewStatus === 'rejected').length;

  console.log(`📋 cinema-geo: ${questions.length} preguntas (${approvedCount} approved, ${needsSourcesCount} needs_sources, ${rejectedCount} rejected)`);

  for (const w of allWarnings) {
    console.warn(`  ⚠️  ${w}`);
  }

  if (allErrors.length > 0) {
    console.error(`\n❌ cinema-geo validation falló (${allErrors.length} errores):`);
    for (const e of allErrors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  if (approvedCount === 0) {
    console.log('⚠️  cinema-geo: 0 preguntas approved — el catálogo está en revisión editorial. No se sembrarán preguntas nuevas.');
  } else {
    console.log(`✅ cinema-geo: ${approvedCount} preguntas listas para seed.`);
  }

  console.log('✅ cinema-geo validation OK.');
}

// Only auto-execute when this file is the entry point (not when imported by tests)
if (process.argv[1]?.endsWith('validate-cinema-geo.ts') || process.argv[1]?.endsWith('validate-cinema-geo.js')) {
  main().catch((err) => {
    console.error('❌ Error inesperado en validate-cinema-geo:', err);
    process.exit(1);
  });
}
