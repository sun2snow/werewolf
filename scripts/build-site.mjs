import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Do not publish the repository root. The DB layering (index.ts, service.mjs) and SQL stay
// private; only the pure referee modules needed by the offline demo are published.
const files = [
  '.nojekyll', 'index.html', '404.html', 'rules.html', 'demo.html', 'styles.css', 'icon.png', 'icon-light.png',
  'THIRD_PARTY_NOTICES.md',
  'js/config.js', 'js/room-api.js', 'js/app.js', 'js/demo.js',
  'supabase/functions/_shared/modes.js', 'supabase/functions/_shared/rules.js',
  'supabase/functions/game/engine.mjs', 'supabase/functions/game/protocol.mjs',
  'supabase/functions/game/civic.mjs', 'supabase/functions/game/turn-clock.mjs',
  'vendor/bootstrap.min.css', 'vendor/supabase.js',
  'vendor/licenses/bootstrap.txt', 'vendor/licenses/supabase-js.txt', 'vendor/licenses/phoenix.txt',
  'vendor/licenses/iceberg-js.txt', 'vendor/licenses/tslib.txt', 'vendor/licenses/tslib-copyright.txt',
];

export async function buildSite(workDir = root) {
  const out = join(workDir, 'dist');
  await rm(out, { recursive: true, force: true });
  for (const file of files) {
    const dest = join(out, file);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(join(root, file), dest);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`静态站目录：${await buildSite()}`);
}
