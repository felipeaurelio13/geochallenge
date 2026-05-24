/**
 * Ensures MOVIE_SCENE questions exist in the database.
 * Safe to call on every startup — idempotent and incremental.
 * If the catalog size changes (entries added/removed), wipes all MOVIE_SCENE
 * questions and re-seeds from scratch so stale/corrupted options are corrected.
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
  correctCity: string,
  allCities: { slug: string; city: string; continent: string }[],
  count: number
): string[] {
  const sameContinent = allCities.filter(
    (s) => s.continent === continent && s.slug !== slug && s.city !== correctCity
  );
  const others = allCities.filter(
    (s) => s.continent !== continent && s.slug !== slug && s.city !== correctCity
  );
  const candidates = [...shuffleArray(sameContinent), ...shuffleArray(others)];
  return candidates.slice(0, count).map((s) => s.city);
}

export async function ensureMovieSceneQuestions(): Promise<void> {
  try {
    const scenes = loadMovieSceneCatalog();
    // 2 variants per scene (country + city)
    const expectedCount = scenes.length * 2;

    const existingRows = await prisma.question.findMany({
      where: { category: Category.MOVIE_SCENE },
      select: { id: true, questionData: true, imageUrl: true, options: true, correctAnswer: true, difficulty: true, latitude: true, longitude: true },
    });

    // If count mismatches, the catalog changed or data is stale — wipe and re-seed
    if (existingRows.length > 0 && existingRows.length !== expectedCount) {
      console.log(
        `🔄 MOVIE_SCENE: catálogo cambió (esperado ${expectedCount}, encontrado ${existingRows.length}). Limpiando y re-seeding...`
      );
      await prisma.question.deleteMany({ where: { category: Category.MOVIE_SCENE } });
      existingRows.length = 0;
    }

    const existingByVariant = new Map<string, (typeof existingRows)[number]>();
    for (const row of existingRows) {
      try {
        const parsed = JSON.parse(row.questionData) as { slug?: string; variant?: string };
        if (parsed.slug && parsed.variant) existingByVariant.set(`${parsed.slug}:${parsed.variant}`, row);
      } catch {
        /* skip malformed */
      }
    }

    console.log(
      `🎬 MOVIE_SCENE: verificando catálogo (${scenes.length} escenas, ${existingRows.length} preguntas existentes)...`
    );

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

    for (const scene of scenes) {
      const country = countries.find((c) => c.name === scene.country);
      if (!country) {
        console.warn(`⚠️  País no encontrado para escena ${scene.slug}: ${scene.country}`);
        continue;
      }

      // country variant
      const countryDistractors = getCountryDistractors(country, countries, 3);
      const countryOptions = shuffleArray([scene.country, ...countryDistractors])
        .filter((v, i, arr) => arr.indexOf(v) === i); // guard against duplicates
      questions.push({
        category: Category.MOVIE_SCENE,
        questionData: JSON.stringify({ slug: scene.slug, variant: 'country' }),
        options: countryOptions,
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

      // city variant — pass correctCity so it is never used as a distractor
      const cityDistractors = getCityDistractors(scene.slug, scene.continent, scene.city, cityList, 3);
      const cityOptions = shuffleArray([scene.city, ...cityDistractors])
        .filter((v, i, arr) => arr.indexOf(v) === i); // guard against duplicates
      questions.push({
        category: Category.MOVIE_SCENE,
        questionData: JSON.stringify({ slug: scene.slug, variant: 'city' }),
        options: cityOptions,
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

    let createdCount = 0;
    let updatedCount = 0;

    for (const question of questions) {
      const parsed = JSON.parse(question.questionData) as { slug: string; variant: string };
      const existing = existingByVariant.get(`${parsed.slug}:${parsed.variant}`);

      if (!existing) {
        await prisma.question.create({ data: question });
        createdCount += 1;
        continue;
      }

      const hasChanged =
        existing.imageUrl !== question.imageUrl ||
        JSON.stringify(existing.options) !== JSON.stringify(question.options) ||
        existing.correctAnswer !== question.correctAnswer ||
        existing.difficulty !== question.difficulty ||
        existing.latitude !== question.latitude ||
        existing.longitude !== question.longitude ||
        existing.questionData !== question.questionData;

      if (!hasChanged) continue;

      await prisma.question.update({
        where: { id: existing.id },
        data: question,
      });
      updatedCount += 1;
    }

    console.log(
      `✅ MOVIE_SCENE: creadas ${createdCount}, actualizadas ${updatedCount} (total ahora: ${existingRows.length + createdCount}).`
    );
  } catch (err) {
    // Non-fatal: log and continue startup. The category will show "not enough questions"
    // until the next restart or manual seed, but it won't crash the server.
    console.error('⚠️  MOVIE_SCENE auto-seed falló (no-fatal):', err);
  }
}
