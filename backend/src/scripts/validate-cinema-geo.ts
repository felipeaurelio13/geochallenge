/**
 * Validates the Cinema & Geography catalog (schema v2).
 *
 * Invariants enforced for every entry:
 *   - id is non-empty, unique, no whitespace
 *   - answerKind ∈ {country, city, venue}
 *   - options is an array of exactly 4 unique strings, including answer.value
 *   - prompt has non-empty es and en
 *   - answer.value is never equal to movie.title (would be a spoiler)
 *
 * Approved-only invariants:
 *   - sources has at least one entry with a real URL
 *
 * Exits 0 if all approved questions pass; exits 1 on any structural error.
 */
import { loadFullCinemaGeoCatalog, type CinemaGeoQuestion } from '../utils/cinemaGeoCatalog.js';

export type { CinemaGeoQuestion };

const VALID_KINDS = new Set(['country', 'city', 'venue']);
const VALID_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);
const VALID_STATUSES = new Set(['approved', 'needs_sources', 'rejected']);
const VALID_CONFIDENCES = new Set(['high', 'medium', 'low']);

/** Returns an array of error strings for a single question. Empty = valid. */
export function validateCinemaGeoQuestion(q: CinemaGeoQuestion): string[] {
  const errors: string[] = [];
  const prefix = `[${q.id ?? '(sin id)'}]`;

  if (!q.id || typeof q.id !== 'string' || /\s/.test(q.id)) {
    errors.push(`${prefix} 'id' debe ser una cadena sin espacios`);
  }
  if (!VALID_KINDS.has(q.answerKind)) {
    errors.push(`${prefix} answerKind inválido: "${q.answerKind}"`);
  }
  if (!VALID_DIFFICULTIES.has(q.difficulty)) {
    errors.push(`${prefix} dificultad inválida: "${q.difficulty}"`);
  }
  if (!VALID_STATUSES.has(q.reviewStatus)) {
    errors.push(`${prefix} reviewStatus inválido: "${q.reviewStatus}"`);
  }
  if (!VALID_CONFIDENCES.has(q.confidence)) {
    errors.push(`${prefix} confidence inválida: "${q.confidence}"`);
  }

  if (!q.prompt || typeof q.prompt !== 'object') {
    errors.push(`${prefix} 'prompt' debe ser un objeto`);
  } else {
    if (!q.prompt.es?.trim()) errors.push(`${prefix} prompt.es está vacío`);
    if (!q.prompt.en?.trim()) errors.push(`${prefix} prompt.en está vacío`);
  }

  if (!q.movie?.title?.trim()) errors.push(`${prefix} movie.title está vacío`);
  if (typeof q.movie?.year !== 'number') errors.push(`${prefix} movie.year debe ser un número`);

  if (!q.answer || typeof q.answer.value !== 'string' || !q.answer.value.trim()) {
    errors.push(`${prefix} answer.value está vacío`);
  } else if (q.answer.value === q.movie?.title) {
    // The whole point of v2 is to prevent this.
    errors.push(`${prefix} SPOILER: answer.value es igual a movie.title ("${q.movie.title}"). Reformula la pregunta para que la respuesta sea un lugar.`);
  }
  if (q.answer?.lat !== undefined && (q.answer.lat < -90 || q.answer.lat > 90)) {
    errors.push(`${prefix} answer.lat inválido: ${q.answer.lat}`);
  }
  if (q.answer?.lng !== undefined && (q.answer.lng < -180 || q.answer.lng > 180)) {
    errors.push(`${prefix} answer.lng inválido: ${q.answer.lng}`);
  }

  if (!Array.isArray(q.options)) {
    errors.push(`${prefix} 'options' debe ser un array`);
  } else {
    if (q.options.length !== 4) {
      errors.push(`${prefix} options debe tener exactamente 4 elementos (tiene ${q.options.length})`);
    }
    if (new Set(q.options).size !== q.options.length) {
      errors.push(`${prefix} options contiene duplicados`);
    }
    if (q.answer?.value && !q.options.includes(q.answer.value)) {
      errors.push(`${prefix} answer.value "${q.answer.value}" no está en options`);
    }
  }

  if (q.reviewStatus === 'approved') {
    if (!Array.isArray(q.sources) || q.sources.length === 0) {
      errors.push(`${prefix} approved requiere al menos una entrada en sources`);
    } else if (!q.sources.some((s) => s.sourceUrl?.trim())) {
      errors.push(`${prefix} approved requiere al menos un sourceUrl real`);
    }
  }

  return errors;
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
    console.log('⚠️  cinema-geo: catálogo vacío — válido durante bootstrap.');
    process.exit(0);
  }

  const seenIds = new Set<string>();
  const allErrors: string[] = [];

  for (const q of questions) {
    if (q.id && seenIds.has(q.id)) {
      allErrors.push(`ID duplicado: "${q.id}"`);
    } else if (q.id) {
      seenIds.add(q.id);
    }
    allErrors.push(...validateCinemaGeoQuestion(q));
  }

  const approvedCount = questions.filter((q) => q.reviewStatus === 'approved').length;
  console.log(`📋 cinema-geo: ${questions.length} entradas v2 (${approvedCount} approved).`);

  if (allErrors.length > 0) {
    console.error(`\n❌ cinema-geo validation falló (${allErrors.length} errores):`);
    for (const e of allErrors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('✅ cinema-geo validation OK.');
}

if (process.argv[1]?.endsWith('validate-cinema-geo.ts') || process.argv[1]?.endsWith('validate-cinema-geo.js')) {
  main().catch((err) => {
    console.error('❌ Error inesperado en validate-cinema-geo:', err);
    process.exit(1);
  });
}
