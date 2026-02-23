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

interface CityData {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...\n');

  // Leer datos de países
  const countriesPath = join(__dirname, '../../data/countries.json');
  const countriesData = JSON.parse(readFileSync(countriesPath, 'utf-8'));
  const countries: CountryData[] = countriesData.countries;

  // Leer datos de ciudades
  const citiesPath = join(__dirname, '../../data/cities.json');
  const citiesData = JSON.parse(readFileSync(citiesPath, 'utf-8'));
  const cities: CityData[] = citiesData.cities;

  console.log(`📊 Cargando ${countries.length} países y ${cities.length} ciudades...\n`);

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

  // Generar preguntas de mapa (ubicar ciudades importantes)
  console.log('🗺️  Generando preguntas de mapa...');
  let mapCount = 0;
  for (const city of cities) {
    const country = countries.find((c) => c.name === city.country);
    if (!country) {
      console.warn(`⚠️  País no encontrado para ciudad ${city.name}: ${city.country}`);
      continue;
    }

    questions.push({
      category: Category.MAP,
      questionData: city.name,
      options: [],
      correctAnswer: city.country,
      latitude: city.lat,
      longitude: city.lng,
      continent: country.continent,
      difficulty: getCityDifficulty(city.name, city.country),
    });
    mapCount++;
  }

  // Generar preguntas de siluetas
  console.log('🖼️  Generando preguntas de siluetas...');
  for (const country of countries) {
    const distractors = getDistractors(country, countries, 3);
    questions.push({
      category: Category.SILHOUETTE,
      questionData: country.name,
      options: shuffleArray([country.name, ...distractors]),
      correctAnswer: country.name,
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
   - Preguntas de mapa: ${mapCount} (ciudades de ${countries.length} países)
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
    'United States', 'France', 'Germany', 'Italy', 'Spain', 'Japan', 'China',
    'Brazil', 'Argentina', 'Mexico', 'United Kingdom', 'Canada', 'Australia',
    'Russia', 'India', 'Egypt', 'South Africa', 'South Korea', 'Netherlands',
    'Portugal', 'Greece', 'Turkey', 'Poland', 'Sweden', 'Norway', 'Switzerland',
    'Ireland', 'Belgium', 'Austria', 'New Zealand', 'Colombia', 'Chile', 'Peru',
    'Cuba', 'Jamaica', 'Israel', 'Saudi Arabia', 'Thailand', 'Vietnam', 'Philippines',
    'Indonesia', 'Singapore', 'Morocco', 'Nigeria', 'Kenya', 'Ukraine', 'Venezuela',
  ];

  const hardCountries = [
    'Kiribati', 'Tuvalu', 'Nauru', 'Palau', 'Marshall Islands', 'Micronesia',
    'Vanuatu', 'Solomon Islands', 'Comoros', 'São Tomé and Príncipe', 'Seychelles',
    'Maldives', 'Antigua and Barbuda', 'Saint Kitts and Nevis', 'Saint Lucia',
    'Saint Vincent and the Grenadines', 'Dominica', 'Grenada', 'Barbados',
    'Djibouti', 'Eritrea', 'Burundi', 'Lesotho', 'Eswatini', 'Guinea-Bissau',
    'Equatorial Guinea', 'Gabon', 'Gambia', 'Benin', 'Togo', 'Burkina Faso',
    'Central African Republic', 'Chad', 'Mauritania', 'Cape Verde', 'Liberia',
    'Sierra Leone', 'Guinea', 'Mali', 'Niger', 'South Sudan',
    'Brunei', 'East Timor', 'Bhutan', 'Turkmenistan', 'Tajikistan', 'Kyrgyzstan',
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
 * Determina la dificultad de una pregunta de ciudad
 */
function getCityDifficulty(cityName: string, countryName: string): Difficulty {
  const easyCities = [
    // Ciudades mundialmente famosas
    'New York', 'Los Angeles', 'Chicago', 'Washington, D.C.', 'Miami', 'Houston',
    'London', 'Manchester', 'Edinburgh', 'Birmingham', 'Glasgow',
    'Paris', 'Marseille', 'Lyon', 'Nice', 'Toulouse',
    'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne',
    'Rome', 'Milan', 'Naples', 'Florence', 'Turin',
    'Madrid', 'Barcelona', 'Seville', 'Valencia', 'Bilbao',
    'Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Nagoya',
    'Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu',
    'Mumbai', 'New Delhi', 'Bangalore', 'Chennai', 'Kolkata',
    'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Canberra',
    'Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa',
    'Moscow', 'Saint Petersburg',
    'São Paulo', 'Rio de Janeiro', 'Brasília',
    'Buenos Aires', 'Córdoba', 'Rosario',
    'Mexico City', 'Guadalajara', 'Monterrey', 'Cancún',
    'Cairo', 'Alexandria',
    'Istanbul', 'Ankara', 'Izmir', 'Antalya',
    'Seoul', 'Busan', 'Incheon',
    'Bangkok', 'Chiang Mai', 'Phuket',
    'Singapore',
    'Amsterdam', 'Rotterdam', 'The Hague',
    'Lisbon', 'Porto',
    'Athens', 'Thessaloniki',
    'Vienna', 'Salzburg',
    'Brussels', 'Antwerp',
    'Stockholm', 'Gothenburg',
    'Oslo', 'Bergen',
    'Copenhagen',
    'Dublin', 'Cork',
    'Zürich', 'Geneva', 'Bern',
    'Warsaw', 'Kraków',
    'Prague', 'Brno',
    'Budapest',
    'Bogotá', 'Medellín', 'Cartagena',
    'Lima', 'Cusco',
    'Santiago', 'Valparaíso',
    'Havana',
    'Johannesburg', 'Cape Town', 'Durban',
    'Nairobi', 'Mombasa',
    'Lagos', 'Abuja',
    'Casablanca', 'Marrakech',
    'Dubai', 'Abu Dhabi',
    'Riyadh', 'Jeddah', 'Mecca',
    'Jerusalem', 'Tel Aviv',
    'Hanoi', 'Ho Chi Minh City',
    'Jakarta', 'Denpasar',
    'Manila', 'Cebu City',
    'Kuala Lumpur',
    'Kyiv', 'Lviv', 'Odessa',
    'Caracas',
    'Montevideo',
    'Colombo',
    'Taipei', 'Kaohsiung',
    'Doha', 'Muscat',
    'Reykjavik',
  ];

  const hardCities = [
    // Ciudades poco conocidas internacionalmente
    'Elbasan', 'Blida', 'Lubango', 'Lobito', 'Benguela',
    'Vanadzor', 'Sumgait', 'Riffa',
    'Rajshahi', 'Sylhet',
    'Mogilev', 'Vitebsk', 'Grodno',
    'Moundou', 'Bafoussam', 'Garoua',
    'Mindelo', 'Keren',
    'Manzini', 'Adama',
    'Burgas', 'Bobo-Dioulasso',
    'Battambang', 'Plzeň',
    'Mbuji-Mayi', 'Kisangani',
    'Aalborg', 'La Romana',
    'Ambato', 'Manta',
    'Bata', 'Daugavpils',
    'Misrata', 'Klaipėda',
    'Toamasina', 'Antsirabe',
    'Nzérékoré', 'Nampula',
    'Darkhan', 'Erdenet',
    'Sfax', 'Sousse',
    'Türkmenabat', 'Khujand',
    'Entebbe', 'Gulu',
    'Sikasso', 'Zinder',
    'Hamhung', 'Ohrid',
    'Takoradi', 'Tamale',
    'Salalah', 'Aktau',
    'Karaganda', 'Shymkent',
    'Nakuru', 'Eldoret',
    'Khon Kaen', 'Pattaya',
    'Lalitpur', 'Pokhara',
    'Ipoh', 'Kota Kinabalu',
    'Port-Gentil', 'Tiraspol',
    'Ndola', 'Livingstone',
    'Encarnación', 'San Fernando',
    'Omdurman', 'Port Sudan',
    'Hai Phong', 'Nha Trang',
    'Faisalabad', 'Peshawar',
    'Hebron', 'Irbid',
    'Banská Bystrica', 'Maribor',
    'Butare', 'Thiès',
    'Barquisimeto',
    'Ngerulmud', 'Palikir', 'Tarawa', 'Yaren', 'Funafuti',
    'Port Vila', 'Honiara', 'Majuro',
  ];

  if (easyCities.includes(cityName)) {
    return Difficulty.EASY;
  }
  if (hardCities.includes(cityName)) {
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
