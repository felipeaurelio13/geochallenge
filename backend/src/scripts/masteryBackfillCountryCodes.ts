import { PrismaClient, Category } from '@prisma/client';
import { loadCountryCatalog, getActiveCountries, type CountryRecord } from '../utils/countryCatalog.js';
import { loadMonumentCatalog } from '../utils/monumentCatalog.js';
import { loadCinemaGeoCatalog } from '../utils/cinemaGeoCatalog.js';

const prisma = new PrismaClient();

interface BackfillReport {
  updated: number;
  alreadyMapped: number;
  unresolved: number;
  unresolvedByCategory: Record<string, number>;
}

async function main() {
  console.log('🔍 mastery:backfill-country-codes — inferring countryCode...\n');

  const report: BackfillReport = {
    updated: 0,
    alreadyMapped: 0,
    unresolved: 0,
    unresolvedByCategory: {},
  };

  const { countries } = { countries: getActiveCountries(loadCountryCatalog()) };
  const byName = new Map<string, CountryRecord>();
  for (const c of countries) {
    byName.set(c.name, c);
    byName.set(c.name.toLowerCase(), c);
  }

  const monuments = loadMonumentCatalog();
  const byMonumentSlug = new Map<string, CountryRecord>();
  for (const m of monuments) {
    const c = byName.get(m.country) ?? byName.get(m.country.toLowerCase());
    if (c) byMonumentSlug.set(m.slug, c);
  }

  const cinemaCatalog = loadCinemaGeoCatalog();
  const cinemaById = new Map<string, string>();
  for (const item of cinemaCatalog) {
    const country = item.answer.country
      ? (byName.get(item.answer.country) ?? byName.get(item.answer.country.toLowerCase()))
      : null;
    if (country) cinemaById.set(item.id, country.iso2);
  }

  const allQuestions = await prisma.question.findMany({
    where: { category: { not: Category.MIXED } },
    select: { id: true, category: true, questionData: true, correctAnswer: true, countryCode: true },
  });

  console.log(`📊 ${allQuestions.length} preguntas totales (no-MIXED)\n`);

  let batch: { id: string; countryCode: string | null }[] = [];

  for (const q of allQuestions) {
    if (q.countryCode) {
      report.alreadyMapped++;
      continue;
    }

    let code: string | null = null;

    if (q.category === Category.FLAG || q.category === Category.CAPITAL || q.category === Category.SILHOUETTE) {
      code = byName.get(q.questionData)?.iso2 ?? byName.get(q.questionData.toLowerCase())?.iso2 ?? null;
    } else if (q.category === Category.MAP) {
      code = byName.get(q.correctAnswer)?.iso2 ?? byName.get(q.correctAnswer.toLowerCase())?.iso2 ?? null;
    } else if (q.category === Category.MONUMENT) {
      try {
        const parsed = JSON.parse(q.questionData) as { slug?: string };
        if (parsed.slug) {
          const c = byMonumentSlug.get(parsed.slug);
          if (c) code = c.iso2;
        }
      } catch {}
    } else if (q.category === Category.CINEMA_GEO) {
      try {
        const parsed = JSON.parse(q.questionData) as { id?: string };
        if (parsed.id) {
          code = cinemaById.get(parsed.id) ?? null;
        }
      } catch {}
    }

    if (code) {
      batch.push({ id: q.id, countryCode: code });
      report.updated++;
    } else {
      report.unresolved++;
      report.unresolvedByCategory[q.category] = (report.unresolvedByCategory[q.category] ?? 0) + 1;
    }
  }

  if (batch.length > 0) {
    for (const item of batch) {
      await prisma.question.update({
        where: { id: item.id },
        data: { countryCode: item.countryCode },
      });
    }
  }

  console.log('✅ Report:');
  console.log(`   updated: ${report.updated}`);
  console.log(`   alreadyMapped: ${report.alreadyMapped}`);
  console.log(`   unresolved: ${report.unresolved}`);
  console.log(`   unresolvedByCategory: ${JSON.stringify(report.unresolvedByCategory)}`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
