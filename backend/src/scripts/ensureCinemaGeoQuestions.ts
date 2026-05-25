/**
 * Ensures approved Cinema & Geography questions exist in the database.
 * Safe to call on every startup — idempotent and incremental.
 *
 * Schema v2: every question asks "where was this scene filmed?". The answer is always a place
 * (country/city/venue). The movie title shown in the visual is context, not the answer — no spoiler.
 *
 * Geographic metadata (continent/isInsular/isLandlocked/subregion) is sourced from the
 * country catalog so the question participates correctly in filtered modes.
 */
import { Category, Difficulty } from '@prisma/client';
import { prisma } from '../config/database.js';
import { loadCinemaGeoCatalog, type CinemaGeoQuestion } from '../utils/cinemaGeoCatalog.js';
import { loadCountryCatalog, getSeedCountries, type CountryRecord } from '../utils/countryCatalog.js';

/** Builds the questionData JSON stored in the DB. Frontend parses this to render prompt + context. */
function buildQuestionData(q: CinemaGeoQuestion): string {
  return JSON.stringify({
    id: q.id,
    answerKind: q.answerKind,
    prompt: q.prompt,
    movieTitle: q.movie.title,
    movieYear: q.movie.year,
  });
}

function findCountry(allCountries: CountryRecord[], name: string | undefined): CountryRecord | null {
  if (!name) return null;
  return allCountries.find((c) => c.name === name) ?? null;
}

export async function ensureCinemaGeoQuestions(): Promise<void> {
  try {
    const approved = loadCinemaGeoCatalog();
    const { countries } = getSeedCountries(loadCountryCatalog(), false);

    // Load existing CINEMA_GEO rows so we can upsert + prune in one pass.
    const existingRows = await prisma.question.findMany({
      where: { category: Category.CINEMA_GEO },
      select: { id: true, questionData: true, options: true, correctAnswer: true, difficulty: true, latitude: true, longitude: true, continent: true },
    });

    // Map approved-question id → DB row (parsed from questionData.id)
    const existingByCatalogId = new Map<string, (typeof existingRows)[number]>();
    for (const row of existingRows) {
      try {
        const parsed = JSON.parse(row.questionData) as { id?: string };
        if (parsed.id) existingByCatalogId.set(parsed.id, row);
      } catch {
        /* row predates v2 — will be pruned below */
      }
    }

    console.log(`🎬 cinema-geo: verificando ${approved.length} preguntas approved (${existingRows.length} existentes en DB)...`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const q of approved) {
      const country = findCountry(countries, q.answer.country);

      const newRow = {
        category: Category.CINEMA_GEO,
        questionData: buildQuestionData(q),
        options: q.options,
        correctAnswer: q.answer.value,
        imageUrl: null,                                  // v2 has no images — movie card is rendered client-side
        latitude: q.answer.lat ?? null,
        longitude: q.answer.lng ?? null,
        continent: q.answer.continent ?? country?.continent ?? null,
        difficulty: q.difficulty as Difficulty,
        isAvailable: true,
        isInsular: country?.isInsular ?? null,
        isLandlocked: country?.isLandlocked ?? null,
        subregion: country?.subregion ?? null,
        populationTier: country?.populationTier ?? null,
        areaTier: country?.areaTier ?? null,
        flagComplexity: null,                            // not meaningful for cinema-geo
      };

      const existing = existingByCatalogId.get(q.id);
      if (!existing) {
        await prisma.question.create({ data: newRow });
        createdCount += 1;
        continue;
      }

      const hasChanged =
        existing.questionData !== newRow.questionData ||
        JSON.stringify(existing.options) !== JSON.stringify(newRow.options) ||
        existing.correctAnswer !== newRow.correctAnswer ||
        existing.difficulty !== newRow.difficulty ||
        existing.latitude !== newRow.latitude ||
        existing.longitude !== newRow.longitude ||
        existing.continent !== newRow.continent;

      if (hasChanged) {
        await prisma.question.update({ where: { id: existing.id }, data: newRow });
        updatedCount += 1;
      }
    }

    // Prune: any DB row whose catalog id is no longer in the approved set (de-approved, renamed, or v1 leftover)
    const approvedIds = new Set(approved.map((q) => q.id));
    const toRemove = existingRows.filter((row) => {
      try {
        const parsed = JSON.parse(row.questionData) as { id?: string };
        return !parsed.id || !approvedIds.has(parsed.id);
      } catch {
        return true;                                     // unparseable rows are stale by definition
      }
    });
    if (toRemove.length > 0) {
      await prisma.question.deleteMany({ where: { id: { in: toRemove.map((r) => r.id) } } });
      console.log(`🗑️  cinema-geo: ${toRemove.length} fila(s) obsoleta(s) eliminada(s).`);
    }

    console.log(`✅ cinema-geo: creadas ${createdCount}, actualizadas ${updatedCount}, eliminadas ${toRemove.length} (total approved en DB: ${approved.length}).`);
  } catch (err) {
    // Non-fatal: log and continue startup. The category will show "not enough questions" until fixed.
    console.error('⚠️  cinema-geo auto-seed falló (no-fatal):', err);
  }
}
