import { prisma } from '../config/database.js';

async function main() {
  await prisma.$connect();
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS ci_prisma_smoke (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  await prisma.$executeRawUnsafe("INSERT INTO ci_prisma_smoke (id, value) VALUES (1, 'ok') ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value");
  const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>('SELECT value FROM ci_prisma_smoke WHERE id = 1');
  if (rows[0]?.value !== 'ok') throw new Error('Prisma smoke read/write failed');
  await prisma.$executeRawUnsafe('DROP TABLE ci_prisma_smoke');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
