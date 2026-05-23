/**
 * Ensures MOVIE_SCENE questions exist in the database.
 * Safe to call on every startup — idempotent and incremental.
 * Adds only scenes that are not yet in the DB (detected by slug).
 * Called from index.ts after the DB connection is established.
 */
import { PrismaClient, Category, Difficulty } from '@prisma/client';
import { loadMovieSceneCatalog } from '../utils/movieSceneCatalog.js';
import { loadCountryCatalog, getSeedCountries, type CountryRecord } from '../utils/countryCatalog.js';

const prisma = new PrismaClient();

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getCountryDistractors(
  country: CountryRecord,
  allCountries: CountryRecord[],
  count: number
): string[] {
  const sameContinent = allCountries.filter(
    (c) => c.continent === country.continent && c.name !== country.name
  );
  const others = allCountries.filter(
    (c) => c.continent !== country.continent && c.name !== country.name
  );
  const candidates = [...shuffleArray(sameContinent), ...shuffleArray(others)];
  return candidates.slice(0, count).map((c) => c.name);
}

function getCityDistractors(
  slug: string,
  continent: string,
  allCities: { slug: string; city: string; continent: string }[],
  count: number
): string[] {
  const sameContinent = allCities.filter(
    (s) => s.continent === continent && s.slug !== slug
  );
  const others = allCities.filter(
    (s) => s.continent !== continent && s.slug !== slug
  );
  const candidates = [...shuffleArray(sameContinent), ...shuffleArray(others)];
  return candidates.slice(0, count).map((s) => s.city);
}

export async function ensureMovieSceneQuestions(): Promise<void> {
  try {
    const scenes = loadMovieSceneCatalog();

    // Determine which slugs are already seeded
    const existingRows = await prisma.question.findMany({
      where: { category: Category.MOVIE_SCENE },
      select: { questionData: true },
    });

    const existingSlugs = new Set<string>();
    for (const row of existingRows) {
      try {
        const parsed = JSON.parse(row.questionData) as { slug?: string };
        if (parsed.slug) existingSlugs.add(parsed.slug);
      } catch { /* skip malformed */ }
    }

    const missingScenes = scenes.filter((s) => !existingSlugs.has(s.slug));

    if (missingScenes.length === 0) {
      console.log(`ℹ️  MOVIE_SCENE: ${existingRows.length} preguntas ya existen (catálogo completo), skip.`);
      return;
    }

    if (existingRows.length === 0) {
      console.log(`🎬 MOVIE_SCENE: no hay preguntas, iniciando auto-seed (${scenes.length} escenas)...`);
    } else {
      console.log(`🎬 MOVIE_SCENE: catálogo ampliado — añadiendo ${missingScenes.length} escenas nuevas (${existingSlugs.size} ya existían)...`);
    }

    const { countries } = getSeedCountries(loadCountryCatalog(), false);

    // Build city list from full catalog for distractor generation (not just missing scenes)
    const cityList = scenes.map((s) => ({
      slug: s.slug,
      city: s.city,
      continent: s.continent,
    }));

    const questions: {
      category: Category;
      questionData: string;
      options: string[];
      correctAnswer: string;
      imageUrl: string;
      latitude: number;
      longitude: number;
      continent: string;
      difficulty: Difficulty;
      isInsular: boolean | null;
      isLandlocked: boolean | null;
      subregion: string | null;
      populationTier: string | null;
      areaTier: string | null;
      flagComplexity: string | null;
    }[] = [];

    for (const scene of missingScenes) {
      const country = countries.find((c) => c.name === scene.country);
      if (!country) {
        console.warn(`⚠️  País no encontrado para escena ${scene.slug}: ${scene.country}`);
        continue;
      }

      // country variant
      const countryDistractors = getCountryDistractors(country, countries, 3);
      questions.push({
        category: Category.MOVIE_SCENE,
        questionData: JSON.stringify({ slug: scene.slug, variant: 'country' }),
        options: shuffleArray([scene.country, ...countryDistractors]),
        correctAnswer: scene.country,
        imageUrl: scene.imageUrl,
        latitude: scene.latitude,
        longitude: scene.longitude,
        continent: scene.continent,
        difficulty: scene.difficulty as Difficulty,
        isInsular: country.isInsular ?? null,
        isLandlocked: country.isLandlocked ?? null,
        subregion: country.subregion ?? null,
        populationTier: country.populationTier ?? null,
        areaTier: country.areaTier ?? null,
        flagComplexity: country.flagComplexity ?? null,
      });

      // city variant
      const cityDistractors = getCityDistractors(scene.slug, scene.continent, cityList, 3);
      questions.push({
        category: Category.MOVIE_SCENE,
        questionData: JSON.stringify({ slug: scene.slug, variant: 'city' }),
        options: shuffleArray([scene.city, ...cityDistractors]),
        correctAnswer: scene.city,
        imageUrl: scene.imageUrl,
        latitude: scene.latitude,
        longitude: scene.longitude,
        continent: scene.continent,
        difficulty: scene.difficulty as Difficulty,
        isInsular: country.isInsular ?? null,
        isLandlocked: country.isLandlocked ?? null,
        subregion: country.subregion ?? null,
        populationTier: country.populationTier ?? null,
        areaTier: country.areaTier ?? null,
        flagComplexity: country.flagComplexity ?? null,
      });
    }

    if (questions.length === 0) {
      console.warn('⚠️  MOVIE_SCENE auto-seed: ninguna pregunta generada (países no encontrados en catálogo).');
      return;
    }

    await prisma.question.createMany({ data: questions });
    console.log(`✅ MOVIE_SCENE: ${questions.length} preguntas nuevas creadas (total ahora: ${existingRows.length + questions.length}).`);
  } catch (err) {
    // Non-fatal: log and continue startup. The category will show "not enough questions"
    // until the next restart or manual seed, but it won't crash the server.
    console.error('⚠️  MOVIE_SCENE auto-seed falló (no-fatal):', err);
  }
}
