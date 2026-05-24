/**
 * MOVIE_SCENE is a legacy enum name.
 * Product-facing category is "Cinema & Geography": questions require film-production
 * or cinematic-location knowledge, not generic place recognition.
 *
 * Ensures approved Cinema & Geography questions exist in the database.
 * Safe to call on every startup — idempotent and incremental.
 * Only seeds questions with reviewStatus === "approved".
 * Does NOT touch legacy MOVIE_SCENE questions (slug+variant format).
 * Called from index.ts after ensureMovieSceneQuestions() completes.
 */
import { Category, Difficulty } from '@prisma/client';
import { prisma } from '../config/database.js';
import { loadCinemaGeoCatalog, type CinemaGeoQuestion } from '../utils/cinemaGeoCatalog.js';

/** Builds the questionData JSON stored in the DB for a cinema-geo question. */
function buildQuestionData(q: CinemaGeoQuestion): string {
  return JSON.stringify({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    movieTitle: q.movie.title,
    movieYear: q.movie.year,
    visualStrategy: q.visual.strategy,
    assetId: q.visual.assetId ?? null,
  });
}

/** Resolves imageUrl from visual metadata. Only set for external-image strategies. */
function resolveImageUrl(q: CinemaGeoQuestion): string | null {
  if (q.visual.strategy === 'none' || q.visual.strategy === 'movie_card' || q.visual.strategy === 'generic_cinema') {
    return null;
  }
  return q.visual.url ?? null;
}

export async function ensureCinemaGeoQuestions(): Promise<void> {
  try {
    const approved = loadCinemaGeoCatalog(); // already filtered to approved only

    // Find existing cinema-geo rows: MOVIE_SCENE questions whose questionData has a 'prompt' field.
    // Always load these — even when approved.length === 0 — so de-approved rows can be cleaned up.
    const allMovieSceneRows = await prisma.question.findMany({
      where: { category: Category.MOVIE_SCENE },
      select: { id: true, questionData: true, options: true, correctAnswer: true, difficulty: true, imageUrl: true },
    });

    const existingById = new Map<string, (typeof allMovieSceneRows)[number]>();
    for (const row of allMovieSceneRows) {
      try {
        const parsed = JSON.parse(row.questionData) as { id?: string; prompt?: unknown };
        if (parsed.prompt && typeof parsed.id === 'string') {
          existingById.set(parsed.id, row);
        }
      } catch {
        /* skip malformed or legacy-format rows */
      }
    }

    if (approved.length === 0) {
      if (existingById.size > 0) {
        // All cinema-geo questions were de-approved — remove them from DB
        const rowIds = [...existingById.values()].map((r) => r.id);
        await prisma.question.deleteMany({ where: { id: { in: rowIds } } });
        console.log(`🗑️  cinema-geo: ${existingById.size} pregunta(s) ya no approved — eliminadas de DB.`);
      } else {
        console.log('🎬 cinema-geo: 0 preguntas approved — nada que sembrar.');
      }
      return;
    }

    console.log(`🎬 cinema-geo: verificando ${approved.length} preguntas approved (${existingById.size} existentes en DB)...`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const q of approved) {
      const questionData = buildQuestionData(q);
      const imageUrl = resolveImageUrl(q);

      const newRow = {
        category: Category.MOVIE_SCENE,
        questionData,
        options: q.options,
        correctAnswer: q.correctAnswer,
        imageUrl,
        latitude: q.geoContext.lat ?? null,
        longitude: q.geoContext.lng ?? null,
        continent: q.geoContext.continent ?? null,
        difficulty: q.difficulty as Difficulty,
        isAvailable: true,
        // Geographic filters are not used for MOVIE_SCENE; set to null
        isInsular: null,
        isLandlocked: null,
        subregion: null,
        populationTier: null,
        areaTier: null,
        flagComplexity: null,
      };

      const existing = existingById.get(q.id);

      if (!existing) {
        await prisma.question.create({ data: newRow });
        createdCount += 1;
        continue;
      }

      const hasChanged =
        existing.questionData !== questionData ||
        existing.imageUrl !== imageUrl ||
        JSON.stringify(existing.options) !== JSON.stringify(q.options) ||
        existing.correctAnswer !== q.correctAnswer ||
        existing.difficulty !== q.difficulty;

      if (!hasChanged) continue;

      await prisma.question.update({ where: { id: existing.id }, data: newRow });
      updatedCount += 1;
    }

    // Remove DB rows for questions that are no longer approved (e.g., downgraded to needs_sources)
    const approvedIds = new Set(approved.map((q) => q.id));
    const toRemove = [...existingById.keys()].filter((id) => !approvedIds.has(id));
    if (toRemove.length > 0) {
      const rowIds = toRemove.map((id) => existingById.get(id)!.id);
      await prisma.question.deleteMany({ where: { id: { in: rowIds } } });
      console.log(`🗑️  cinema-geo: ${toRemove.length} pregunta(s) ya no approved — eliminadas de DB.`);
    }

    console.log(`✅ cinema-geo: creadas ${createdCount}, actualizadas ${updatedCount} (total en DB: ${existingById.size - toRemove.length + createdCount}).`);
  } catch (err) {
    // Non-fatal: log and continue startup.
    console.error('⚠️  cinema-geo auto-seed falló (no-fatal):', err);
  }
}
