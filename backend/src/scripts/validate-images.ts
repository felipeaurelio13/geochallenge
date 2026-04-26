import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TIMEOUT_MS = 5000;
const CONCURRENCY = 10;

async function checkUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function runInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
    process.stdout.write(`\r  Checked ${Math.min(i + batchSize, items.length)}/${items.length}...`);
  }
  return results;
}

async function main() {
  console.log('Fetching SILHOUETTE questions from database...');
  const questions = await prisma.question.findMany({
    where: { category: 'SILHOUETTE', imageUrl: { not: null } },
    select: { imageUrl: true, questionData: true },
  });

  console.log(`Found ${questions.length} silhouette questions. Validating URLs...\n`);

  const results = await runInBatches(questions, CONCURRENCY, async (q) => {
    const url = q.imageUrl!;
    const ok = await checkUrl(url);
    return { url, country: q.questionData, ok };
  });

  console.log('\n');

  const broken = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);

  console.log(`✅ OK:     ${ok.length}`);
  console.log(`❌ BROKEN: ${broken.length}`);

  if (broken.length > 0) {
    console.log('\nBroken URLs:');
    for (const r of broken) {
      console.log(`  [${r.country}] ${r.url}`);
    }
    process.exit(1);
  } else {
    console.log('\nAll silhouette images are accessible. ');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
