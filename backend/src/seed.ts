import { PrismaClient, Category, Difficulty } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface CountryData {
  name: string;
  capital: string;
  continent: string;
  lat: number;
  lng: number;
  flag: string;
}

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...\n');

  // Leer datos de países
  const countriesPath = join(__dirname, '../../data/countries.json');
  const countriesData = JSON.parse(readFileSync(countriesPath, 'utf-8'));
  const countries: CountryData[] = countriesData.countries;

  console.log(`📊 Cargando ${countries.length} países...\n`);

  // Limpiar preguntas existentes
  await prisma.question.deleteMany();
  console.log('🗑️  Preguntas anteriores eliminadas');

  const questions: any[] = [];

  // Generar preguntas de banderas
  console.log('🏳️  Generando preguntas de banderas...');
  for (const country of countries) {
    const distractors = getDistractors(country, countries, 3);
    questions.push({
      category: Category.FLAG,
      questionData: country.name,
      options: shuffleArray([country.name, ...distractors]),
      correctAnswer: country.name,
      imageUrl: `https://flagcdn.com/w320/${country.flag}.png`,
      latitude: country.lat,
      longitude: country.lng,
      continent: country.continent,
      difficulty: getDifficulty(country.name),
    });
  }

  // Generar preguntas de capitales (país -> capital)
  console.log('🏛️  Generando preguntas de capitales...');
  for (const country of countries) {
    const distractorCountries = getDistractors(country, countries, 3);
    const distractorCapitals = distractorCountries.map(
      (name) => countries.find((c) => c.name === name)?.capital || name
    );

    questions.push({
      category: Category.CAPITAL,
      questionData: country.name,
      options: shuffleArray([country.capital, ...distractorCapitals]),
      correctAnswer: country.capital,
      latitude: country.lat,
      longitude: country.lng,
      continent: country.continent,
      difficulty: getDifficulty(country.name),
    });
  }

  // Generar preguntas de mapa (ubicación)
  console.log('🗺️  Generando preguntas de mapa...');
  for (const country of countries) {
    questions.push({
      category: Category.MAP,
      questionData: country.capital,
      options: [], // No hay opciones en preguntas de mapa
      correctAnswer: country.name,
      latitude: country.lat,
      longitude: country.lng,
      continent: country.continent,
      difficulty: getDifficulty(country.name),
    });
  }

  // Generar preguntas de siluetas (usando la misma estructura que banderas)
  console.log('🖼️  Generando preguntas de siluetas...');
  for (const country of countries) {
    const distractors = getDistractors(country, countries, 3);
    questions.push({
      category: Category.SILHOUETTE,
      questionData: country.name,
      options: shuffleArray([country.name, ...distractors]),
      correctAnswer: country.name,
      // Las siluetas se generarían con un servicio de imágenes
      imageUrl: `https://raw.githubusercontent.com/djaiss/mapsicon/master/all/${country.flag}/vector.svg`,
      latitude: country.lat,
      longitude: country.lng,
      continent: country.continent,
      difficulty: getDifficulty(country.name),
    });
  }

  // Insertar todas las preguntas
  console.log(`\n📝 Insertando ${questions.length} preguntas en la base de datos...`);

  await prisma.question.createMany({
    data: questions,
  });

  console.log('\n✅ Seed completado exitosamente!');
  console.log(`
📊 Resumen:
   - Preguntas de banderas: ${countries.length}
   - Preguntas de capitales: ${countries.length}
   - Preguntas de mapa: ${countries.length}
   - Preguntas de siluetas: ${countries.length}
   - Total: ${questions.length}
  `);
}

/**
 * Obtiene países distractores del mismo continente
 */
function getDistractors(
  country: CountryData,
  allCountries: CountryData[],
  count: number
): string[] {
  // Primero intentar del mismo continente
  const sameContinent = allCountries.filter(
    (c) => c.continent === country.continent && c.name !== country.name
  );

  // Si no hay suficientes, añadir de otros continentes
  const others = allCountries.filter(
    (c) => c.continent !== country.continent && c.name !== country.name
  );

  const candidates = [...shuffleArray(sameContinent), ...shuffleArray(others)];
  return candidates.slice(0, count).map((c) => c.name);
}

/**
 * Determina la dificultad basada en qué tan conocido es el país
 */
function getDifficulty(countryName: string): Difficulty {
  const easyCountries = [
    // Major world powers and very well-known countries
    'United States', 'France', 'Germany', 'Italy', 'Spain', 'Japan', 'China',
    'Brazil', 'Argentina', 'Mexico', 'United Kingdom', 'Canada', 'Australia',
    'Russia', 'India', 'Egypt', 'South Africa', 'South Korea', 'Netherlands',
    'Portugal', 'Greece', 'Turkey', 'Poland', 'Sweden', 'Norway', 'Switzerland',
    'Ireland', 'Belgium', 'Austria', 'New Zealand', 'Colombia', 'Chile', 'Peru',
    'Cuba', 'Jamaica', 'Israel', 'Saudi Arabia', 'Thailand', 'Vietnam', 'Philippines',
    'Indonesia', 'Singapore', 'Morocco', 'Nigeria', 'Kenya', 'Ukraine', 'Venezuela',
  ];

  const hardCountries = [
    // Small island nations
    'Kiribati', 'Tuvalu', 'Nauru', 'Palau', 'Marshall Islands', 'Micronesia',
    'Vanuatu', 'Solomon Islands', 'Comoros', 'São Tomé and Príncipe', 'Seychelles',
    'Maldives', 'Antigua and Barbuda', 'Saint Kitts and Nevis', 'Saint Lucia',
    'Saint Vincent and the Grenadines', 'Dominica', 'Grenada', 'Barbados',
    // Lesser known African nations
    'Djibouti', 'Eritrea', 'Burundi', 'Lesotho', 'Eswatini', 'Guinea-Bissau',
    'Equatorial Guinea', 'Gabon', 'Gambia', 'Benin', 'Togo', 'Burkina Faso',
    'Central African Republic', 'Chad', 'Mauritania', 'Cape Verde', 'Liberia',
    'Sierra Leone', 'Guinea', 'Mali', 'Niger', 'South Sudan',
    // Lesser known Asian nations
    'Brunei', 'East Timor', 'Bhutan', 'Turkmenistan', 'Tajikistan', 'Kyrgyzstan',
    // Lesser known European nations
    'Andorra', 'San Marino', 'Liechtenstein', 'Monaco', 'Vatican City', 'Moldova',
    'North Macedonia', 'Montenegro', 'Kosovo',
  ];

  if (easyCountries.includes(countryName)) {
    return Difficulty.EASY;
  }
  if (hardCountries.includes(countryName)) {
    return Difficulty.HARD;
  }
  return Difficulty.MEDIUM;
}

/**
 * Mezcla un array aleatoriamente
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
