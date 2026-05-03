/**
 * Script de rebuild retroactivo de leaderboards.
 *
 * Uso:
 *   npm run rebuild:leaderboards          (en backend/)
 *   tsx src/scripts/rebuild-leaderboards.ts
 *
 * Hace tres cosas:
 *   1. Recomputa User.highScore desde GameResult (DB es fuente de verdad).
 *   2. Resincroniza Redis global desde DB.
 *   3. Resincroniza Redis para CADA temporada (mes) que tenga partidas registradas.
 *
 * Idempotente: se puede correr múltiples veces sin efectos colaterales.
 */

import { rebuildAllLeaderboards } from '../services/leaderboard.service.js';
import { prisma, connectDatabase } from '../config/database.js';
import { disconnectRedis } from '../config/redis.js';

async function main(): Promise<void> {
  console.log('🔧 Iniciando rebuild retroactivo de leaderboards...\n');

  await connectDatabase();

  const startedAt = Date.now();
  const result = await rebuildAllLeaderboards();
  const elapsedMs = Date.now() - startedAt;

  console.log('\n✅ Rebuild completo');
  console.log(`   • highScore actualizados: ${result.highScoresUpdated}`);
  console.log(`   • Global cargado en Redis: ${result.globalLoaded} usuarios`);
  console.log(`   • Temporadas procesadas: ${result.seasonsLoaded.length}`);
  for (const s of result.seasonsLoaded) {
    console.log(`     - ${s.seasonId}: ${s.loaded} usuarios`);
  }
  console.log(`   • Tiempo total: ${elapsedMs} ms\n`);
}

main()
  .catch((err) => {
    console.error('❌ Rebuild falló:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    await disconnectRedis().catch(() => undefined);
  });
