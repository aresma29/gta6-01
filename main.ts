// VICE BAY — entrypoint: copies game/ + screenshots/ to the output dir and
// writes dossier.json with buildDossier from the kit's makefun-game.ts.
// Written fresh for the rebuild. Node 22, standard library only.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const rootDir = new URL('.', import.meta.url).pathname;

function copyTree(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) copyTree(s, d);
    else cpSync(s, d);
  }
}

function main() {
  const gameDir = join(rootDir, 'game');
  const shotsDir = join(rootDir, 'screenshots');
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    throw new Error('main.ts: no game/ directory in the repository');
  }
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTree(gameDir, join(outDir, 'game'));
  if (existsSync(shotsDir) && statSync(shotsDir).isDirectory()) {
    copyTree(shotsDir, join(outDir, 'screenshots'));
  }
  const caps = {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 256 * 1024 },
    game_max_files: 1000,
    game_max_bytes: 64 * 1024 * 1024,
    game_path_max_bytes: 1000,
  };
  const dossier = buildDossier(outDir, caps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`main.ts: wrote ${outDir} (dossier ${dossier.length} bytes)`);
}

main();
