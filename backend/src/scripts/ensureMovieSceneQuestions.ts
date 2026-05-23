/**
 * Ensures MOVIE_SCENE questions exist in the database.
 * Safe to call on every startup — does nothing if questions already present.
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
    const existing = await prisma.question.count({
      where: { category: Category.MOVIE_SCENE },
    });

    if (existing > 0) {
      console.log(`ℹ️  MOVIE_SCENE: ${existing} preguntas ya existen, skip auto-seed.`);
      return;
    }

    console.log('🎬 MOVIE_SCENE: no hay preguntas, iniciando auto-seed...');

    const scenes = loadMovieSceneCatalog();
    const { countries } = getSeedCountries(loadCountryCatalog(), false);

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
      console.warn('⚠️  MOVIE_SCENE auto-seed: ninguna pregunta generada (catálogo vacío o países no encontrados).');
      return;
    }

    await prisma.question.createMany({ data: questions });
    console.log(`✅ MOVIE_SCENE: ${questions.length} preguntas creadas automáticamente.`);
  } catch (err) {
    // Non-fatal: log and continue startup. The category will show "not enough questions"
    // until the next restart or manual seed, but it won't crash the server.
    console.error('⚠️  MOVIE_SCENE auto-seed falló (no-fatal):', err);
  }
}
