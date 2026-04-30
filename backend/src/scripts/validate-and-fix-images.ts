/**
 * Validation script: checks every FLAG and SILHOUETTE question image URL.
 * For each question it tries the primary CDN first, then the fallback CDN.
 * If BOTH fail → marks isAvailable=false (question won't appear in games).
 * If either succeeds → marks isAvailable=true (restores previously disabled ones).
 *
 * Run with: npx ts-node src/scripts/validate-and-fix-images.ts
 *   --dry-run   print report without updating DB
 *   --fix-only  only update DB for already-checked results (no HTTP requests)
 */

import { PrismaClient, Category } from '@prisma/client';

const prisma = new PrismaClient();

const TIMEOUT_MS = 8000;
const CONCURRENCY = 15;
const DRY_RUN = process.argv.includes('--dry-run');

// Mirror the same CDN fallback logic used in the frontend hook
function computeFallbackUrl(url: string): string {
  if (!url) return '';
  const silhouetteFallback = url.replace(
    'https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all/',
    'https://raw.githubusercontent.com/djaiss/mapsicon/master/all/'
  );
  if (silhouetteFallback !== url) return silhouetteFallback;
  const flagFallback = url.replace('https://flagcdn.com/', 'https://flagpedia.net/data/flags/');
  if (flagFallback !== url) return flagFallback;
  return url;
}

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

async function checkWithFallback(primaryUrl: string): Promise<{ ok: boolean; usedFallback: boolean }> {
  if (await checkUrl(primaryUrl)) {
    return { ok: true, usedFallback: false };
  }
  const fallback = computeFallbackUrl(primaryUrl);
  if (fallback && fallback !== primaryUrl) {
    if (await checkUrl(fallback)) {
      return { ok: true, usedFallback: true };
    }
  }
  return { ok: false, usedFallback: false };
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map(fn))));
    const checked = Math.min(i + batchSize, items.length);
    process.stdout.write(`\r  Progress: ${checked}/${items.length} (${Math.round((checked / items.length) * 100)}%)  `);
  }
  process.stdout.write('\n');
  return results;
}

interface CheckResult {
  id: string;
  category: string;
  country: string;
  primaryUrl: string;
  ok: boolean;
  usedFallback: boolean;
}

async function main() {
  console.log('='.repeat(60));
  console.log('GeoChallenge Image Validation');
  if (DRY_RUN) console.log('  [DRY RUN — no DB changes will be made]');
  console.log('='.repeat(60));

  const questions = await prisma.question.findMany({
    where: {
      category: { in: [Category.FLAG, Category.SILHOUETTE] },
      imageUrl: { not: null },
    },
    select: { id: true, category: true, questionData: true, imageUrl: true },
  });

  console.log(`\nFound ${questions.length} visual questions (FLAG + SILHOUETTE)`);
  console.log('Checking primary + fallback CDN for each...\n');

  const results = await runInBatches<typeof questions[number], CheckResult>(
    questions,
    CONCURRENCY,
    async (q) => {
      const { ok, usedFallback } = await checkWithFallback(q.imageUrl!);
      return {
        id: q.id,
        category: q.category,
        country: q.questionData,
        primaryUrl: q.imageUrl!,
        ok,
        usedFallback,
      };
    }
  );

  const available = results.filter((r) => r.ok);
  const broken = results.filter((r) => !r.ok);
  const usingFallback = available.filter((r) => r.usedFallback);

  console.log('\n' + '='.repeat(60));
  console.log(`  ✅ Available:     ${available.length}`);
  console.log(`  ⚠️  Via fallback:  ${usingFallback.length}`);
  console.log(`  ❌ Broken (both): ${broken.length}`);
  console.log('='.repeat(60));

  if (usingFallback.length > 0) {
    console.log('\n⚠️  Questions that only work via fallback CDN:');
    for (const r of usingFallback) {
      console.log(`  [${r.category}] ${r.country}  →  primary failed, fallback OK`);
    }
  }

  if (broken.length > 0) {
    console.log('\n❌ Broken questions (both CDNs failed):');
    for (const r of broken) {
      console.log(`  [${r.category}] ${r.country}  →  ${r.primaryUrl}`);
    }
  }

  if (!DRY_RUN) {
    // Mark broken questions unavailable
    if (broken.length > 0) {
      const brokenIds = broken.map((r) => r.id);
      await prisma.question.updateMany({
        where: { id: { in: brokenIds } },
        data: { isAvailable: false },
      });
      console.log(`\n✏️  Marked ${brokenIds.length} questions as isAvailable=false`);
    }

    // Re-enable previously-broken questions that are now OK
    const workingIds = available.map((r) => r.id);
    const reEnabled = await prisma.question.updateMany({
      where: { id: { in: workingIds }, isAvailable: false },
      data: { isAvailable: true },
    });
    if (reEnabled.count > 0) {
      console.log(`✏️  Re-enabled ${reEnabled.count} questions whose images are back online`);
    }

    console.log('\n✅ Database updated successfully.');
  } else {
    console.log('\n[Dry run — skipped DB updates]');
  }

  if (broken.length === 0) {
    console.log('\n🎉 All images are accessible. Players will see every question.');
  } else {
    const pct = Math.round((broken.length / questions.length) * 100);
    console.log(`\n${broken.length} questions (${pct}%) will be hidden from players until their images are back.`);
  }
}

main()
  .catch((e) => {
    console.error('\nFatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
