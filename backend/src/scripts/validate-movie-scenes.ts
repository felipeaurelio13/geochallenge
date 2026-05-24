import { loadMovieSceneCatalog, buildCommonsImageUrl } from '../utils/movieSceneCatalog.js';

const TIMEOUT_MS = 8000;

async function checkImageUrl(url: string): Promise<{ ok: boolean; contentType: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' });
    const contentType = res.headers.get('content-type');
    return { ok: res.ok && Boolean(contentType?.startsWith('image/')), contentType };
  } catch {
    return { ok: false, contentType: null };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const scenes = loadMovieSceneCatalog();
  const failures: string[] = [];

  for (const scene of scenes) {
    const expectedImageUrl = buildCommonsImageUrl(scene.attribution.sourceUrl);

    if (scene.imageUrl !== expectedImageUrl) {
      failures.push(`[${scene.slug}] imageUrl no coincide con sourceUrl`);
      continue;
    }

    const sourceRes = await fetch(scene.attribution.sourceUrl, { method: 'HEAD', redirect: 'follow' });
    if (!sourceRes.ok) {
      failures.push(`[${scene.slug}] sourceUrl inaccesible (${sourceRes.status})`);
      continue;
    }

    const imageRes = await checkImageUrl(scene.imageUrl);
    if (!imageRes.ok) {
      failures.push(
        `[${scene.slug}] imageUrl rota o no-image (content-type=${imageRes.contentType ?? 'null'})`
      );
    }
  }

  if (failures.length > 0) {
    console.error(`❌ Validación MOVIE_SCENE falló (${failures.length} errores):`);
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
  }

  console.log(`✅ Validación MOVIE_SCENE OK (${scenes.length} escenas).`);
}

main().catch((error) => {
  console.error('❌ Error validando MOVIE_SCENE:', error);
  process.exit(1);
});
