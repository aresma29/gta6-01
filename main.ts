// main.ts — VICE BAY 3D dossier entrypoint (Node 22, stdlib only).
// Copies game/ + screenshots/ to the output dir and writes dossier.json
// via buildDossier (makefun/dossier/v1).
// Run: node main.ts [outputDir]  (or set MAKEFUN_OUTPUT_DIR).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || process.argv[2] || join(repoRoot, 'output');

mkdirSync(outDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const src = join(repoRoot, name);
  if (existsSync(src)) cpSync(src, join(outDir, name), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

const parsed = JSON.parse(new TextDecoder().decode(dossier));
console.log(`dossier.json: ${dossier.length} bytes, text ${parsed.text.length} bytes, ${parsed.images.length} images, schema ${parsed.schema}`);
