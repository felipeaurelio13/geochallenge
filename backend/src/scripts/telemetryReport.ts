import { prisma } from '../config/database.js';

interface ReportArgs {
  days: number;
}

function parseArgs(): ReportArgs {
  const args = process.argv.slice(2);
  let days = 14;
  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      days = parseInt(arg.split('=')[1], 10) || 14;
    }
  }
  return { days };
}

type AccRow = { category: string; total: number; correct: number };
type DiffRow = { difficulty: string; total: number; correct: number };

async function run() {
  const { days } = parseArgs();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  console.log(`\n📊 GeoChallenge Telemetry Report (last ${days} days)\n`);
  console.log(`Period: ${since.toISOString()} → now\n`);

  // 1. Active players
  const activePlayers = await prisma.telemetryEvent.groupBy({
    by: ['userId'],
    where: { occurredAt: { gte: since }, userId: { not: null } },
    _count: true,
  });
  console.log(`1. Active players: ${activePlayers.length}`);

  // 2. Starts by variant
  const startsByVariant = await prisma.telemetryEvent.groupBy({
    by: ['variant'],
    where: { name: 'game_started', occurredAt: { gte: since }, variant: { not: null } },
    _count: true,
  });
  console.log(`\n2. Starts by variant:`);
  for (const s of startsByVariant) {
    console.log(`   ${s.variant}: ${s._count}`);
  }

  // 3. Completion rate by variant
  const finishesByVariant = await prisma.telemetryEvent.groupBy({
    by: ['variant'],
    where: { name: 'game_finished', occurredAt: { gte: since }, variant: { not: null } },
    _count: true,
  });
  console.log(`\n3. Completion rate by variant:`);
  for (const s of startsByVariant) {
    const finishCount = finishesByVariant.find((f) => f.variant === s.variant)?._count || 0;
    const rate = s._count > 0 ? Math.round((finishCount / s._count) * 100) : 0;
    console.log(`   ${s.variant}: ${finishCount}/${s._count} (${rate}%)`);
  }

  // 4. Abandon rate by variant
  const startedRuns = await prisma.telemetryEvent.groupBy({
    by: ['variant', 'runId'],
    where: { name: 'game_started', occurredAt: { gte: since }, variant: { not: null } },
    _count: true,
  });

  const finishedRuns = new Set<string>();
  const finishedResults = await prisma.telemetryEvent.findMany({
    where: { name: 'game_finished', occurredAt: { gte: since } },
    select: { runId: true },
    distinct: ['runId'],
  });
  for (const f of finishedResults) {
    if (f.runId) finishedRuns.add(f.runId);
  }

  const variantRuns: Record<string, { started: number; finished: number }> = {};
  for (const s of startedRuns) {
    const key = s.variant || 'UNKNOWN';
    if (!variantRuns[key]) variantRuns[key] = { started: 0, finished: 0 };
    variantRuns[key].started += 1;
    if (s.runId && finishedRuns.has(s.runId)) {
      variantRuns[key].finished += 1;
    }
  }

  const abandonsByVariant = await prisma.telemetryEvent.groupBy({
    by: ['variant'],
    where: { name: 'game_abandoned', occurredAt: { gte: since }, variant: { not: null } },
    _count: true,
  });

  console.log(`\n4. Abandon rate by variant:`);
  for (const [variant, data] of Object.entries(variantRuns)) {
    const abandonCount = abandonsByVariant.find((a) => a.variant === variant)?._count || 0;
    const inferAbandon = data.started - data.finished;
    console.log(`   ${variant}: ${inferAbandon} inferred abandons / ${data.started} starts`);
    if (abandonCount > 0) console.log(`          ${abandonCount} explicit abandons`);
  }

  // 5. Accuracy by category
  console.log(`\n5. Accuracy by category:`);
  try {
    const accByCat = await prisma.$queryRaw<AccRow[]>`
      SELECT
        "category",
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (WHERE CAST(properties->>'isCorrect' AS BOOLEAN) = TRUE)::int AS "correct"
      FROM "telemetry_events"
      WHERE "name" = 'question_answered'
        AND "occurredAt" >= ${since}
        AND "category" IS NOT NULL
      GROUP BY "category"
    `;
    for (const row of accByCat) {
      const acc = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
      console.log(`   ${row.category}: ${acc}% (${row.correct}/${row.total})`);
    }
  } catch (err) {
    console.log('   (no data)');
  }

  // 6. Accuracy by difficulty
  console.log(`\n6. Accuracy by difficulty:`);
  try {
    const accByDiff = await prisma.$queryRaw<DiffRow[]>`
      SELECT
        properties->>'difficulty' AS "difficulty",
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (WHERE CAST(properties->>'isCorrect' AS BOOLEAN) = TRUE)::int AS "correct"
      FROM "telemetry_events"
      WHERE "name" = 'question_answered'
        AND "occurredAt" >= ${since}
        AND properties->>'difficulty' IS NOT NULL
      GROUP BY properties->>'difficulty'
    `;
    for (const row of accByDiff) {
      const acc = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
      console.log(`   ${row.difficulty}: ${acc}% (${row.correct}/${row.total})`);
    }
  } catch {
    console.log('   (no data)');
  }

  // 7. Mechanic usage
  console.log(`\n7. Mechanic usage:`);
  try {
    const mechanicUsage = await prisma.$queryRaw<Array<{ mechanic: string; cnt: string }>>`
      SELECT properties->>'mechanic' as mechanic, COUNT(*)::text as cnt
      FROM "telemetry_events"
      WHERE "name" = 'mechanic_used'
        AND "occurredAt" >= ${since}
      GROUP BY mechanic
      ORDER BY cnt DESC
    `;
    for (const m of mechanicUsage) {
      console.log(`   ${m.mechanic}: ${m.cnt}`);
    }
  } catch { console.log('   (no data)'); }

  // 8. Daily starts/completions
  const dailyStarts = await prisma.telemetryEvent.count({ where: { name: 'game_started', variant: 'DAILY', occurredAt: { gte: since } } });
  const dailyFinishes = await prisma.telemetryEvent.count({ where: { name: 'game_finished', variant: 'DAILY', occurredAt: { gte: since } } });
  console.log(`\n8. Daily starts/completions: ${dailyFinishes}/${dailyStarts}`);

  // 9. Duel/Survival/Challenge starts/completions
  const byModeStart = await prisma.telemetryEvent.groupBy({
    by: ['gameMode'],
    where: { name: 'game_started', occurredAt: { gte: since }, gameMode: { not: null } },
    _count: true,
  });
  const byModeFinish = await prisma.telemetryEvent.groupBy({
    by: ['gameMode'],
    where: { name: 'game_finished', occurredAt: { gte: since }, gameMode: { not: null } },
    _count: true,
  });
  console.log(`\n9. Multiplayer starts/completions:`);
  for (const mode of ['DUEL', 'SURVIVAL', 'CHALLENGE']) {
    const s = byModeStart.find((m) => m.gameMode === mode)?._count || 0;
    const f = byModeFinish.find((m) => m.gameMode === mode)?._count || 0;
    console.log(`   ${mode}: ${f}/${s}`);
  }

  // 10. Funnel mode_selected -> game_started -> game_finished
  console.log(`\n10. Funnel:`);
  try {
    const modeSelected = await prisma.telemetryEvent.count({ where: { name: 'mode_selected', occurredAt: { gte: since } } });
    const allStarts = await prisma.telemetryEvent.count({ where: { name: 'game_started', occurredAt: { gte: since } } });
    const allFinishes = await prisma.telemetryEvent.count({ where: { name: 'game_finished', occurredAt: { gte: since } } });

    console.log(`    mode_selected: ${modeSelected}`);
    console.log(`    game_started: ${allStarts}`);
    console.log(`    game_finished: ${allFinishes}`);
    if (modeSelected > 0) {
      console.log(`    start rate: ${Math.round((allStarts / modeSelected) * 100)}%`);
    }
    if (allStarts > 0) {
      console.log(`    finish rate: ${Math.round((allFinishes / allStarts) * 100)}%`);
    }
  } catch { console.log('    (no data)'); }

  console.log('');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Telemetry report failed:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
