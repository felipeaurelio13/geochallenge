import { PrismaClient, Category, GameMode, GameVariant } from '@prisma/client';

const prisma = new PrismaClient();

interface BackfillReport {
  gameResultsRead: number;
  attemptsInserted: number;
  alreadyExisting: number;
  unresolvedQuestionIds: number;
}

async function main() {
  console.log('🔍 mastery:backfill-attempts — reconstructing from GameResult details...\n');

  const report: BackfillReport = {
    gameResultsRead: 0,
    attemptsInserted: 0,
    alreadyExisting: 0,
    unresolvedQuestionIds: 0,
  };

  const existingRunIds = new Set<string>();
  const existingAttempts = await prisma.masteryAttempt.findMany({
    select: { runId: true },
    distinct: ['runId'],
  });
  for (const a of existingAttempts) {
    existingRunIds.add(a.runId);
  }

  const gameResults = await prisma.gameResult.findMany({
    select: {
      id: true,
      userId: true,
      gameMode: true,
      variant: true,
      details: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📊 ${gameResults.length} GameResults to process\n`);

  for (const gr of gameResults) {
    report.gameResultsRead++;
    const runId = `historical:${gr.id}`;

    if (existingRunIds.has(runId)) {
      report.alreadyExisting++;
      continue;
    }

    const details = gr.details as Array<{ questionId?: string; isCorrect?: boolean }> | null;
    if (!details || !Array.isArray(details)) continue;

    const answers = details
      .filter((d) => d.questionId && typeof d.isCorrect === 'boolean')
      .map((d) => ({ questionId: d.questionId!, isCorrect: d.isCorrect! }));

    if (answers.length === 0) continue;

    const questions = await prisma.question.findMany({
      where: { id: { in: answers.map((a) => a.questionId) }, countryCode: { not: null } },
      select: { id: true, countryCode: true, category: true, difficulty: true },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const attempts = answers
      .map((a) => {
        const q = questionMap.get(a.questionId);
        if (!q || !q.countryCode || q.category === Category.MIXED) return null;
        return {
          userId: gr.userId,
          runId,
          questionId: a.questionId,
          countryCode: q.countryCode,
          category: q.category,
          difficulty: q.difficulty,
          isCorrect: a.isCorrect,
          gameMode: gr.gameMode,
          variant: gr.variant,
        };
      })
      .filter(Boolean);

    const unresolved = answers.filter((a) => !questionMap.has(a.questionId)).length;
    report.unresolvedQuestionIds += unresolved;

    if (attempts.length > 0) {
      try {
        await prisma.masteryAttempt.createMany({
          data: attempts as any,
          skipDuplicates: true,
        });
        report.attemptsInserted += attempts.length;
      } catch (err) {
        console.error(`❌ Error inserting attempts for gameResult ${gr.id}:`, err);
      }
    }
  }

  console.log('\n✅ Report:');
  console.log(`   gameResultsRead: ${report.gameResultsRead}`);
  console.log(`   attemptsInserted: ${report.attemptsInserted}`);
  console.log(`   alreadyExisting: ${report.alreadyExisting}`);
  console.log(`   unresolvedQuestionIds: ${report.unresolvedQuestionIds}`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
